import type { Todo } from '@todo/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createTodo, deleteTodo, listTodos, updateTodo } from '../src/api/client';

const todo: Todo = {
  id: '3f2b8c1e-6a4d-4b7e-9c2a-1d5e8f0a7b6c',
  description: 'Buy milk',
  completed: false,
  createdAt: '2026-09-27T10:15:30.123Z',
  updatedAt: '2026-09-27T10:15:30.123Z',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('listTodos returns the items array', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [todo] }));
    await expect(listTodos()).resolves.toEqual([todo]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/todos',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('createTodo POSTs JSON and returns the created todo', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, todo));
    await expect(createTodo('Buy milk')).resolves.toEqual(todo);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/todos');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ description: 'Buy milk' }));
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });

  it('updateTodo PATCHes the absolute completed value', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...todo, completed: true }));
    await expect(updateTodo(todo.id, true)).resolves.toMatchObject({ completed: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/todos/${todo.id}`);
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe(JSON.stringify({ completed: true }));
  });

  it('deleteTodo resolves to undefined on 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(deleteTodo(todo.id)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]![1]?.method).toBe('DELETE');
  });

  it('turns an error envelope into an ApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'This task no longer exists.' } }),
    );
    const error = await updateTodo(todo.id, true).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'This task no longer exists.',
    });
  });

  it('keeps validation details', async () => {
    const details = [{ field: 'description', message: 'Please enter a task description.' }];
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Please enter a task description.', details },
      }),
    );
    await expect(createTodo('')).rejects.toMatchObject({ status: 400, details });
  });

  it('turns a network failure into a NETWORK_ERROR ApiError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(listTodos()).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: "Couldn't reach the server.",
    });
  });

  it('turns a non-JSON error response into an INTERNAL_ERROR ApiError', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(listTodos()).rejects.toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });
});
