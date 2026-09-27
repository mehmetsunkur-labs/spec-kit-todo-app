import type { LoadStatus } from '../state/useTodos';

interface LoadStateProps {
  status: LoadStatus;
  onRetry(): void;
}

export function LoadState({ status, onRetry }: LoadStateProps) {
  if (status === 'loading') {
    return (
      <p role="status" className="load-state">
        Loading tasks…
      </p>
    );
  }

  if (status === 'error') {
    return (
      <div role="alert" className="load-state load-state--error">
        <p>Couldn&apos;t load your tasks.</p>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  return null;
}
