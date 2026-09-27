import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { Database } from './db/connection.js';
import { errorHandler, sendNotFound } from './errors.js';
import { createSqliteTodoRepository, type TodoRepository } from './todos/repository.js';
import { todoRoutes } from './todos/routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    todos: TodoRepository;
  }
}

export interface BuildAppOptions {
  db: Database;
  logger?: FastifyServerOptions['logger'];
  /** Directory of the built frontend. Defaults to ../frontend/dist relative to the backend package. */
  staticDir?: string;
}

// src/app.ts and dist/app.js both sit one level below the backend package root.
const DEFAULT_STATIC_DIR = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));

export function buildApp({
  db,
  logger = false,
  staticDir = DEFAULT_STATIC_DIR,
}: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger,
    bodyLimit: 16 * 1024,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, allErrors: false } },
  });

  app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  });

  app.setErrorHandler(errorHandler);
  app.decorate('todos', createSqliteTodoRepository(db));

  app.get('/api/health', async () => {
    db.prepare('SELECT 1').get();
    return { status: 'ok' as const };
  });

  app.register(todoRoutes, { prefix: '/api' });

  const hasFrontend = fs.existsSync(`${staticDir}/index.html`);
  if (hasFrontend) {
    app.register(fastifyStatic, { root: staticDir, wildcard: false });
  }

  app.setNotFoundHandler((request, reply) => {
    const isApi = request.url === '/api' || request.url.startsWith('/api/');
    if (hasFrontend && !isApi && request.method === 'GET') {
      // SPA fallback: unknown non-API paths serve the app shell.
      return reply.type('text/html').sendFile('index.html');
    }
    return sendNotFound(reply);
  });

  return app;
}
