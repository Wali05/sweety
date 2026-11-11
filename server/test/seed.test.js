// Unit tests for the demo data generator. No database needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSampleReadings } from '../src/db/sampleReadings.js';
import { SLOTS, MIN_VALUE, MAX_VALUE, MAX_READINGS_PER_DAY } from '../src/validation/readings.js';

const SLOT_KEYS = new Set(SLOTS.map((slot) => slot.key));

// Every date from `from` to `to`, inclusive.
function datesBetween(from, to) {
  const dates = [];
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86400000) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
}

// Checks the rules every generated set must follow.
function assertValid(readings, today) {
  const seen = new Set();
  const perDay = new Map();

  for (const { date, slot, value } of readings) {
    assert.ok(Number.isInteger(value), `${value} is not an integer`);
    assert.ok(value >= MIN_VALUE && value <= MAX_VALUE, `${value} out of range`);
    assert.ok(SLOT_KEYS.has(slot), `unknown slot ${slot}`);
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(date <= today, `${date} is after ${today}`);

    const key = `${date}|${slot}`;
    assert.ok(!seen.has(key), `duplicate ${key}`);
    seen.add(key);
    perDay.set(date, (perDay.get(date) || 0) + 1);
  }

  for (const [date, count] of perDay) {
    assert.ok(count <= MAX_READINGS_PER_DAY, `${count} readings on ${date}`);
  }
}

// The first and last dates with readings, and the set of dates used.
function span(readings) {
  const dates = readings.map((r) => r.date).sort();
  return { first: dates[0], last: dates.at(-1), days: new Set(dates) };
}

test('is deterministic', () => {
  assert.deepEqual(generateSampleReadings('2026-11-11'), generateSampleReadings('2026-11-11'));
});

test('produces valid readings', () => {
  for (const today of ['2026-11-11', '2026-12-01', '2027-01-15', '2028-03-31', '2026-02-28']) {
    assertValid(generateSampleReadings(today), today);
  }
});

test('covers the previous month and month-to-date only', () => {
  const readings = generateSampleReadings('2026-11-11');
  const { days } = span(readings);
  const expected = datesBetween('2026-10-01', '2026-11-11');

  for (const date of days) assert.ok(expected.includes(date), `${date} outside the range`);
  // Most days have data, so both periods are populated.
  assert.ok(days.size >= expected.length * 0.8);
  assert.ok([...days].some((d) => d.startsWith('2026-10-')));
  assert.ok([...days].some((d) => d.startsWith('2026-11-')));
});

test('mixes full days, partial days and empty days', () => {
  const readings = generateSampleReadings('2026-11-11');
  const counts = new Map();
  for (const { date } of readings) counts.set(date, (counts.get(date) || 0) + 1);

  const allDays = datesBetween('2026-10-01', '2026-11-11');
  const values = allDays.map((date) => counts.get(date) || 0);
  assert.ok(values.includes(4));
  assert.ok(values.some((n) => n === 2 || n === 3));
  assert.ok(values.includes(0));
});

test('works when today is the 1st of a month', () => {
  const readings = generateSampleReadings('2026-12-01');
  const { days } = span(readings);
  for (const date of days) {
    assert.ok(date >= '2026-11-01' && date <= '2026-12-01', `${date} outside the range`);
  }
  assert.ok([...days].some((d) => d.startsWith('2026-11-')));
});

test('in January the previous month is December of the year before', () => {
  const readings = generateSampleReadings('2027-01-10');
  const { first, days } = span(readings);
  assert.ok(first >= '2026-12-01');
  assert.ok([...days].some((d) => d.startsWith('2026-12-')));
  for (const date of days) assert.ok(date <= '2027-01-10');
});

test('handles leap-year February', () => {
  const readings = generateSampleReadings('2028-03-05');
  const { days } = span(readings);
  for (const date of days) {
    assert.ok(date >= '2028-02-01' && date <= '2028-03-05', `${date} outside the range`);
  }
  // Feb 29 exists in 2028 and gets readings in this data set.
  assert.ok(days.has('2028-02-29'));
  assert.ok(days.has('2028-02-01'));
});

test('has a reading for today', () => {
  for (const today of ['2026-11-11', '2026-12-01', '2027-01-10', '2028-03-05']) {
    assert.ok(generateSampleReadings(today).some((r) => r.date === today), today);
  }
});
