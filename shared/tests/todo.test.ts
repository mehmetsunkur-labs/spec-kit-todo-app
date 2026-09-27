import { describe, expect, it } from 'vitest';
import { countCodePoints, DESCRIPTION_MAX_LENGTH, parseDescription } from '../src/index.js';

const EMPTY = 'Please enter a task description.';
const TOO_LONG = 'Descriptions can be at most 500 characters.';
const NOT_SINGLE_LINE = 'Descriptions must be a single line of text.';

describe('parseDescription', () => {
  it('trims leading and trailing whitespace', () => {
    expect(parseDescription('  Buy milk  ')).toEqual({ ok: true, value: 'Buy milk' });
  });

  it.each(['', '   '])('rejects empty or whitespace-only input %j', (input) => {
    expect(parseDescription(input)).toEqual({ ok: false, message: EMPTY });
  });

  it('rejects non-string input', () => {
    expect(parseDescription(undefined)).toEqual({ ok: false, message: EMPTY });
    expect(parseDescription(5)).toEqual({ ok: false, message: EMPTY });
  });

  it('accepts exactly 500 characters and rejects 501', () => {
    expect(parseDescription('a'.repeat(500))).toEqual({ ok: true, value: 'a'.repeat(500) });
    expect(parseDescription('a'.repeat(501))).toEqual({ ok: false, message: TOO_LONG });
  });

  it('counts length in Unicode code points, so 500 emoji are accepted', () => {
    const emoji = '🎉'.repeat(500);
    expect(emoji.length).toBe(1000); // UTF-16 units
    expect(parseDescription(emoji)).toEqual({ ok: true, value: emoji });
    expect(parseDescription('🎉'.repeat(501))).toEqual({ ok: false, message: TOO_LONG });
  });

  it('checks length after trimming', () => {
    expect(parseDescription(`  ${'a'.repeat(500)}  `)).toEqual({
      ok: true,
      value: 'a'.repeat(500),
    });
  });

  it.each(['a\nb', 'a\tb', '\u007f', 'a\u0000b'])('rejects control characters in %j', (input) => {
    expect(parseDescription(input)).toEqual({ ok: false, message: NOT_SINGLE_LINE });
  });

  it.each(['日本語テキスト 🎉', '<img src=x onerror=alert(1)>', 'Ünïcödé & "quotes"'])(
    'preserves %j exactly',
    (input) => {
      expect(parseDescription(input)).toEqual({ ok: true, value: input });
    },
  );
});

describe('countCodePoints', () => {
  it('counts code points rather than UTF-16 units', () => {
    expect(countCodePoints('abc')).toBe(3);
    expect(countCodePoints('🎉🎉🎉')).toBe(3);
    expect(countCodePoints('')).toBe(0);
  });
});

describe('DESCRIPTION_MAX_LENGTH', () => {
  it('is 500', () => {
    expect(DESCRIPTION_MAX_LENGTH).toBe(500);
  });
});
