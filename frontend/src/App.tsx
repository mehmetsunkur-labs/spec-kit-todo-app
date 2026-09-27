import { useRef } from 'react';
import { LoadState } from './components/LoadState';
import { StatusBanner } from './components/StatusBanner';
import { TodoForm } from './components/TodoForm';
import { TodoList } from './components/TodoList';
import { useTodos } from './state/useTodos';

export function App() {
  const { state, add, toggle, remove, reload, dismissNotice } = useTodos();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <main>
      <h1>Todos</h1>
      <TodoForm onAdd={add} inputRef={inputRef} disabled={state.status !== 'ready'} />
      <StatusBanner notice={state.notice} onDismiss={dismissNotice} />
      {state.status === 'ready' ? (
        <TodoList
          items={state.items}
          onToggle={toggle}
          onDelete={remove}
          emptyFocusRef={inputRef}
        />
      ) : (
        <LoadState status={state.status} onRetry={() => void reload()} />
      )}
    </main>
  );
}
