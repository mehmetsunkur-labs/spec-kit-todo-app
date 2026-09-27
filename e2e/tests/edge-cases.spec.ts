import { expect, test } from '@playwright/test';
import { newTaskInput, resetTodos, seedTodos, todoItems } from './helpers';

test.describe('edge cases', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('shows markup as literal text and never runs it (FR-018)', async ({ page }) => {
    page.on('dialog', () => {
      throw new Error('a dialog opened: user text was executed');
    });
    await page.goto('/');
    const payload = '<img src=x onerror=alert(1)>';
    await newTaskInput(page).fill(payload);
    await newTaskInput(page).press('Enter');
    await expect(todoItems(page).first().locator('.todo-description')).toHaveText(payload);
    await page.reload();
    await expect(todoItems(page).first().locator('.todo-description')).toHaveText(payload);
    await expect(page.locator('main img')).toHaveCount(0);
  });

  test('stores and shows non-Latin text and emoji exactly', async ({ page }) => {
    await page.goto('/');
    const text = '日本語テキスト 🎉 Ünïcödé';
    await newTaskInput(page).fill(text);
    await newTaskInput(page).press('Enter');
    await page.reload();
    await expect(todoItems(page).first().locator('.todo-description')).toHaveText(text);
  });

  test('wraps a 500-character word without horizontal scrolling (FR-016)', async ({ page }) => {
    await page.goto('/');
    await newTaskInput(page).fill('W'.repeat(500));
    await newTaskInput(page).press('Enter');
    await expect(todoItems(page)).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('rejects 501 characters but accepts 500 emoji', async ({ page }) => {
    await page.goto('/');
    const input = newTaskInput(page);
    await input.fill('a'.repeat(501));
    await input.press('Enter');
    await expect(page.getByText('Descriptions can be at most 500 characters.')).toBeVisible();
    await expect(page.getByText('No tasks yet. Add one above to get started.')).toBeVisible();

    await input.fill('🎉'.repeat(500));
    await expect(page.getByText('500/500')).toBeVisible();
    await input.press('Enter');
    await expect(todoItems(page)).toHaveCount(1);
    await page.reload();
    await expect(todoItems(page).first().locator('.todo-description')).toHaveText('🎉'.repeat(500));
  });

  test('rapid clicks on a checkbox end in a consistent state', async ({ page, request }) => {
    await seedTodos(request, ['Rapid']);
    await page.goto('/');
    const checkbox = page.getByRole('checkbox', { name: 'Rapid' });
    for (let i = 0; i < 5; i++) await checkbox.click({ delay: 0 });
    await expect(checkbox).toBeChecked(); // odd number of clicks
    await expect(page.getByText("Couldn't save your change. Please try again.")).toHaveCount(0);
    await page.reload();
    await expect(checkbox).toBeChecked();
  });

  test('double-clicking delete removes only that todo', async ({ page, request }) => {
    await seedTodos(request, ['Keep 1', 'Remove me', 'Keep 2']); // shown: Keep 2, Remove me, Keep 1
    await page.goto('/');
    await page.getByRole('button', { name: 'Delete task: Remove me' }).dblclick();
    await expect(todoItems(page)).toHaveCount(2);
    await expect(page.getByText("Couldn't save your change. Please try again.")).toHaveCount(0);
    await page.reload();
    await expect(todoItems(page)).toHaveCount(2);
    await expect(page.getByText('Remove me')).toHaveCount(0);
  });

  test('a todo deleted in another tab is reported and the list refreshes', async ({ context }) => {
    const [pageA, pageB] = [await context.newPage(), await context.newPage()];
    await pageA.request.post('/api/todos', { data: { description: 'Shared' } });
    await pageA.request.post('/api/todos', { data: { description: 'Other' } });
    await pageA.goto('/');
    await pageB.goto('/');
    await expect(todoItems(pageB)).toHaveCount(2);

    await pageA.getByRole('button', { name: 'Delete task: Shared' }).click();
    await expect(todoItems(pageA)).toHaveCount(1);

    await pageB.getByRole('checkbox', { name: 'Shared' }).click();
    await expect(pageB.getByText('This task no longer exists.')).toBeVisible();
    await expect(todoItems(pageB)).toHaveCount(1);
    await expect(todoItems(pageB).first()).toContainText('Other');
  });
});
