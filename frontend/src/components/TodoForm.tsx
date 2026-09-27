import { countCodePoints, DESCRIPTION_MAX_LENGTH, parseDescription } from '@todo/shared';
import { useState, type FormEvent, type RefObject } from 'react';

interface TodoFormProps {
  onAdd(description: string): Promise<boolean>;
  disabled?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function TodoForm({ onAdd, disabled = false, inputRef }: TodoFormProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const count = countCodePoints(value);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseDescription(value);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setError(null);
    setValue('');
    void onAdd(parsed.value).then((saved) => {
      // US4-AS4: never lose what the user typed; restore it unless they've started something new.
      if (!saved) setValue((current) => (current === '' ? parsed.value : current));
    });
  }

  return (
    <form className="todo-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="new-task">New task</label>
      {/* No maxLength: HTML counts UTF-16 units, but the limit is 500 code points (research §5). */}
      <input
        id="new-task"
        ref={inputRef}
        type="text"
        autoComplete="off"
        enterKeyHint="done"
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'new-task-count new-task-error' : 'new-task-count'}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) setError(null);
        }}
      />
      <button type="submit" disabled={disabled}>
        Add task
      </button>
      <div className="todo-form__meta">
        {error && (
          <p id="new-task-error" className="todo-form__error">
            {error}
          </p>
        )}
        <span
          id="new-task-count"
          className="todo-form__count"
          data-over={count > DESCRIPTION_MAX_LENGTH ? 'true' : undefined}
        >
          {count}/{DESCRIPTION_MAX_LENGTH}
        </span>
      </div>
    </form>
  );
}
