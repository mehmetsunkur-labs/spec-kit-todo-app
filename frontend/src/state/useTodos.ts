import type { Todo } from '@todo/shared';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { ApiError, createTodo, deleteTodo, listTodos, updateTodo } from '../api/client';

/** A todo as the UI sees it, including transient client-only state (data-model.md). */
export interface ViewTodo extends Todo {
  /** Stable React key: the server id, or `temp-<n>` for todos added in this session. */
  key: string;
  /** False while an optimistic add is waiting for the server. */
  saved: boolean;
  /** The last completion value the server confirmed (used for rollback). */
  confirmedCompleted: boolean;
}

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface Notice {
  kind: 'error' | 'info';
  message: string;
}

export interface TodosState {
  status: LoadStatus;
  items: ViewTodo[];
  notice: Notice | null;
}

export type TodosAction =
  | { type: 'loadStart' }
  | { type: 'loadSuccess'; items: Todo[] }
  | { type: 'loadFailure' }
  /** Background refresh: replaces saved items, keeps adds still waiting for the server. */
  | { type: 'refreshed'; items: Todo[] }
  | { type: 'addOptimistic'; key: string; description: string; now: string }
  | { type: 'addConfirmed'; key: string; todo: Todo }
  | { type: 'addFailed'; key: string; notice: Notice }
  | { type: 'toggleOptimistic'; key: string; completed: boolean }
  /** The server confirmed a value, but the user has since asked for another one. */
  | { type: 'toggleAcknowledged'; key: string; completed: boolean }
  | { type: 'toggleConfirmed'; key: string; todo: Todo }
  | { type: 'toggleFailed'; key: string; notice: Notice }
  | { type: 'removeOptimistic'; key: string }
  /** Puts a todo back where it was after a failed delete. */
  | { type: 'removeFailed'; item: ViewTodo; index: number; notice: Notice }
  | { type: 'notify'; notice: Notice }
  | { type: 'dismissNotice' };

export const initialState: TodosState = { status: 'loading', items: [], notice: null };

export const SAVE_FAILED_MESSAGE = "Couldn't save your change. Please try again.";
export const NOT_FOUND_MESSAGE = 'This task no longer exists.';

function fromServer(todo: Todo, key: string = todo.id): ViewTodo {
  return { ...todo, key, saved: true, confirmedCompleted: todo.completed };
}

function mapItem(items: ViewTodo[], key: string, fn: (item: ViewTodo) => ViewTodo): ViewTodo[] {
  return items.map((item) => (item.key === key ? fn(item) : item));
}

export function todosReducer(state: TodosState, action: TodosAction): TodosState {
  switch (action.type) {
    case 'loadStart':
      return { ...state, status: 'loading' };

    case 'loadSuccess':
      return { ...state, status: 'ready', items: action.items.map((todo) => fromServer(todo)) };

    case 'loadFailure':
      return { ...state, status: 'error' };

    case 'refreshed': {
      const unsaved = state.items.filter((item) => !item.saved);
      return { ...state, items: [...unsaved, ...action.items.map((todo) => fromServer(todo))] };
    }

    case 'addOptimistic': {
      const item: ViewTodo = {
        key: action.key,
        id: '',
        description: action.description,
        completed: false,
        createdAt: action.now,
        updatedAt: action.now,
        saved: false,
        confirmedCompleted: false,
      };
      return { ...state, items: [item, ...state.items] };
    }

    case 'addConfirmed':
      return {
        ...state,
        items: mapItem(state.items, action.key, () => fromServer(action.todo, action.key)),
      };

    case 'addFailed':
      return {
        ...state,
        items: state.items.filter((item) => item.key !== action.key),
        notice: action.notice,
      };

    case 'toggleOptimistic':
      return {
        ...state,
        items: mapItem(state.items, action.key, (item) => ({
          ...item,
          completed: action.completed,
        })),
      };

    case 'toggleAcknowledged':
      return {
        ...state,
        items: mapItem(state.items, action.key, (item) => ({
          ...item,
          confirmedCompleted: action.completed,
        })),
      };

    case 'toggleConfirmed':
      return {
        ...state,
        items: mapItem(state.items, action.key, () => fromServer(action.todo, action.key)),
      };

    case 'toggleFailed':
      return {
        ...state,
        items: mapItem(state.items, action.key, (item) => ({
          ...item,
          completed: item.confirmedCompleted,
        })),
        notice: action.notice,
      };

    case 'removeOptimistic':
      return { ...state, items: state.items.filter((item) => item.key !== action.key) };

    case 'removeFailed': {
      if (state.items.some((item) => item.key === action.item.key)) {
        return { ...state, notice: action.notice };
      }
      const items = [...state.items];
      items.splice(Math.min(action.index, items.length), 0, action.item);
      return { ...state, items, notice: action.notice };
    }

    case 'notify':
      return { ...state, notice: action.notice };

    case 'dismissNotice':
      return { ...state, notice: null };
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'NOT_FOUND';
}

/** The message for a failed save: the server's own message for invalid input, else a generic one. */
function saveFailedNotice(error: unknown): Notice {
  if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
    return { kind: 'error', message: error.message };
  }
  return { kind: 'error', message: SAVE_FAILED_MESSAGE };
}

