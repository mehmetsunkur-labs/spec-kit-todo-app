import { useEffect } from 'react';
import type { Notice } from '../state/useTodos';

const AUTO_DISMISS_MS = 6000;

interface StatusBannerProps {
  notice: Notice | null;
  onDismiss(): void;
}

/** Always mounted, so screen readers reliably announce messages added to it. */
export function StatusBanner({ notice, onDismiss }: StatusBannerProps) {
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [notice, onDismiss]);

  return (
    <div role="status" aria-live="polite" className="status-banner">
      {notice && (
        <>
          <p>{notice.message}</p>
          <button type="button" onClick={onDismiss}>
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}
