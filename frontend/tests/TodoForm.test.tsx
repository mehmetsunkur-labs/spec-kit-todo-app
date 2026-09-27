import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TodoForm } from '../src/components/TodoForm';

function setup(onAdd = vi.fn(async () => true)) {
  const user = userEvent.setup();
  render(<TodoForm onAdd={onAdd} />);
  const input = screen.getByRole('textbox', { name: 'New task' });
  return { user, input, onAdd };
}

describe('TodoForm', () => {
  it('has a labelled input without maxLength, a counter and an Add task button', () => {
    const { input } = setup();
    expect(input).not.toHaveAttribute('maxLength');
    expect(screen.getByRole('button', { name: 'Add task' })).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription(/0\/500/);
  });

  it('counts code points in the counter', async () => {
    const { user, input } = setup();
    await user.type(input, '🎉🎉🎉');
    expect(screen.getByText('3/500')).toBeInTheDocument();
  });

  it('submits the trimmed text on Enter, clears the input and keeps focus', async () => {
    const { user, input, onAdd } = setup();
    await user.type(input, '  Buy milk  {Enter}');
    expect(onAdd).toHaveBeenCalledWith('Buy milk');
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('submits via the Add task button', async () => {
    const { user, input, onAdd } = setup();
    await user.type(input, 'Walk dog');
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onAdd).toHaveBeenCalledWith('Walk dog');
  });

  it('does not submit whitespace and explains why', async () => {
    const { user, input, onAdd } = setup();
    await user.type(input, '   {Enter}');
    expect(onAdd).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/Please enter a task description\./);
    expect(input).toHaveFocus();
  });

  it('rejects 501 characters with a message and does not submit', async () => {
    const { user, input, onAdd } = setup();
    await user.click(input);
    await user.paste('a'.repeat(501));
    await user.keyboard('{Enter}');
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText('Descriptions can be at most 500 characters.')).toBeInTheDocument();
    expect(input).toHaveValue('a'.repeat(501));
  });

  it('accepts 500 emoji', async () => {
    const { user, input, onAdd } = setup();
    await user.click(input);
    await user.paste('🎉'.repeat(500));
    await user.keyboard('{Enter}');
    expect(onAdd).toHaveBeenCalledWith('🎉'.repeat(500));
  });

  it('clears the error once the user edits the text', async () => {
    const { user, input } = setup();
    await user.type(input, '{Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await user.type(input, 'x');
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('restores the text when saving fails, so it can be resubmitted (US4-AS4)', async () => {
    const onAdd = vi.fn(async () => false);
    const { user, input } = setup(onAdd);
    await user.type(input, 'Important{Enter}');
    expect(onAdd).toHaveBeenCalledWith('Important');
    await vi.waitFor(() => expect(input).toHaveValue('Important'));
    expect(input).toHaveFocus();
  });

  it('does not overwrite newer text when an earlier save fails', async () => {
    let fail!: () => void;
    const onAdd = vi.fn(() => new Promise<boolean>((resolve) => (fail = () => resolve(false))));
    const { user, input } = setup(onAdd);
    await user.type(input, 'First{Enter}');
    await user.type(input, 'Second');
    fail();
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(input).toHaveValue('Second');
  });

  it('disables the input and button while disabled', () => {
    render(<TodoForm onAdd={vi.fn()} disabled />);
    expect(screen.getAllByRole('textbox', { name: 'New task' }).at(-1)).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Add task' }).at(-1)).toBeDisabled();
  });
});
