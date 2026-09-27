import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqliteTodoRepository } from '../../src/todos/repository.js';
import { createTestApp, type TestApp } from '../helpers.js';

// Plan goal: API p95 under 50 ms with 500 todos (analysis F8).
const P95_BUDGET_MS = 50;
const RUNS = 200;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!;
}

async function time(fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

describe('API latency with 500 todos', () => {
  let t: TestApp;
  let ids: string[];

  beforeAll(async () => {
    t = await createTestApp();
    const repo = createSqliteTodoRepository(t.db);
    ids = t.db.transaction(() =>
      Array.from({ length: 500 }, (_, i) => repo.create('local', `Task #${i + 1}`).id),
    )();
  });

  afterAll(async () => {
    await t.close();
  });

  it('GET /api/todos p95 is under budget', async () => {
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      samples.push(await time(() => t.app.inject({ method: 'GET', url: '/api/todos' })));
    }
    expect(p95(samples)).toBeLessThan(P95_BUDGET_MS);
  });

  it('POST /api/todos p95 is under budget', async () => {
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      samples.push(
        await time(() =>
          t.app.inject({ method: 'POST', url: '/api/todos', payload: { description: `New ${i}` } }),
        ),
      );
    }
    expect(p95(samples)).toBeLessThan(P95_BUDGET_MS);
  });

  it('PATCH /api/todos/:id p95 is under budget', async () => {
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      samples.push(
        await time(() =>
          t.app.inject({
            method: 'PATCH',
            url: `/api/todos/${ids[i]}`,
            payload: { completed: i % 2 === 0 },
          }),
        ),
      );
    }
    expect(p95(samples)).toBeLessThan(P95_BUDGET_MS);
  });

  it('DELETE /api/todos/:id p95 is under budget', async () => {
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const id = ids[ids.length - 1 - i];
      samples.push(await time(() => t.app.inject({ method: 'DELETE', url: `/api/todos/${id}` })));
    }
    expect(p95(samples)).toBeLessThan(P95_BUDGET_MS);
  });
});
