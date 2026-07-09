import { describe, expect, test } from 'bun:test';
import { parseDismissedAt, isStillHidden, WELCOME_DISMISS_DAYS } from '../assets/js/welcome-modal.js';

describe('parseDismissedAt', () => {
  test('returns 0 for null/empty/undefined raw values', () => {
    expect(parseDismissedAt(null as any)).toBe(0);
    expect(parseDismissedAt('')).toBe(0);
    expect(parseDismissedAt(undefined as any)).toBe(0);
  });

  test('returns 0 for a non-numeric string (corrupt storage)', () => {
    expect(parseDismissedAt('not-a-number')).toBe(0);
  });

  test('parses a valid numeric string timestamp', () => {
    expect(parseDismissedAt('1700000000000')).toBe(1700000000000);
  });
});

describe('isStillHidden', () => {
  test('is never hidden when there is no prior dismissal', () => {
    expect(isStillHidden(0, Date.now())).toBe(false);
  });

  test('stays hidden the day after a dismissal', () => {
    const dismissedAt = 1_000_000;
    const oneDayLater = dismissedAt + 86400000;
    expect(isStillHidden(dismissedAt, oneDayLater)).toBe(true);
  });

  test('reappears once the dismiss window has fully elapsed', () => {
    const dismissedAt = 1_000_000;
    const afterWindow = dismissedAt + WELCOME_DISMISS_DAYS * 86400000 + 1;
    expect(isStillHidden(dismissedAt, afterWindow)).toBe(false);
  });

  test('is still hidden exactly at the boundary minus one millisecond', () => {
    const dismissedAt = 1;
    const justBeforeWindowEnds = dismissedAt + WELCOME_DISMISS_DAYS * 86400000 - 1;
    expect(isStillHidden(dismissedAt, justBeforeWindowEnds)).toBe(true);
  });

  test('honors a custom dismiss-days override', () => {
    expect(isStillHidden(1, 1 + 86400000, 1)).toBe(false);
    expect(isStillHidden(1, 1 + 3600000, 1)).toBe(true);
  });

  test('dismissedAt of 0 (falsy) is treated as never dismissed regardless of clock', () => {
    expect(isStillHidden(0, 1)).toBe(false);
  });
});
