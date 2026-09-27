import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/errors.js';

// The 500 path can't be triggered through the real routes, so exercise the handler directly.
describe('errorHandler: unexpected errors', () => {
  it('returns a generic 500 INTERNAL_ERROR without leaking internals', async () => {
    const app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    app.get('/boom', async () => {
      throw new Error('SQLITE_CORRUPT: database disk image is malformed at /secret/path.db');
    });

    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Your change was not saved.',
      },
    });
    expect(res.body).not.toMatch(/SQLITE|secret|stack/i);
    await app.close();
  });
});
