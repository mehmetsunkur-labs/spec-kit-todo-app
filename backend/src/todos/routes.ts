import { parseDescription } from '@todo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { notFound, validationError } from '../errors.js';
import { getOwnerId } from './owner.js';

const createBodySchema = {
  type: 'object',
  required: ['description'],
  additionalProperties: false,
  properties: { description: { type: 'string' } },
} as const;

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const updateBodySchema = {
  type: 'object',
  required: ['completed'],
  additionalProperties: false,
  properties: { completed: { type: 'boolean' } },
} as const;

export const todoRoutes: FastifyPluginAsync = async (app) => {
  app.get('/todos', async (request) => {
    return { items: app.todos.list(getOwnerId(request)) };
  });

  app.post<{ Body: { description: string } }>(
    '/todos',
    { schema: { body: createBodySchema } },
    async (request, reply) => {
      // Same rules as the UI (FR-015): the shared schema is the source of truth.
      const parsed = parseDescription(request.body.description);
      if (!parsed.ok) {
        throw validationError(parsed.message, [{ field: 'description', message: parsed.message }]);
      }
      const todo = app.todos.create(getOwnerId(request), parsed.value);
      return reply.status(201).header('location', `/api/todos/${todo.id}`).send(todo);
    },
  );

  app.patch<{ Params: { id: string }; Body: { completed: boolean } }>(
    '/todos/:id',
    { schema: { params: idParamsSchema, body: updateBodySchema } },
    async (request) => {
      const todo = app.todos.setCompleted(
        getOwnerId(request),
        request.params.id,
        request.body.completed,
      );
      if (!todo) throw notFound();
      return todo;
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/todos/:id',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      if (!app.todos.delete(getOwnerId(request), request.params.id)) throw notFound();
      return reply.status(204).send();
    },
  );
};
