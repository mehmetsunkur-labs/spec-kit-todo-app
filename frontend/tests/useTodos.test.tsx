import type { Todo } from '@todo/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../src/api/client';
import { useTodos } from '../src/state/useTodos';
import { deferred, makeTodo } from './fixtures';

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return {
    ...actual,
    listTodos: vi.fn(),
    createTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
  };
});

const listTodos = vi.mocked(api.listTodos);
const createTodo = vi.mocked(api.createTodo);

async function renderLoaded(items: Todo[]) {
  listTodos.mockResolvedValueOnce(items);
  const hook = renderHook(() => useTodos());
  await waitFor(() => expect(hook.result.current.state.status).toBe('ready'));
  return hook;
}

describe('useTodos: loading', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('starts in loading and becomes ready with the server items', async () => {
    const items = [makeTodo(), makeTodo()];
    const load = deferred<Todo[]>();
    listTodos.mockReturnValueOnce(load.promise);

    const { result } = renderHook(() => useTodos());
    expect(result.current.state.status).toBe('loading');

    await act(async () => load.resolve(items));
    expect(result.current.state.status).toBe('ready');
    expect(result.current.state.items.map((i) => i.id)).toEqual(items.map((i) => i.id));
  });
});

describe('useTodos: add (US1)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows the new item at the top immediately, before the server answers', async () => {
    const { result } = await renderLoaded([makeTodo({ description: 'existing' })]);
    const save = deferred<Todo>();
    createTodo.mockReturnValueOnce(save.promise);

    act(() => {
      void result.current.add('Task');
    });

    const [first, second] = result.current.state.items;
    expect(first).toMatchObject({ description: 'Task', completed: false, saved: false });
    expect(first?.key).toMatch(/^temp-/);
    expect(second?.description).toBe('existing');
    expect(createTodo).toHaveBeenCalledWith('Task');
  });

  it('replaces the optimistic item with the server copy, keeping its position and key', async () => {
    const { result } = await renderLoaded([makeTodo({ description: 'existing' })]);
    const server = makeTodo({ description: 'Task' });
    createTodo.mockResolvedValueOnce(server);

    let ok: boolean | undefined;
    act(() => {
      void result.current.add('Task').then((r) => (ok = r));
    });
    const tempKey = result.current.state.items[0]!.key;

    await waitFor(() => expect(ok).toBe(true));
    expect(result.current.state.items[0]).toMatchObject({
      ...server,
      key: tempKey,
      saved: true,
    });
    expect(result.current.state.items).toHaveLength(2);
  });
});

describe('useTodos: toggle (US2)', () => {
  const updateTodo = vi.mocked(api.updateTodo);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows the new status immediately and sends the absolute value', async () => {
    const todo = makeTodo();
    const { result } = await renderLoaded([todo]);
    const save = deferred<Todo>();
    updateTodo.mockReturnValueOnce(save.promise);

    act(() => result.current.toggle(todo.id, true));

    expect(result.current.state.items[0]?.completed).toBe(true);
    expect(updateTodo).toHaveBeenCalledWith(todo.id, true);

    const server = { ...todo, completed: true, updatedAt: '2026-09-27T11:00:00.000Z' };
    await act(async () => save.resolve(server));
    expect(result.current.state.items[0]).toMatchObject({ ...server, confirmedCompleted: true });
  });

  it('serializes requests per item so out-of-order responses cannot win (F2)', async () => {
    const todo = makeTodo();
    const { result } = await renderLoaded([todo]);
    const first = deferred<Todo>();
    const second = deferred<Todo>();
    updateTodo.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    act(() => result.current.toggle(todo.id, true));
    act(() => result.current.toggle(todo.id, false));

    // Only one request in flight; the UI already shows the latest choice.
    expect(updateTodo).toHaveBeenCalledTimes(1);
    expect(result.current.state.items[0]?.completed).toBe(false);

    // The first (stale) response arrives: it must not flip the UI back to true.
    await act(async () => first.resolve({ ...todo, completed: true }));
    expect(result.current.state.items[0]?.completed).toBe(false);
    expect(updateTodo).toHaveBeenCalledTimes(2);
    expect(updateTodo).toHaveBeenLastCalledWith(todo.id, false);

    await act(async () => second.resolve({ ...todo, completed: false }));
    expect(result.current.state.items[0]).toMatchObject({
      completed: false,
      confirmedCompleted: false,
    });
  });

  it('coalesces rapid toggles: true, false, true sends at most two requests and ends true', async () => {
    const todo = makeTodo();
    const { result } = await renderLoaded([todo]);
    const first = deferred<Todo>();
    updateTodo.mockReturnValueOnce(first.promise).mockResolvedValue({ ...todo, completed: true });

    act(() => result.current.toggle(todo.id, true));
    act(() => result.current.toggle(todo.id, false));
    act(() => result.current.toggle(todo.id, true));
    await act(async () => first.resolve({ ...todo, completed: true }));

    await waitFor(() => expect(result.current.state.items[0]?.confirmedCompleted).toBe(true));
    expect(updateTodo.mock.calls.length).toBeLessThanOrEqual(2);
    expect(result.current.state.items[0]?.completed).toBe(true);
  });

  it('ignores toggles on a todo that is still being saved', async () => {
    const { result } = await renderLoaded([]);
    const save = deferred<Todo>();
    vi.mocked(api.createTodo).mockReturnValueOnce(save.promise);

    act(() => {
      void result.current.add('New');
    });
    const key = result.current.state.items[0]!.key;
    act(() => result.current.toggle(key, true));

    expect(updateTodo).not.toHaveBeenCalled();
    expect(result.current.state.items[0]?.completed).toBe(false);
  });
});

