import type { Todo } from '@todo/shared';

let n = 0;

export function makeTodo(overrides: Partial<Todo> = {}): Todo {
  n += 1;
  const id = overrides.id ?? `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const createdAt = overrides.createdAt ?? new Date(Date.UTC(2026, 8, 27, 10, 0, n)).toISOString();
  return {
    id,
    description: `Task ${n}`,
    completed: false,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

/** A promise whose resolution the test controls. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
