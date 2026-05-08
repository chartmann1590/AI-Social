import {
  AD_REWARD_DAILY_LIMIT,
  AD_FREE_REDEMPTION_OPTIONS,
  getLocalDayKey,
  formatRewardDuration,
} from '../rewards/adFreeRewards';

describe('AD_REWARD_DAILY_LIMIT', () => {
  test('is a positive integer', () => {
    expect(Number.isInteger(AD_REWARD_DAILY_LIMIT)).toBe(true);
    expect(AD_REWARD_DAILY_LIMIT).toBeGreaterThan(0);
  });
});

describe('AD_FREE_REDEMPTION_OPTIONS', () => {
  test('has at least one option and every option has the required shape', () => {
    expect(AD_FREE_REDEMPTION_OPTIONS.length).toBeGreaterThan(0);
    for (const o of AD_FREE_REDEMPTION_OPTIONS) {
      expect(typeof o.id).toBe('string');
      expect(o.credits).toBeGreaterThan(0);
      expect(o.durationMs).toBeGreaterThan(0);
      expect(typeof o.label).toBe('string');
      expect(typeof o.description).toBe('string');
    }
  });

  test('every credit cost stays within the daily limit', () => {
    for (const o of AD_FREE_REDEMPTION_OPTIONS) {
      expect(o.credits).toBeLessThanOrEqual(AD_REWARD_DAILY_LIMIT);
    }
  });
});

describe('getLocalDayKey', () => {
  test('formats a known date as YYYY-MM-DD using local time', () => {
    const d = new Date(2026, 4, 7, 12, 0, 0); // May 7 2026, local
    expect(getLocalDayKey(d)).toBe('2026-05-07');
  });

  test('zero-pads single-digit months and days', () => {
    const d = new Date(2026, 0, 3, 9, 0, 0); // Jan 3 2026, local
    expect(getLocalDayKey(d)).toBe('2026-01-03');
  });

  test('returns todays key when called without arguments', () => {
    expect(getLocalDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatRewardDuration', () => {
  test('returns "0 minutes" for non-positive input', () => {
    expect(formatRewardDuration(0)).toBe('0 minutes');
    expect(formatRewardDuration(-100)).toBe('0 minutes');
  });

  test('formats minutes only when under an hour', () => {
    expect(formatRewardDuration(30 * 60_000)).toBe('30 minutes');
    expect(formatRewardDuration(60_000)).toBe('1 minute');
  });

  test('formats hours and minutes together', () => {
    expect(formatRewardDuration(2 * 60 * 60_000 + 15 * 60_000)).toBe('2 hours 15 minutes');
  });

  test('formats days alone (no minutes when days are present)', () => {
    expect(formatRewardDuration(2 * 24 * 60 * 60_000)).toBe('2 days');
  });
});
