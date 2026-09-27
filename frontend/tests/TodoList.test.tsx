import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TodoList } from '../src/components/TodoList';
import type { ViewTodo } from '../src/state/useTodos';
import { makeTodo } from './fixtures';

function view(overrides: Parameters<typeof makeTodo>[0] = {}): ViewTodo {
  const todo = makeTodo(overrides);
  return { ...todo, key: todo.id, saved: true, confirmedCompleted: todo.completed };
}

const noop = () => {};

describe('TodoList', () => {
  it('shows the empty state when there are no todos', () => {
    render(<TodoList items={[]} onToggle={noop} onDelete={noop} />);
    expect(screen.getByText('No tasks yet. Add one above to get started.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Tasks' })).not.toBeInTheDocument();
  });

  it('renders one list item per todo, in the given order', () => {
    const items = [
      view({ description: 'Three' }),
      view({ description: 'Two' }),
      view({ description: 'One' }),
    ];
    render(<TodoList items={items} onToggle={noop} onDelete={noop} />);
    const list = screen.getByRole('list', { name: 'Tasks' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Three'),
      expect.stringContaining('Two'),
      expect.stringContaining('One'),
    ]);
  });

  it('renders descriptions as plain text, never as markup (FR-018)', () => {
    const { container } = render(
      <TodoList
        items={[view({ description: '<img src=x onerror=alert(1)>' })]}
        onToggle={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the creation time in a <time> element with the ISO value', () => {
    const item = view();
    const { container } = render(<TodoList items={[item]} onToggle={noop} onDelete={noop} />);
    const time = container.querySelector('time');
    expect(time).toHaveAttribute('datetime', item.createdAt);
    expect(time).toHaveAttribute('title');
    expect(time?.textContent).not.toBe('');
  });

  it('shows how many tasks remain', () => {
    const items = [view({ completed: true }), view(), view()];
    render(<TodoList items={items} onToggle={noop} onDelete={noop} />);
    expect(screen.getByText('2 of 3 remaining')).toBeInTheDocument();
  });
});

/** Renders TodoList with real removal so focus management can be observed. */
function Harness({ initial }: { initial: ViewTodo[] }) {
  const [items, setItems] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={inputRef} aria-label="New task" />
      <TodoList
        items={items}
        onToggle={noop}
        onDelete={(key) => setItems((current) => current.filter((i) => i.key !== key))}
        emptyFocusRef={inputRef}
      />
    </>
  );
}

describe('TodoList: focus after delete (US3, FR-017)', () => {
  it('moves focus to the next item, then the previous, then the input', async () => {
    const user = userEvent.setup();
    const items = [
      view({ description: 'A' }),
      view({ description: 'B' }),
      view({ description: 'C' }),
    ];
    render(<Harness initial={items} />);

    await user.click(screen.getByRole('button', { name: 'Delete task: B' }));
    expect(screen.getByRole('checkbox', { name: 'C' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Delete task: C' }));
    expect(screen.getByRole('checkbox', { name: 'A' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Delete task: A' }));
    expect(screen.getByRole('textbox', { name: 'New task' })).toHaveFocus();
  });
});
