import { expect, test } from '@playwright/test';
import { newTaskInput, resetTodos, seedTodos, todoItems } from './helpers';

test.describe('US3: remove tasks', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('deletes immediately, stays gone after reload, and shows the empty state at the end', async ({
    page,
    request,
  }) => {
    await seedTodos(request, ['One', 'Two', 'Three']); // shown as Three, Two, One
    await page.goto('/');
    await expect(todoItems(page)).toHaveCount(3);

    // US3-AS1: gone at once; focus lands on the next item
    await page.getByRole('button', { name: 'Delete task: Two' }).click();
    await expect(todoItems(page)).toHaveCount(2);
    await expect(page.getByText('Two', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'One' })).toBeFocused();

    // US3-AS2: persists; the others are unchanged
    await page.reload();
    await expect(todoItems(page)).toHaveCount(2);
    await expect(todoItems(page).nth(0)).toContainText('Three');
    await expect(todoItems(page).nth(1)).toContainText('One');

    // US3-AS3: deleting the rest shows the empty state
    await page.getByRole('button', { name: 'Delete task: Three' }).click();
    await page.getByRole('button', { name: 'Delete task: One' }).click();
    await expect(page.getByText('No tasks yet. Add one above to get started.')).toBeVisible();
  });

  test('can delete with the keyboard alone (FR-017)', async ({ page, request }) => {
    await seedTodos(request, ['First', 'Second']); // shown as Second, First
    await page.goto('/');

    const deleteSecond = page.getByRole('button', { name: 'Delete task: Second' });
    await newTaskInput(page).focus();
    for (
      let i = 0;
      i < 10 && !(await deleteSecond.evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press('Tab');
    }
    await expect(deleteSecond).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(todoItems(page)).toHaveCount(1);
    await expect(page.getByRole('checkbox', { name: 'First' })).toBeFocused();

    // Tab from the checkbox to its delete button, then Enter: focus goes back to the input.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Delete task: First' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('No tasks yet. Add one above to get started.')).toBeVisible();
    await expect(newTaskInput(page)).toBeFocused();
  });
});
