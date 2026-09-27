import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { resetTodos, seedTodos, todoItems } from './helpers';

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`),
  ).toEqual([]);
}

test.describe('accessibility (Constitution IV, FR-016, FR-017)', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('empty state', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('No tasks yet. Add one above to get started.')).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test('populated list with completed items and a notice', async ({ page, request }) => {
    const [first] = await seedTodos(request, ['Done already', 'Still to do']);
    await request.patch(`/api/todos/${first!.id}`, { data: { completed: true } });
    await page.goto('/');
    await expect(todoItems(page)).toHaveCount(2);
    await expectNoSeriousViolations(page);

    // With the save-failed banner visible too.
    await page.route('**/api/todos/**', (route) => route.abort('failed'));
    await page.getByRole('checkbox', { name: 'Still to do' }).click();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test('loading state', async ({ page }) => {
    await page.route('**/api/todos', () => {
      /* never answer, so the app stays in the loading state */
    });
    await page.goto('/');
    await expect(page.getByText('Loading tasks…')).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test('load error state', async ({ page }) => {
    await page.route('**/api/todos', (route) => route.fulfill({ status: 500, body: '' }));
    await page.goto('/');
    await expect(page.getByRole('alert')).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test('every control is at least 44 × 44 px on a 320 px screen', async ({ page, request }) => {
    test.skip(test.info().project.name !== 'mobile-320', 'touch-target check is for mobile');
    await seedTodos(request, ['Touch target']);
    await page.goto('/');
    await expect(todoItems(page)).toHaveCount(1);

    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button, input, a[href]')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { el: el.outerHTML.slice(0, 80), w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter(({ w, h }) => w < 44 || h < 44),
    );
    expect(small).toEqual([]);
  });
});
