import { expect, test } from '@playwright/test';
import { newTaskInput, resetTodos, todoItems } from './helpers';

// SC-003 / SC-007: actions show in under 100 ms and the list in under 1 s, with 500 todos.
const ACTION_BUDGET_MS = 100;
const LOAD_BUDGET_MS = 1000;

test.describe('performance with 500 todos', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(test.info().project.name !== 'desktop-1280', 'desktop only');
    await resetTodos(request);
    for (let i = 1; i <= 500; i++) {
      await request.post('/api/todos', { data: { description: `Task #${i}` } });
    }
  });

  test('initial list and each action are within budget', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await expect(todoItems(page).first()).toBeVisible();
    const loadMs = Date.now() - start;
    expect(loadMs, `initial list took ${loadMs} ms`).toBeLessThan(LOAD_BUDGET_MS);
    await expect(todoItems(page)).toHaveCount(500);

    /** Runs `trigger` in the page and resolves with ms until `done()` is true after a DOM change. */
    const measure = (action: 'add' | 'toggle' | 'delete') =>
      page.evaluate((kind) => {
        const list = () => document.querySelector('ul[aria-label="Tasks"]')!;
        const first = () => list().querySelector('li')!;
        const checks = {
          add: () => first().textContent?.includes('Perf add') ?? false,
          toggle: () => first().getAttribute('data-completed') === 'true',
          delete: () => !first().textContent?.includes('Perf add'),
        };
        const triggers = {
          add: () => document.querySelector('form')!.requestSubmit(),
          toggle: () => first().querySelector<HTMLInputElement>('input[type=checkbox]')!.click(),
          delete: () => first().querySelector<HTMLButtonElement>('button')!.click(),
        };
        return new Promise<number>((resolve) => {
          const t0 = performance.now();
          const observer = new MutationObserver(() => {
            if (checks[kind]()) {
              observer.disconnect();
              resolve(performance.now() - t0);
            }
          });
          observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
          });
          triggers[kind]();
        });
      }, action);

    await newTaskInput(page).fill('Perf add');
    const addMs = await measure('add');
    // Toggle and delete need the add to be confirmed (controls are disabled until saved).
    await expect(todoItems(page).first().getByRole('checkbox')).toBeEnabled();
    const toggleMs = await measure('toggle');
    await expect(todoItems(page).first().getByRole('checkbox')).toBeChecked();
    const deleteMs = await measure('delete');

    for (const [name, ms] of Object.entries({ addMs, toggleMs, deleteMs })) {
      expect(ms, `${name} took ${ms.toFixed(1)} ms`).toBeLessThan(ACTION_BUDGET_MS);
    }
    test.info().annotations.push({
      type: 'timings',
      description: `load ${loadMs} ms, add ${addMs.toFixed(1)} ms, toggle ${toggleMs.toFixed(1)} ms, delete ${deleteMs.toFixed(1)} ms`,
    });
    console.log(
      `timings: load ${loadMs} ms, add ${addMs.toFixed(1)} ms, toggle ${toggleMs.toFixed(1)} ms, delete ${deleteMs.toFixed(1)} ms`,
    );
  });
});
