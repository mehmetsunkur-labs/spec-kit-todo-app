const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Human-readable creation time (FR-009): relative for the last two days, then an absolute date.
 * Uses the user's locale; no date library.
 */
export function formatCreatedAt(iso: string, now: Date = new Date(), locale?: string): string {
  const elapsed = Math.max(0, now.getTime() - new Date(iso).getTime());
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'long' });

  if (elapsed < MINUTE) return rtf.format(0, 'second');
  if (elapsed < HOUR) return rtf.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return rtf.format(-Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < 2 * DAY) return rtf.format(-1, 'day');
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}

/** Full timestamp for the `title` attribute. */
export function formatFullTimestamp(iso: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(
    new Date(iso),
  );
}
