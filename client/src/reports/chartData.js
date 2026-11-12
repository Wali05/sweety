// Shapes a month's readings for the chart on the reports page. Pure functions
// that work on the 'YYYY-MM-DD' strings as they are, so nothing shifts with
// the browser's time zone.
import { SLOTS } from '../readings/slots.js';
import { formatDate, formatRange } from './formatRange.js';

// Reference range in mg/dl, drawn as a faint band behind the lines.
export const RANGE_LOW = 70;
export const RANGE_HIGH = 180;

// The days labelled on a phone-sized chart: the first day, then every 2nd,
// 3rd or 5th one after it once there are too many to fit side by side
// (1, 3, 5… / 1, 4, 7… / 1, 6, 11…), so the labels are always evenly spaced.
export function narrowDayTicks(points) {
  const days = points.map((point) => point.day);
  let step = 5;
  if (days.length <= 8) step = 1;
  else if (days.length <= 16) step = 2;
  else if (days.length <= 24) step = 3;
  return days.filter((day, index) => index % step === 0);
}

// The 1st of date's month up to date, the same range as the month-to-date
// report.
export function monthToDateRange(date) {
  return { from: `${date.slice(0, 8)}01`, to: date };
}

// One point per day from `from` to `to` (inclusive, in the same month), in
// date order: { day, date, <slot key>: value, ... } with day the day of the
// month and a key for each of the four slots. A slot without a reading that
// day is null, so it shows as a gap and not as zero. Readings outside the
// range or with an unknown slot are left out.
export function buildChartData(readings, from, to) {
  const month = to.slice(0, 8);
  const points = [];
  const byDate = new Map();

  for (let day = Number(from.slice(8)); day <= Number(to.slice(8)); day += 1) {
    const point = { day, date: `${month}${String(day).padStart(2, '0')}` };
    for (const slot of SLOTS) point[slot.key] = null;
    points.push(point);
    byDate.set(point.date, point);
  }

  for (const reading of readings) {
    const point = byDate.get(reading.date);
    const known = SLOTS.some((slot) => slot.key === reading.slot);
    if (point && known) point[reading.slot] = reading.value;
  }

  return points;
}

// How many readings the points hold.
export function countReadings(points) {
  return points.reduce(
    (count, point) => count + SLOTS.filter((slot) => point[slot.key] !== null).length,
    0
  );
}

// 'from 1 Nov – 11 Nov 2026', or 'on 1 Nov 2026' for a single day.
function rangePhrase(from, to) {
  return from === to ? `on ${formatDate(to)}` : `from ${formatRange(from, to)}`;
}

// The chart in words, e.g. '12 readings from 1 Nov – 11 Nov 2026'.
export function chartSummary(count, from, to) {
  return `${count} ${count === 1 ? 'reading' : 'readings'} ${rangePhrase(from, to)}`;
}

// Shown instead of the chart when the range has no readings.
export function emptyChartMessage(from, to) {
  return `No readings ${rangePhrase(from, to)} yet. Add some and they will show up here.`;
}

// The value axis as { domain: [min, max], ticks }: round numbers that take in
// every value and the reference range, with a step that keeps the ticks few.
export function valueAxis(points) {
  let low = RANGE_LOW;
  let high = RANGE_HIGH;
  for (const point of points) {
    for (const slot of SLOTS) {
      const value = point[slot.key];
      if (value === null) continue;
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  }

  const step = [20, 50, 100].find((size) => (high - low) / size <= 6) ?? 200;
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const ticks = [];
  for (let tick = min; tick <= max; tick += step) ticks.push(tick);
  return { domain: [min, max], ticks };
}
