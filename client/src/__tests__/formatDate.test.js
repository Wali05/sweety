import { describe, expect, it } from 'vitest';
import { formatReadableDate } from '../readings/formatDate.js';

describe('formatReadableDate', () => {
  it('writes the weekday, day, month and year', () => {
    expect(formatReadableDate('2026-11-12')).toBe('Thu, 12 Nov 2026');
    expect(formatReadableDate('2026-03-04')).toBe('Wed, 4 Mar 2026');
  });

  it('keeps the day at the edges of months and years', () => {
    expect(formatReadableDate('2026-01-01')).toBe('Thu, 1 Jan 2026');
    expect(formatReadableDate('2025-12-31')).toBe('Wed, 31 Dec 2025');
    expect(formatReadableDate('2024-02-29')).toBe('Thu, 29 Feb 2024');
  });

  it('does not depend on the time zone', () => {
    const before = process.env.TZ;
    try {
      for (const zone of ['Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
        process.env.TZ = zone;
        expect(formatReadableDate('2026-11-12')).toBe('Thu, 12 Nov 2026');
      }
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });

  it('gives nothing for a missing or impossible date', () => {
    expect(formatReadableDate('')).toBe('');
    expect(formatReadableDate(undefined)).toBe('');
    expect(formatReadableDate('12/11/2026')).toBe('');
    expect(formatReadableDate('2026-02-30')).toBe('');
    expect(formatReadableDate('2026-13-01')).toBe('');
  });
});
