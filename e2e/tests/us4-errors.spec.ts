import { expect, test, type Page } from '@playwright/test';
import { newTaskInput, resetTodos, seedTodos, todoItems } from './helpers';

const SAVE_FAILED = "Couldn't save your change. Please try again.";

/** Makes every request with this method to /api/todos fail at the network level. */
async function breakRequests(page: Page, method: string): Promise<() => Promise<void>> {
  const pattern = '**/api/todos**';
  const handler = async (route: import('@playwright/test').Route) => {
    if (route.request().method() === method) await route.abort('failed');
    else await route.fallback();
  };
  await page.route(pattern, handler);
  return () => page.unroute(pattern, handler);
}

test.describe('US4: loading and error states', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('shows a loading indicator until the list arrives (US4-AS1)', async ({ page, request }) => {
    await seedTodos(request, ['Slow one']);
    await page.route('**/api/todos', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fallback();
    });
    await page.goto('/');
    await expect(page.getByRole('status').filter({ hasText: 'Loading tasks…' })).toBeVisible();
    await expect(newTaskInput(page)).toBeDisabled();
    await expect(todoItems(page)).toHaveCount(1, { timeout: 5000 });
    await expect(page.getByText('Loading tasks…')).toHaveCount(0);
  });

  test('offers a retry when loading fails (US4-AS2)', async ({ page, request }) => {
    await seedTodos(request, ['Recovered']);
    const failGet = async (route: import('@playwright/test').Route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
        }),
      });
    await page.route('**/api/todos', failGet);
    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText("Couldn't load your tasks.");
    await page.unroute('**/api/todos', failGet);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(todoItems(page)).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('rolls back failed add, toggle and delete without a reload (US4-AS3, AS4, SC-005)', async ({
    page,
    request,
  }) => {
    await seedTodos(request, ['Existing']);
    await page.goto('/');
    await expect(todoItems(page)).toHaveCount(1);
    const navigations: string[] = [];
    page.on('framenavigated', (frame) => navigations.push(frame.url()));

    // Add fails: the item disappears, the message shows, and the text is kept (US4-AS4).
    let restore = await breakRequests(page, 'POST');
    const input = newTaskInput(page);
    await input.fill('Keep me');
    await input.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: SAVE_FAILED })).toBeVisible();
    await expect(todoItems(page)).toHaveCount(1);
    await expect(input).toHaveValue('Keep me');
    await restore();
    await input.press('Enter');
    await expect(todoItems(page)).toHaveCount(2);
    await expect(todoItems(page).first()).toContainText('Keep me');
    await expect(input).toHaveValue('');

    // Toggle fails: the checkbox reverts.
    await page.getByRole('button', { name: 'Dismiss' }).click();
    restore = await breakRequests(page, 'PATCH');
    const checkbox = page.getByRole('checkbox', { name: 'Existing' });
    await checkbox.click();
    await expect(page.getByRole('status').filter({ hasText: SAVE_FAILED })).toBeVisible();
    await expect(checkbox).not.toBeChecked();
    await restore();
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Delete fails: the todo comes back in place.
    await page.getByRole('button', { name: 'Dismiss' }).click();
    restore = await breakRequests(page, 'DELETE');
    await page.getByRole('button', { name: 'Delete task: Existing' }).click();
    await expect(page.getByRole('status').filter({ hasText: SAVE_FAILED })).toBeVisible();
    await expect(todoItems(page)).toHaveCount(2);
    await expect(todoItems(page).nth(1)).toContainText('Existing');
    await restore();

    // Everything really was rolled back on the server too.
    await page.reload();
    await expect(todoItems(page)).toHaveCount(2);
    await expect(page.getByRole('checkbox', { name: 'Existing' })).toBeChecked();
    expect(navigations.length).toBe(1); // only the explicit reload above
  });
});
