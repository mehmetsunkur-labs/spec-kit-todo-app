import { expect, test } from '@playwright/test';
import { newTaskInput, resetTodos, todoItems } from './helpers';

test.describe('US1: add tasks and see them', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('shows the empty state when there are no todos (US1-AS1)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Todos' })).toBeVisible();
    await expect(page.getByText('No tasks yet. Add one above to get started.')).toBeVisible();
  });

  test('adds todos at the top immediately and keeps them after a reload (US1-AS2, AS3)', async ({
    page,
  }) => {
    await page.goto('/');
    const input = newTaskInput(page);

    for (const description of ['One', 'Two', 'Three']) {
      await input.fill(description);
      await input.press('Enter');
      await expect(todoItems(page).first()).toContainText(description);
      await expect(input).toHaveValue('');
      await expect(input).toBeFocused();
    }
    await expect(todoItems(page)).toHaveCount(3);
    // Wait until every optimistic add is confirmed (controls enable once saved).
    for (const checkbox of await todoItems(page).getByRole('checkbox').all()) {
      await expect(checkbox).toBeEnabled();
    }

    const timesBefore = await todoItems(page)
      .locator('time')
      .evaluateAll((els) => els.map((el) => el.getAttribute('datetime')));

    await page.reload();
    await expect(todoItems(page)).toHaveCount(3);
    await expect(todoItems(page).nth(0)).toContainText('Three');
    await expect(todoItems(page).nth(1)).toContainText('Two');
    await expect(todoItems(page).nth(2)).toContainText('One');

    const timesAfter = await todoItems(page)
      .locator('time')
      .evaluateAll((els) => els.map((el) => el.getAttribute('datetime')));
    expect(timesAfter).toEqual(timesBefore);
  });

  test('does not create a todo from whitespace (US1-AS4)', async ({ page }) => {
    await page.goto('/');
    const input = newTaskInput(page);
    await input.fill('    ');
    await input.press('Enter');
    await expect(page.getByText('Please enter a task description.')).toBeVisible();
    await expect(page.getByText('No tasks yet. Add one above to get started.')).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('trims leading and trailing spaces', async ({ page }) => {
    await page.goto('/');
    const input = newTaskInput(page);
    await input.fill('   Buy milk   ');
    await input.press('Enter');
    await expect(todoItems(page).first().locator('.todo-description')).toHaveText('Buy milk');
    await page.reload();
    await expect(todoItems(page).first().locator('.todo-description')).toHaveText('Buy milk');
  });
});
