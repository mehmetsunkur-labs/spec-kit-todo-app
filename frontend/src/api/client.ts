import type { ErrorDetail, ErrorResponse, ListTodosResponse, Todo } from '@todo/shared';

export type ClientErrorCode = ErrorResponse['error']['code'] | 'NETWORK_ERROR';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

function isErrorResponse(body: unknown): body is ErrorResponse {
  const error = (body as ErrorResponse | null)?.error;
  return typeof error?.code === 'string' && typeof error.message === 'string';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers:
        body === undefined
          ? { accept: 'application/json' }
          : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "Couldn't reach the server.");
  }

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    if (isErrorResponse(data)) {
      throw new ApiError(response.status, data.error.code, data.error.message, data.error.details);
    }
    throw new ApiError(response.status, 'INTERNAL_ERROR', 'Something went wrong.');
  }

  return data as T;
}

export async function listTodos(): Promise<Todo[]> {
  const { items } = await request<ListTodosResponse>('GET', '/todos');
  return items;
}

export function createTodo(description: string): Promise<Todo> {
  return request<Todo>('POST', '/todos', { description });
}

export function updateTodo(id: string, completed: boolean): Promise<Todo> {
  return request<Todo>('PATCH', `/todos/${encodeURIComponent(id)}`, { completed });
}

export function deleteTodo(id: string): Promise<void> {
  return request<void>('DELETE', `/todos/${encodeURIComponent(id)}`);
}
