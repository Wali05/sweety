import { describe, expect, it } from 'vitest';
import { SLOTS } from '../readings/slots.js';
import {
  buildChartData,
  chartSummary,
  countReadings,
  emptyChartMessage,
  monthToDateRange,
  valueAxis,
} from '../reports/chartData.js';

const reading = (date, slot, value) => ({ id: `${date}-${slot}`, date, slot, value });

// As the API sends them: newest date first.
const READINGS = [
  reading('2026-10-05', 'morning_fasting', 101),
  reading('2026-10-05', 'after_dinner', 188),
  reading('2026-10-03', 'after_lunch', 151),
  reading('2026-10-01', 'morning_fasting', 95),
  reading('2026-10-01', 'after_breakfast', 140),
];

const NO_READINGS = {
  morning_fasting: null,
  after_breakfast: null,
  after_lunch: null,
  after_dinner: null,
};

describe('monthToDateRange', () => {
  it("runs from the 1st of the date's month to the date", () => {
    expect(monthToDateRange('2026-11-11')).toEqual({ from: '2026-11-01', to: '2026-11-11' });
    expect(monthToDateRange('2026-02-01')).toEqual({ from: '2026-02-01', to: '2026-02-01' });
    expect(monthToDateRange('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('buildChartData', () => {
  it('has one point for every day of the range, in date order', () => {
    const points = buildChartData(READINGS, '2026-10-01', '2026-10-05');

    expect(points.map((point) => point.day)).toEqual([1, 2, 3, 4, 5]);
    expect(points.map((point) => point.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
    ]);
  });

  it('fills a whole month, with two-digit days in the dates', () => {
    const points = buildChartData([], '2026-10-01', '2026-10-31');

    expect(points).toHaveLength(31);
    expect(points[8]).toEqual({ day: 9, date: '2026-10-09', ...NO_READINGS });
    expect(points[30]).toEqual({ day: 31, date: '2026-10-31', ...NO_READINGS });
  });

  it('puts each value in its own day and slot, and leaves the rest null', () => {
    const points = buildChartData(READINGS, '2026-10-01', '2026-10-05');

    expect(points).toEqual([
      { day: 1, date: '2026-10-01', ...NO_READINGS, morning_fasting: 95, after_breakfast: 140 },
      { day: 2, date: '2026-10-02', ...NO_READINGS },
      { day: 3, date: '2026-10-03', ...NO_READINGS, after_lunch: 151 },
      { day: 4, date: '2026-10-04', ...NO_READINGS },
      { day: 5, date: '2026-10-05', ...NO_READINGS, morning_fasting: 101, after_dinner: 188 },
    ]);
  });

  it('keeps the slots in slot order on every point, whatever order the readings come in', () => {
    const points = buildChartData([...READINGS].reverse(), '2026-10-01', '2026-10-05');

    for (const point of points) {
      expect(Object.keys(point)).toEqual(['day', 'date', ...SLOTS.map((slot) => slot.key)]);
    }
  });

  it('uses null and never zero for a day without readings', () => {
    const [, second] = buildChartData(READINGS, '2026-10-01', '2026-10-05');

    for (const slot of SLOTS) expect(second[slot.key]).toBeNull();
  });

  it('leaves out readings outside the range or with an unknown slot', () => {
    const points = buildChartData(
      [
        reading('2026-09-30', 'after_lunch', 200),
        reading('2026-10-03', 'after_lunch', 210),
        reading('2026-10-02', 'bedtime', 220),
        reading('2026-10-02', 'date', 230),
        reading('2026-10-01', 'after_lunch', 151),
      ],
      '2026-10-01',
      '2026-10-02'
    );

    expect(points).toEqual([
      { day: 1, date: '2026-10-01', ...NO_READINGS, after_lunch: 151 },
      { day: 2, date: '2026-10-02', ...NO_READINGS },
    ]);
  });

  it('has a single point when the range is one day', () => {
    expect(buildChartData([], '2026-10-01', '2026-10-01')).toEqual([
      { day: 1, date: '2026-10-01', ...NO_READINGS },
    ]);
  });
});

describe('countReadings', () => {
  it('counts the values the points hold', () => {
    expect(countReadings(buildChartData(READINGS, '2026-10-01', '2026-10-05'))).toBe(5);
    expect(countReadings(buildChartData(READINGS, '2026-10-01', '2026-10-04'))).toBe(3);
    expect(countReadings(buildChartData([], '2026-10-01', '2026-10-05'))).toBe(0);
  });
});

describe('chart texts', () => {
  it('says how many readings the range has', () => {
    expect(chartSummary(12, '2026-11-01', '2026-11-11')).toBe(
      '12 readings from 1 Nov – 11 Nov 2026'
    );
    expect(chartSummary(1, '2026-11-01', '2026-11-11')).toBe('1 reading from 1 Nov – 11 Nov 2026');
    expect(chartSummary(3, '2026-11-01', '2026-11-01')).toBe('3 readings on 1 Nov 2026');
  });

  it('has a message for a range without readings', () => {
    expect(emptyChartMessage('2026-09-01', '2026-09-10')).toBe(
      'No readings from 1 Sep – 10 Sep 2026 yet. Add some and they will show up here.'
    );
    expect(emptyChartMessage('2026-09-01', '2026-09-01')).toBe(
      'No readings on 1 Sep 2026 yet. Add some and they will show up here.'
    );
  });
});

describe('valueAxis', () => {
  const pointsWith = (...values) =>
    values.map((value, index) => ({
      day: index + 1,
      date: `2026-10-0${index + 1}`,
      ...NO_READINGS,
      after_lunch: value,
    }));

  it('always takes in the 70–180 reference range', () => {
    expect(valueAxis(pointsWith(120, 130))).toEqual({
      domain: [60, 180],
      ticks: [60, 80, 100, 120, 140, 160, 180],
    });
    expect(valueAxis(pointsWith(null))).toEqual(valueAxis(pointsWith(120)));
  });

  it('widens to round numbers around the lowest and highest values', () => {
    expect(valueAxis(pointsWith(82, 210))).toEqual({
      domain: [50, 250],
      ticks: [50, 100, 150, 200, 250],
    });
    expect(valueAxis(pointsWith(40, 600))).toEqual({
      domain: [0, 600],
      ticks: [0, 100, 200, 300, 400, 500, 600],
    });
  });
});
