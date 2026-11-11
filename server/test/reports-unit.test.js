// Unit tests for the report date ranges and summary stats. No database needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyRange, monthToDateRange, previousMonthRange } from '../src/reports/ranges.js';
import { summarize } from '../src/reports/stats.js';

test('daily range is the selected date only', () => {
  assert.deepEqual(dailyRange('2026-10-15'), { from: '2026-10-15', to: '2026-10-15' });
});

test('month-to-date runs from the 1st to the selected date', () => {
  assert.deepEqual(monthToDateRange('2026-10-15'), { from: '2026-10-01', to: '2026-10-15' });
  assert.deepEqual(monthToDateRange('2026-12-31'), { from: '2026-12-01', to: '2026-12-31' });
});

test('month-to-date on the 1st is that single day', () => {
  assert.deepEqual(monthToDateRange('2026-10-01'), { from: '2026-10-01', to: '2026-10-01' });
});

test('previous month for 15 Oct 2026 is 1 Sep to 30 Sep', () => {
  assert.deepEqual(previousMonthRange('2026-10-15'), { from: '2026-09-01', to: '2026-09-30' });
});

test('previous month for January is December of the year before', () => {
  assert.deepEqual(previousMonthRange('2026-01-10'), { from: '2025-12-01', to: '2025-12-31' });
});

test('previous month for March ends on Feb 29 in a leap year', () => {
  assert.deepEqual(previousMonthRange('2024-03-15'), { from: '2024-02-01', to: '2024-02-29' });
});

test('previous month for March ends on Feb 28 in a non-leap year', () => {
  assert.deepEqual(previousMonthRange('2026-03-15'), { from: '2026-02-01', to: '2026-02-28' });
});

test('previous month for a 31st is still the whole month before', () => {
  // The previous months here are shorter than 31 days.
  assert.deepEqual(previousMonthRange('2026-10-31'), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(previousMonthRange('2026-03-31'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(previousMonthRange('2026-08-31'), { from: '2026-07-01', to: '2026-07-31' });
});

test('summarize with no values gives count 0 and nulls', () => {
  assert.deepEqual(summarize([]), { count: 0, highest: null, lowest: null, average: null });
});

test('summarize with a single value uses it for every number', () => {
  assert.deepEqual(summarize([120]), { count: 1, highest: 120, lowest: 120, average: 120 });
});

test('summarize finds the count, highest, lowest and average', () => {
  assert.deepEqual(summarize([110, 180, 95, 135]), {
    count: 4,
    highest: 180,
    lowest: 95,
    average: 130,
  });
});

test('summarize rounds the average to 1 decimal', () => {
  // 302 / 3 = 100.666...
  assert.equal(summarize([100, 101, 101]).average, 100.7);
  // 301 / 3 = 100.333...
  assert.equal(summarize([100, 100, 101]).average, 100.3);
  // Already 1 decimal, left as it is.
  assert.equal(summarize([100, 101]).average, 100.5);
});

test('summarize rounds an average ending in .x5 up', () => {
  // 401 / 4 = 100.25
  assert.equal(summarize([100, 100, 100, 101]).average, 100.3);
  // 403 / 4 = 100.75
  assert.equal(summarize([100, 101, 101, 101]).average, 100.8);
});
