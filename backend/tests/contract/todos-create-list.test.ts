import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, expectMatchesSchema, type TestApp } from '../helpers.js';
import { covered } from './coverage.js';

describe('POST /api/todos and GET /api/todos', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.close();
  });

  const post = (payload: unknown, raw = false) =>
    t.app.inject({
      method: 'POST',
      url: '/api/todos',
      headers: { 'content-type': 'application/json' },
      payload: raw ? (payload as string) : JSON.stringify(payload),
    });

  it('GET on an empty database returns { items: [] }', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/todos' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [] });
    covered('GET', '/todos', 200);
  });

  it('POST trims the description, returns 201 with a Location header and an active Todo', async () => {
    const res = await post({ description: '  Buy milk  ' });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expectMatchesSchema(body, 'Todo');
    expect(body).toMatchObject({ description: 'Buy milk', completed: false });
    expect(res.headers.location).toBe(`/api/todos/${body.id}`);
    covered('POST', '/todos', 201);
  });

  it('GET lists created todos newest first, each matching the Todo schema', async () => {
    for (const description of ['One', 'Two', 'Three']) {
      expect((await post({ description })).statusCode).toBe(201);
    }
    const res = await t.app.inject({ method: 'GET', url: '/api/todos' });
    const { items } = res.json();
    expect(items.map((i: { description: string }) => i.description)).toEqual([
      'Three',
      'Two',
      'One',
    ]);
    for (const item of items) expectMatchesSchema(item, 'Todo');
  });

  it.each([
    ['empty string', { description: '' }, 'description', 'Please enter a task description.'],
    ['whitespace only', { description: '   ' }, 'description', 'Please enter a task description.'],
    [
      '501 characters',
      { description: 'a'.repeat(501) },
      'description',
      'Descriptions can be at most 500 characters.',
    ],
    [
      'a newline',
      { description: 'a\nb' },
      'description',
      'Descriptions must be a single line of text.',
    ],
    ['a missing description', {}, 'description', 'Please enter a task description.'],
    [
      'a non-string description',
      { description: 5 },
      'description',
      'Please enter a task description.',
    ],
    [
      'an extra property',
      { description: 'x', completed: true },
      'completed',
      'Unknown field "completed".',
    ],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, payload, field, message) => {
    const res = await post(payload);
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expectMatchesSchema(body, 'ErrorResponse');
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe(message);
    expect(body.error.details[0]).toEqual({ field, message });
    covered('POST', '/todos', 400);
  });

  it('rejects invalid JSON with 400 VALIDATION_ERROR', async () => {
    const res = await post('{"description": ', true);
    expect(res.statusCode).toBe(400);
    expectMatchesSchema(res.json(), 'ErrorResponse');
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('never saves an invalid todo', async () => {
    await post({ description: '   ' });
    await post({ description: 'a'.repeat(501) });
    const res = await t.app.inject({ method: 'GET', url: '/api/todos' });
    expect(res.json()).toEqual({ items: [] });
  });

  it('accepts 500 emoji (length is counted in code points)', async () => {
    const description = '🎉'.repeat(500);
    const res = await post({ description });
    expect(res.statusCode).toBe(201);
    expect(res.json().description).toBe(description);
  });

  it('returns markup-looking text byte for byte, unescaped', async () => {
    const description = '<img src=x onerror=alert(1)> & "quotes"';
    const res = await post({ description });
    expect(res.json().description).toBe(description);
    expect(res.body).not.toContain('&lt;');
  });
});
