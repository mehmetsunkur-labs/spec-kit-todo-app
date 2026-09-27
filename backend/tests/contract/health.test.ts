import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, expectMatchesSchema, type TestApp } from '../helpers.js';
import { covered } from './coverage.js';

describe('GET /api/health', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.close();
  });

  it('returns 200 { status: "ok" }', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    covered('GET', '/health', 200);
  });

  it("sends a Content-Security-Policy with default-src 'self'", async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('returns a 404 error envelope for unknown API routes', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    expectMatchesSchema(res.json(), 'ErrorResponse');
  });

  it('rejects bodies over 16 KB with 400 VALIDATION_ERROR', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/todos',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ description: 'x'.repeat(20 * 1024) }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expectMatchesSchema(res.json(), 'ErrorResponse');
  });
});
