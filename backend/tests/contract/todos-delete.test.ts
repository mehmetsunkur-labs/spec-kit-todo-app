import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, expectMatchesSchema, type TestApp } from '../helpers.js';
import { covered } from './coverage.js';

describe('DELETE /api/todos/:id', () => {
  let t: TestApp;
  let ids: string[];

  beforeEach(async () => {
    t = await createTestApp();
    ids = [];
    for (const description of ['One', 'Two', 'Three']) {
      const res = await t.app.inject({
        method: 'POST',
        url: '/api/todos',
        payload: { description },
      });
      ids.push(res.json().id);
    }
  });

  afterEach(async () => {
    await t.close();
  });

  const del = (id: string) => t.app.inject({ method: 'DELETE', url: `/api/todos/${id}` });

  it('returns 204 with an empty body', async () => {
    const res = await del(ids[1]!);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    covered('DELETE', '/todos/{id}', 204);
  });

  it('removes only that todo from the list', async () => {
    const before = (await t.app.inject({ method: 'GET', url: '/api/todos' })).json().items;
    await del(ids[1]!);
    const after = (await t.app.inject({ method: 'GET', url: '/api/todos' })).json().items;
    expect(after).toEqual(before.filter((todo: { id: string }) => todo.id !== ids[1]));
  });

  it('returns 404 NOT_FOUND when the todo was already deleted', async () => {
    await del(ids[0]!);
    const res = await del(ids[0]!);
    expect(res.statusCode).toBe(404);
    expectMatchesSchema(res.json(), 'ErrorResponse');
    expect(res.json().error).toEqual({ code: 'NOT_FOUND', message: 'This task no longer exists.' });
    covered('DELETE', '/todos/{id}', 404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await del('not-a-uuid');
    expect(res.statusCode).toBe(400);
    expectMatchesSchema(res.json(), 'ErrorResponse');
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    covered('DELETE', '/todos/{id}', 400);
  });
});
