import { describe, expect, it } from 'vitest';
import { formatDate, formatRange } from '../reports/formatRange.js';

describe('report date ranges', () => {
  it('writes a date as day, short month and year', () => {
    expect(formatDate('2026-10-15')).toBe('15 Oct 2026');
    expect(formatDate('2026-01-05')).toBe('5 Jan 2026');
    expect(formatDate('2024-02-29')).toBe('29 Feb 2024');
  });

  it('writes a single day once', () => {
    expect(formatRange('2026-10-15', '2026-10-15')).toBe('15 Oct 2026');
    expect(formatRange('2026-10-01', '2026-10-01')).toBe('1 Oct 2026');
  });

  it('writes the year once for a range within one year', () => {
    expect(formatRange('2026-10-01', '2026-10-15')).toBe('1 Oct – 15 Oct 2026');
    expect(formatRange('2026-09-01', '2026-09-30')).toBe('1 Sep – 30 Sep 2026');
    expect(formatRange('2025-12-01', '2025-12-31')).toBe('1 Dec – 31 Dec 2025');
  });

  it('writes both years when the range crosses into another year', () => {
    expect(formatRange('2025-12-20', '2026-01-05')).toBe('20 Dec 2025 – 5 Jan 2026');
  });
});
