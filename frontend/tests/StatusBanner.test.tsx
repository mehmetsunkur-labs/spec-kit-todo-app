import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusBanner } from '../src/components/StatusBanner';

const notice = { kind: 'error' as const, message: "Couldn't save your change. Please try again." };

describe('StatusBanner', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is a polite live region that is present even with no notice', () => {
    render(<StatusBanner notice={null} onDismiss={vi.fn()} />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('shows the message and can be dismissed', async () => {
    const onDismiss = vi.fn();
    render(<StatusBanner notice={notice} onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toHaveTextContent(notice.message);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('dismisses itself after 6 seconds, restarting the timer for a new notice', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(<StatusBanner notice={notice} onDismiss={onDismiss} />);

    act(() => vi.advanceTimersByTime(5000));
    rerender(<StatusBanner notice={{ ...notice }} onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