const notFoundNotice: Notice = { kind: 'error', message: NOT_FOUND_MESSAGE };

export function useTodos() {
  const [state, dispatch] = useReducer(todosReducer, initialState);
  const nextTempId = useRef(0);

  // Latest items for use inside async callbacks (kept in sync after each render).
  const itemsRef = useRef(state.items);
  useEffect(() => {
    itemsRef.current = state.items;
  }, [state.items]);

  // Per-item toggle queue (research §7): at most one PATCH in flight per todo, and the latest
  // requested value always wins, so out-of-order responses can never overwrite a newer choice.
  const desiredCompleted = useRef(new Map<string, boolean>());
  const toggleInFlight = useRef(new Set<string>());
  const removing = useRef(new Set<string>());

  const reload = useCallback(async () => {
    dispatch({ type: 'loadStart' });
    try {
      dispatch({ type: 'loadSuccess', items: await listTodos() });
    } catch {
      dispatch({ type: 'loadFailure' });
    }
  }, []);

  /** Re-fetches the list without showing the loading state (e.g. after NOT_FOUND). */
  const refresh = useCallback(async () => {
    try {
      dispatch({ type: 'refreshed', items: await listTodos() });
    } catch {
      // Keep showing what we have; the user has already been told about the failure.
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(async (description: string): Promise<boolean> => {
    nextTempId.current += 1;
    const key = `temp-${nextTempId.current}`;
    dispatch({ type: 'addOptimistic', key, description, now: new Date().toISOString() });
    try {
      const todo = await createTodo(description);
      dispatch({ type: 'addConfirmed', key, todo });
      return true;
    } catch (error) {
      dispatch({ type: 'addFailed', key, notice: saveFailedNotice(error) });
      return false;
    }
  }, []);

  const sendToggles = useCallback(
    async (key: string, id: string) => {
      toggleInFlight.current.add(key);
      try {
        for (;;) {
          const wanted = desiredCompleted.current.get(key);
          if (wanted === undefined) return;
          const todo = await updateTodo(id, wanted);
          if (desiredCompleted.current.get(key) === todo.completed) {
            desiredCompleted.current.delete(key);
            dispatch({ type: 'toggleConfirmed', key, todo });
            return;
          }
          // The user changed their mind while this request was in flight: send the newer value.
          dispatch({ type: 'toggleAcknowledged', key, completed: todo.completed });
        }
      } catch (error) {
        desiredCompleted.current.delete(key);
        if (isNotFound(error)) {
          dispatch({ type: 'toggleFailed', key, notice: notFoundNotice });
          void refresh();
        } else {
          dispatch({ type: 'toggleFailed', key, notice: saveFailedNotice(error) });
        }
      } finally {
        toggleInFlight.current.delete(key);
      }
    },
    [refresh],
  );

  const toggle = useCallback(
    (key: string, completed: boolean) => {
      const item = itemsRef.current.find((i) => i.key === key);
      if (!item || !item.saved) return;
      dispatch({ type: 'toggleOptimistic', key, completed });
      desiredCompleted.current.set(key, completed);
      if (!toggleInFlight.current.has(key)) void sendToggles(key, item.id);
    },
    [sendToggles],
  );

  const remove = useCallback(
    (key: string) => {
      const index = itemsRef.current.findIndex((i) => i.key === key);
      const item = itemsRef.current[index];
      if (!item || !item.saved || removing.current.has(key)) return;

      removing.current.add(key);
      desiredCompleted.current.delete(key);
      dispatch({ type: 'removeOptimistic', key });
      deleteTodo(item.id)
        .catch((error: unknown) => {
          if (isNotFound(error)) {
            // Already gone on the server: the end state is what the user wanted, so no rollback.
            dispatch({ type: 'notify', notice: notFoundNotice });
            void refresh();
          } else {
            dispatch({ type: 'removeFailed', item, index, notice: saveFailedNotice(error) });
          }
        })
        .finally(() => {
          removing.current.delete(key);
        });
    },
    [refresh],
  );

  const dismissNotice = useCallback(() => dispatch({ type: 'dismissNotice' }), []);

  return { state, add, toggle, remove, reload, dismissNotice };
}
