import { describe, expect, it } from 'vitest';
import { formatCreatedAt, formatFullTimestamp } from '../src/lib/formatTime';

const now = new Date('2026-09-27T12:00:00.000Z');
// Expected strings come from Intl itself, so the tests hold in any locale.
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'long' });
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatCreatedAt', () => {
  it('says "now" for under a minute', () => {
    expect(formatCreatedAt(ago(0), now)).toBe(rtf.format(0, 'second'));
    expect(formatCreatedAt(ago(59_000), now)).toBe(rtf.format(0, 'second'));
  });

  it('uses minutes under an hour', () => {
    expect(formatCreatedAt(ago(5 * MIN), now)).toBe(rtf.format(-5, 'minute'));
  });

  it('uses hours under a day', () => {
    expect(formatCreatedAt(ago(3 * HOUR), now)).toBe(rtf.format(-3, 'hour'));
  });

  it('says "yesterday" for one day ago', () => {
    expect(formatCreatedAt(ago(DAY + HOUR), now)).toBe(rtf.format(-1, 'day'));
  });

  it('uses an absolute medium date for older items', () => {
    const iso = ago(10 * DAY);
    const expected = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(iso),
    );
    expect(formatCreatedAt(iso, now)).toBe(expected);
  });

  it('treats slightly-future timestamps (clock skew) as "now"', () => {
    expect(formatCreatedAt(ago(-5_000), now)).toBe(rtf.format(0, 'second'));
  });

  it('reads naturally in en-US', () => {
    const enUS = (iso: string) => formatCreatedAt(iso, now, 'en-US');
    expect(enUS(ago(0))).toBe('now');
    expect(enUS(ago(5 * MIN))).toBe('5 minutes ago');
    expect(enUS(ago(3 * HOUR))).toBe('3 hours ago');
    expect(enUS(ago(DAY + HOUR))).toBe('yesterday');
  });
});

describe('formatFullTimestamp', () => {
  it('returns a full date and time string', () => {
    const iso = '2026-09-27T10:15:30.123Z';
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date(iso));
    expect(formatFullTimestamp(iso)).toBe(expected);
  });
});
