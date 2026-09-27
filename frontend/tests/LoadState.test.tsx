import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoadState } from '../src/components/LoadState';

describe('LoadState', () => {
  it('shows a loading status', () => {
    render(<LoadState status="loading" onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading tasks…');
  });

  it('shows an alert with a Try again button when loading failed', async () => {
    const onRetry = vi.fn();
    render(<LoadState status="error" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your tasks.");
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders nothing when ready', () => {
    const { container } = render(<LoadState status="ready" onRetry={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
