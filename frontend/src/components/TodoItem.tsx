import { memo } from 'react';
import { formatCreatedAt, formatFullTimestamp } from '../lib/formatTime';
import type { ViewTodo } from '../state/useTodos';

interface TodoItemProps {
  todo: ViewTodo;
  now: Date;
  onToggle(key: string, completed: boolean): void;
  onDelete(key: string): void;
  registerCheckbox?(key: string, element: HTMLInputElement | null): void;
}

export const TodoItem = memo(function TodoItem({
  todo,
  now,
  onToggle,
  onDelete,
  registerCheckbox,
}: TodoItemProps) {
  const checkboxId = `todo-${todo.key}`;

  return (
    <li className="todo-item" data-completed={todo.completed ? 'true' : undefined}>
      <input
        id={checkboxId}
        ref={(element) => registerCheckbox?.(todo.key, element)}
        type="checkbox"
        className="todo-item__checkbox"
        checked={todo.completed}
        disabled={!todo.saved}
        onChange={() => onToggle(todo.key, !todo.completed)}
      />
      <div className="todo-item__body">
        {/* The label wraps only the description, so it is the checkbox's accessible name. */}
        <label htmlFor={checkboxId}>
          {/* Text child only: never interpreted as markup (FR-018). */}
          <span className={todo.completed ? 'todo-description is-completed' : 'todo-description'}>
            {todo.description}
          </span>
        </label>
        <time dateTime={todo.createdAt} title={formatFullTimestamp(todo.createdAt)}>
          {formatCreatedAt(todo.createdAt, now)}
        </time>
      </div>
      <button
        type="button"
        className="todo-item__delete"
        aria-label={`Delete task: ${todo.description}`}
        disabled={!todo.saved}
        onClick={(event) => {
          // Ignore the 2nd click of a double-click: after the first removes this item, the next
          // item's Delete button slides under the pointer and would be deleted too.
          if (event.detail > 1) return;
          onDelete(todo.key);
        }}
      >
        Delete
      </button>
    </li>
  );
});
