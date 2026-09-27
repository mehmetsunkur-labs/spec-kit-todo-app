import { expect, test } from '@playwright/test';
import { resetTodos, seedTodos, todoItems } from './helpers';

test.describe('US2: mark tasks as done', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
    await seedTodos(request, ['Buy milk', 'Walk dog']);
  });

  test('completes a todo, keeps it after reload, and makes it active again', async ({ page }) => {
    await page.goto('/');
    const checkbox = page.getByRole('checkbox', { name: 'Walk dog' });
    const description = todoItems(page)
      .filter({ hasText: 'Walk dog' })
      .locator('.todo-description');

    await expect(page.getByText('2 of 2 remaining')).toBeVisible();

    // US2-AS1: immediate, distinct completed appearance (not color alone)
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await expect(description).toHaveCSS('text-decoration-line', 'line-through');
    await expect(page.getByText('1 of 2 remaining')).toBeVisible();

    // US2-AS3: persists
    await page.reload();
    await expect(checkbox).toBeChecked();
    await expect(description).toHaveCSS('text-decoration-line', 'line-through');

    // US2-AS2: back to active
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
    await expect(description).toHaveCSS('text-decoration-line', 'none');
    await page.reload();
    await expect(checkbox).not.toBeChecked();
  });

  test('can be toggled with the keyboard alone (FR-017)', async ({ page }) => {
    await page.goto('/');
    const checkbox = page.getByRole('checkbox', { name: 'Buy milk' });

    // Tab from the input through the form to the first checkbox of "Buy milk".
    await page.getByRole('textbox', { name: 'New task' }).focus();
    for (
      let i = 0;
      i < 10 && !(await checkbox.evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press('Tab');
    }
    await expect(checkbox).toBeFocused();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await page.reload();
    await expect(checkbox).toBeChecked();
  });
});
