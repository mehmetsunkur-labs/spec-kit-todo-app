import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, expectMatchesSchema, type TestApp } from '../helpers.js';
import { covered } from './coverage.js';

describe('PATCH /api/todos/:id', () => {
  let t: TestApp;
  let id: string;

  beforeEach(async () => {
    t = await createTestApp();
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/todos',
      payload: { description: 'Walk dog' },
    });
    id = res.json().id;
  });

  afterEach(async () => {
    await t.close();
  });

  const patch = (todoId: string, payload: unknown) =>
    t.app.inject({
      method: 'PATCH',
      url: `/api/todos/${todoId}`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });

  it('sets completed to true and returns the updated Todo', async () => {
    const res = await patch(id, { completed: true });
    expect(res.statusCode).toBe(200);
    expectMatchesSchema(res.json(), 'Todo');
    expect(res.json()).toMatchObject({ id, completed: true, description: 'Walk dog' });
    covered('PATCH', '/todos/{id}', 200);
  });

  it('is idempotent: repeating the same value returns 200 again', async () => {
    expect((await patch(id, { completed: true })).statusCode).toBe(200);
    const again = await patch(id, { completed: true });
    expect(again.statusCode).toBe(200);
    expect(again.json().completed).toBe(true);
  });

  it('sets completed back to false', async () => {
    await patch(id, { completed: true });
    const res = await patch(id, { completed: false });
    expect(res.statusCode).toBe(200);
    expect(res.json().completed).toBe(false);
  });

  it('returns 404 NOT_FOUND for a well-formed but unknown id', async () => {
    const res = await patch(crypto.randomUUID(), { completed: true });
    expect(res.statusCode).toBe(404);
    expectMatchesSchema(res.json(), 'ErrorResponse');
    expect(res.json().error).toEqual({ code: 'NOT_FOUND', message: 'This task no longer exists.' });
    covered('PATCH', '/todos/{id}', 404);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await patch('not-a-uuid', { completed: true });
    expect(res.statusCode).toBe(400);
    expectMatchesSchema(res.json(), 'ErrorResponse');
    expect(res.json().error.details[0]).toEqual({
      field: 'id',
      message: 'The task id is not valid.',
    });
    covered('PATCH', '/todos/{id}', 400);
  });

  it.each([
    ['a non-boolean completed', { completed: 'yes' }, 'completed'],
    ['a missing completed', {}, 'completed'],
    ['an extra property', { completed: true, description: 'x' }, 'description'],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, payload, field) => {
    const res = await patch(id, payload);
    expect(res.statusCode).toBe(400);
    expectMatchesSchema(res.json(), 'ErrorResponse');
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.details[0].field).toBe(field);
  });

  it('does not change the todo when the request is invalid', async () => {
    await patch(id, { completed: 'yes' });
    const { items } = (await t.app.inject({ method: 'GET', url: '/api/todos' })).json();
    expect(items[0].completed).toBe(false);
  });
});