describe('useTodos: remove (US3)', () => {
  const deleteTodo = vi.mocked(api.deleteTodo);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('removes the item immediately, before the server answers, and calls deleteTodo', async () => {
    const [a, b, c] = [makeTodo(), makeTodo(), makeTodo()];
    const { result } = await renderLoaded([a!, b!, c!]);
    const save = deferred<void>();
    deleteTodo.mockReturnValueOnce(save.promise);

    act(() => result.current.remove(b!.id));

    expect(result.current.state.items.map((i) => i.id)).toEqual([a!.id, c!.id]);
    expect(deleteTodo).toHaveBeenCalledWith(b!.id);

    await act(async () => save.resolve());
    expect(result.current.state.items.map((i) => i.id)).toEqual([a!.id, c!.id]);
    expect(result.current.state.notice).toBeNull();
  });

  it('ignores a second remove of the same item', async () => {
    const todo = makeTodo();
    const { result } = await renderLoaded([todo]);
    deleteTodo.mockResolvedValue(undefined);

    act(() => result.current.remove(todo.id));
    act(() => result.current.remove(todo.id));

    expect(deleteTodo).toHaveBeenCalledTimes(1);
  });
});

describe('useTodos: failures and rollback (US4)', () => {
  const updateTodo = vi.mocked(api.updateTodo);
  const deleteTodo = vi.mocked(api.deleteTodo);
  const SAVE_FAILED = "Couldn't save your change. Please try again.";
  const NOT_FOUND = 'This task no longer exists.';
  const networkError = () => new api.ApiError(0, 'NETWORK_ERROR', "Couldn't reach the server.");
  const notFoundError = () => new api.ApiError(404, 'NOT_FOUND', NOT_FOUND);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('goes to the error state when loading fails, and reload() recovers', async () => {
    listTodos.mockRejectedValueOnce(networkError());
    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.state.status).toBe('error'));

    const retry = deferred<Todo[]>();
    listTodos.mockReturnValueOnce(retry.promise);
    act(() => {
      void result.current.reload();
    });
    expect(result.current.state.status).toBe('loading');

    await act(async () => retry.resolve([makeTodo()]));
    expect(result.current.state.status).toBe('ready');
    expect(result.current.state.items).toHaveLength(1);
  });

  it('removes the optimistic item and reports the failure when add fails', async () => {
    const existing = makeTodo();
    const { result } = await renderLoaded([existing]);
    createTodo.mockRejectedValueOnce(networkError());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.add('Will fail');
    });

    expect(ok).toBe(false);
    expect(result.current.state.items.map((i) => i.id)).toEqual([existing.id]);
    expect(result.current.state.notice).toEqual({ kind: 'error', message: SAVE_FAILED });
  });

  it('shows the server message when the server rejects an add as invalid', async () => {
    const { result } = await renderLoaded([]);
    createTodo.mockRejectedValueOnce(
      new api.ApiError(400, 'VALIDATION_ERROR', 'Descriptions can be at most 500 characters.'),
    );
    await act(async () => {
      await result.current.add('x');
    });
    expect(result.current.state.notice?.message).toBe(
      'Descriptions can be at most 500 characters.',
    );
  });

  it('reverts a failed toggle to the last confirmed value and drops any queued value', async () => {
    const todo = makeTodo({ completed: false });
    const { result } = await renderLoaded([todo]);
    const first = deferred<Todo>();
    updateTodo.mockReturnValueOnce(first.promise);

    act(() => result.current.toggle(todo.id, true));
    act(() => result.current.toggle(todo.id, false));
    act(() => result.current.toggle(todo.id, true));
    await act(async () => first.reject(networkError()));

    expect(result.current.state.items[0]).toMatchObject({
      completed: false,
      confirmedCompleted: false,
    });
    expect(result.current.state.notice?.message).toBe(SAVE_FAILED);
    expect(updateTodo).toHaveBeenCalledTimes(1);
  });

  it('puts a todo back at its original position when delete fails', async () => {
    const items = [makeTodo(), makeTodo(), makeTodo()];
    const { result } = await renderLoaded(items);
    deleteTodo.mockRejectedValueOnce(networkError());

    await act(async () => result.current.remove(items[1]!.id));

    await waitFor(() =>
      expect(result.current.state.items.map((i) => i.id)).toEqual(items.map((i) => i.id)),
    );
    expect(result.current.state.notice?.message).toBe(SAVE_FAILED);
  });

  it.each(['toggle', 'remove'] as const)(
    'on NOT_FOUND during %s, says the task no longer exists and refreshes the list',
    async (action) => {
      const [gone, kept] = [makeTodo(), makeTodo()];
      const { result } = await renderLoaded([gone!, kept!]);
      updateTodo.mockRejectedValueOnce(notFoundError());
      deleteTodo.mockRejectedValueOnce(notFoundError());
      listTodos.mockResolvedValueOnce([kept!]);

      await act(async () => {
        if (action === 'toggle') result.current.toggle(gone!.id, true);
        else result.current.remove(gone!.id);
      });

      await waitFor(() => expect(result.current.state.notice?.message).toBe(NOT_FOUND));
      await waitFor(() => expect(result.current.state.items.map((i) => i.id)).toEqual([kept!.id]));
      expect(listTodos).toHaveBeenCalledTimes(2);
      // A background refresh does not flash the loading state.
      expect(result.current.state.status).toBe('ready');
    },
  );

  it('keeps other items and their pending changes when one item fails', async () => {
    const [a, b] = [makeTodo(), makeTodo()];
    const { result } = await renderLoaded([a!, b!]);
    const bSave = deferred<Todo>();
    updateTodo.mockImplementation((id) =>
      id === a!.id ? Promise.reject(networkError()) : bSave.promise,
    );

    act(() => result.current.toggle(b!.id, true));
    await act(async () => result.current.toggle(a!.id, true));

    expect(result.current.state.items[0]).toMatchObject({ id: a!.id, completed: false });
    expect(result.current.state.items[1]).toMatchObject({ id: b!.id, completed: true });

    await act(async () => bSave.resolve({ ...b!, completed: true }));
    expect(result.current.state.items[1]).toMatchObject({
      completed: true,
      confirmedCompleted: true,
    });
  });

  it('keeps an in-flight add when a background refresh happens', async () => {
    const [gone, kept] = [makeTodo(), makeTodo()];
    const { result } = await renderLoaded([gone!, kept!]);
    const addSave = deferred<Todo>();
    createTodo.mockReturnValueOnce(addSave.promise);
    deleteTodo.mockRejectedValueOnce(notFoundError());
    listTodos.mockResolvedValueOnce([kept!]);

    act(() => {
      void result.current.add('pending add');
    });
    await act(async () => result.current.remove(gone!.id));
    await waitFor(() => expect(listTodos).toHaveBeenCalledTimes(2));

    expect(result.current.state.items[0]).toMatchObject({
      description: 'pending add',
      saved: false,
    });
    await act(async () => addSave.resolve(makeTodo({ description: 'pending add' })));
    expect(result.current.state.items[0]).toMatchObject({
      description: 'pending add',
      saved: true,
    });
  });
});
