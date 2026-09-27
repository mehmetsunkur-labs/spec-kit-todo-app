import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TodoItem } from '../src/components/TodoItem';
import type { ViewTodo } from '../src/state/useTodos';
import { makeTodo } from './fixtures';

function view(overrides: Parameters<typeof makeTodo>[0] = {}): ViewTodo {
  const todo = makeTodo(overrides);
  return { ...todo, key: `key-${todo.id}`, saved: true, confirmedCompleted: todo.completed };
}

function renderItem(todo: ViewTodo, onToggle = vi.fn(), onDelete = vi.fn()) {
  render(
    <ul>
      <TodoItem todo={todo} now={new Date()} onToggle={onToggle} onDelete={onDelete} />
    </ul>,
  );
  return { onToggle, onDelete, user: userEvent.setup() };
}

describe('TodoItem: completion (US2)', () => {
  it('has a checkbox named by the description, unchecked when active', () => {
    renderItem(view({ description: 'Walk dog' }));
    expect(screen.getByRole('checkbox', { name: 'Walk dog' })).not.toBeChecked();
  });

  it('is checked when completed and marked completed without relying on color', () => {
    const todo = view({ description: 'Walk dog', completed: true });
    renderItem(todo);
    expect(screen.getByRole('checkbox', { name: 'Walk dog' })).toBeChecked();
    expect(screen.getByRole('listitem')).toHaveAttribute('data-completed', 'true');
    expect(screen.getByText('Walk dog')).toHaveClass('is-completed');
  });

  it('calls onToggle with the key and the opposite value on click', async () => {
    const todo = view({ description: 'Walk dog' });
    const { onToggle, user } = renderItem(todo);
    await user.click(screen.getByRole('checkbox', { name: 'Walk dog' }));
    expect(onToggle).toHaveBeenCalledWith(todo.key, true);
  });

  it('toggles with the Space key', async () => {
    const todo = view({ description: 'Walk dog', completed: true });
    const { onToggle, user } = renderItem(todo);
    screen.getByRole('checkbox', { name: 'Walk dog' }).focus();
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith(todo.key, false);
  });

  it('disables the checkbox while the todo is still being saved', () => {
    renderItem({ ...view({ description: 'New' }), saved: false });
    expect(screen.getByRole('checkbox', { name: 'New' })).toBeDisabled();
  });
});

describe('TodoItem: delete (US3)', () => {
  it('has a delete button named after the task that calls onDelete with the key', async () => {
    const todo = view({ description: 'Walk dog' });
    const { onDelete, user } = renderItem(todo);
    await user.click(screen.getByRole('button', { name: 'Delete task: Walk dog' }));
    expect(onDelete).toHaveBeenCalledWith(todo.key);
  });

  it('ignores the second click of a double-click (regression: deleted two todos)', async () => {
    const todo = view({ description: 'Walk dog' });
    const { onDelete, user } = renderItem(todo);
    await user.dblClick(screen.getByRole('button', { name: 'Delete task: Walk dog' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('still deletes from the keyboard', async () => {
    const todo = view({ description: 'Walk dog' });
    const { onDelete, user } = renderItem(todo);
    screen.getByRole('button', { name: 'Delete task: Walk dog' }).focus();
    await user.keyboard('{Enter}');
    expect(onDelete).toHaveBeenCalledWith(todo.key);
  });
});
