import type { APIRequestContext, Locator, Page } from '@playwright/test';

interface Todo {
  id: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Deletes every todo through the API so each test starts from an empty list. */
export async function resetTodos(request: APIRequestContext): Promise<void> {
  const res = await request.get('/api/todos');
  const { items } = (await res.json()) as { items: Todo[] };
  for (const todo of items) {
    await request.delete(`/api/todos/${todo.id}`);
  }
}

/** Creates todos in the given order (so the last one is newest and shown first). */
export async function seedTodos(
  request: APIRequestContext,
  descriptions: string[],
): Promise<Todo[]> {
  const created: Todo[] = [];
  for (const description of descriptions) {
    const res = await request.post('/api/todos', { data: { description } });
    if (res.status() !== 201) throw new Error(`seed failed: ${res.status()} ${await res.text()}`);
    created.push((await res.json()) as Todo);
  }
  return created;
}

export function todoList(page: Page): Locator {
  return page.getByRole('list', { name: 'Tasks' });
}

export function todoItems(page: Page): Locator {
  return todoList(page).getByRole('listitem');
}

export function newTaskInput(page: Page): Locator {
  return page.getByRole('textbox', { name: 'New task' });
}
