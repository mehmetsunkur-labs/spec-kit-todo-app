import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ViewTodo } from '../state/useTodos';
import { TodoItem } from './TodoItem';

interface TodoListProps {
  items: ViewTodo[];
  onToggle(key: string, completed: boolean): void;
  onDelete(key: string): void;
  /** Receives focus when the last todo is deleted. */
  emptyFocusRef?: RefObject<HTMLElement | null>;
}

/** Re-renders relative times ("5 minutes ago") once a minute. */
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface PendingFocus {
  deletedKey: string;
  /** Key of the item to focus, or null to focus `emptyFocusRef`. */
  targetKey: string | null;
}

export function TodoList({ items, onToggle, onDelete, emptyFocusRef }: TodoListProps) {
  const now = useNow();
  const checkboxes = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<PendingFocus | null>(null);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const registerCheckbox = useCallback((key: string, element: HTMLInputElement | null) => {
    if (element) checkboxes.current.set(key, element);
    else checkboxes.current.delete(key);
  }, []);

  // After a delete, move focus to the next item, else the previous one, else the input (FR-017).
  const handleDelete = useCallback(
    (key: string) => {
      const current = itemsRef.current;
      const index = current.findIndex((item) => item.key === key);
      const target = current[index + 1] ?? current[index - 1];
      pendingFocus.current = { deletedKey: key, targetKey: target?.key ?? null };
      onDelete(key);
    },
    [onDelete],
  );

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || items.some((item) => item.key === pending.deletedKey)) return;
    pendingFocus.current = null;
    if (pending.targetKey === null) emptyFocusRef?.current?.focus();
    else checkboxes.current.get(pending.targetKey)?.focus();
  }, [items, emptyFocusRef]);

  if (items.length === 0) {
    return <p className="todo-empty">No tasks yet. Add one above to get started.</p>;
  }

  const remaining = items.filter((item) => !item.completed).length;

  return (
    <>
      <ul className="todo-list" aria-label="Tasks">
        {items.map((todo) => (
          <TodoItem
            key={todo.key}
            todo={todo}
            now={now}
            onToggle={onToggle}
            onDelete={handleDelete}
            registerCheckbox={registerCheckbox}
          />
        ))}
      </ul>
      <p className="todo-summary">
        {remaining} of {items.length} remaining
      </p>
    </>
  );
}
