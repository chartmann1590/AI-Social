import { formatRelativeTime, formatAbsoluteForA11y } from '../utils/time';

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-05-07T12:00:00Z').getTime();

  test('returns "now" for posts under one minute old', () => {
    const iso = new Date(NOW - 30_000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('now');
  });

  test('returns minutes for posts under one hour old', () => {
    const iso = new Date(NOW - 5 * 60_000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('5m');
  });

  test('returns hours for posts under one day old', () => {
    const iso = new Date(NOW - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('3h');
  });

  test('returns days for posts under one week old', () => {
    const iso = new Date(NOW - 4 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(iso, NOW)).toBe('4d');
  });

  test('returns "Mon DD" for older posts in the same year', () => {
    const iso = new Date('2026-02-14T08:00:00Z').toISOString();
    expect(formatRelativeTime(iso, NOW)).toMatch(/^Feb \d+$/);
  });

  test('includes the year for posts older than the current year', () => {
    const iso = new Date('2024-12-25T08:00:00Z').toISOString();
    expect(formatRelativeTime(iso, NOW)).toMatch(/^Dec \d+, 2024$/);
  });

  test('returns "--" for invalid dates rather than throwing', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('--');
  });
});

describe('formatAbsoluteForA11y', () => {
  test('produces a non-empty string for a valid ISO date', () => {
    const out = formatAbsoluteForA11y('2026-05-07T12:00:00Z');
    expect(out).not.toBe('');
    expect(typeof out).toBe('string');
  });

  test('returns empty string for invalid input rather than throwing', () => {
    expect(formatAbsoluteForA11y('garbage')).toBe('');
  });
});
