import { describe, test, expect } from 'vitest';
import { relativeTime } from '../../utils/relativeTime';

describe('relativeTime', () => {
  test('returns empty string for null input', () => {
    expect(relativeTime(null)).toBe('');
  });

  test('returns empty string for undefined input', () => {
    expect(relativeTime(undefined)).toBe('');
  });

  test('returns "just now" for very recent timestamps', () => {
    const now = new Date().toISOString();
    expect(relativeTime(now)).toBe('just now');
  });

  test('returns seconds ago for timestamps a few seconds old', () => {
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    const result = relativeTime(tenSecondsAgo);
    expect(result).toMatch(/seconds? ago/);
  });

  test('returns minutes ago for timestamps a few minutes old', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = relativeTime(fiveMinutesAgo);
    expect(result).toMatch(/minutes? ago/);
  });

  test('returns hours ago for timestamps a few hours old', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const result = relativeTime(twoHoursAgo);
    expect(result).toMatch(/hours? ago/);
  });

  test('returns days ago for timestamps a few days old', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = relativeTime(threeDaysAgo);
    expect(result).toMatch(/days? ago/);
  });
});