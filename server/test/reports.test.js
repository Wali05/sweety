// API tests for the /reports routes, run against the real database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, auth, registerCleanup, signUpUser } from './helpers.js';
import { todayInAppTimezone } from '../src/validation/readings.js';

registerCleanup();

const ENDPOINTS = ['/reports/daily', '/reports/month-to-date', '/reports/previous-month'];
const EMPTY_MESSAGE = 'No readings for this period yet.';
// A date in the past, so none of the readings below are in the future.
const SELECTED = '2026-10-15';

function report(account, path, date) {
  const query = date === undefined ? '' : `?date=${date}`;
  return request(app).get(`${path}${query}`).set(auth(account));
}

// Adds readings through the API. Each entry is [date, slot, value].
async function addReadings(account, entries) {
  for (const [date, slot, value] of entries) {
    const res = await request(app)
      .post('/readings')
      .set(auth(account))
      .send({ date, slot, value });
    assert.equal(res.status, 201, `${date} ${slot}: ${JSON.stringify(res.body)}`);
  }
}

// The day after a 'YYYY-MM-DD' date, as a 'YYYY-MM-DD' string.
function nextDay(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

test('requests without a token get 401', async () => {
  for (const path of ENDPOINTS) {
    const res = await request(app).get(`${path}?date=${SELECTED}`);
    assert.equal(res.status, 401, path);
  }
});

test('an invalid date is rejected', async () => {
  const account = await signUpUser();

  for (const path of ENDPOINTS) {
    // 0000-06-15 and 0001-01-15 once gave a 500 and a 1900 range.
    for (const date of ['2026-02-30', '2026-13-01', '15-10-2026', 'yesterday', '0000-06-15', '0001-01-15']) {
      const res = await report(account, path, date);
      assert.equal(res.status, 400, `${path} ${date}`);
      assert.equal(res.body.error, 'Date is not valid.');
    }
  }
});

test('a future date is rejected and today is accepted', async () => {
  const account = await signUpUser();
  const today = todayInAppTimezone();

  for (const path of ENDPOINTS) {
    const future = await report(account, path, nextDay(today));
    assert.equal(future.status, 400, path);
    assert.equal(future.body.error, 'Date cannot be in the future.');

    const ok = await report(account, path, today);
    assert.equal(ok.status, 200, path);
    assert.equal(ok.body.date, today);
  }
});

test('the date defaults to today', async () => {
  const account = await signUpUser();

  const res = await report(account, '/reports/daily');
  assert.equal(res.status, 200);
  assert.equal(res.body.date, todayInAppTimezone());
});

test('a user with no readings gets the empty payload', async () => {
  const account = await signUpUser();

  const daily = await report(account, '/reports/daily', SELECTED);
  assert.equal(daily.status, 200);
  assert.deepEqual(daily.body, {
    report: 'daily',
    date: SELECTED,
    from: SELECTED,
    to: SELECTED,
    count: 0,
    highest: null,
    lowest: null,
    average: null,
    empty: true,
    message: EMPTY_MESSAGE,
    readings: [],
  });

  const monthToDate = await report(account, '/reports/month-to-date', SELECTED);
  assert.equal(monthToDate.status, 200);
  assert.deepEqual(monthToDate.body, {
    report: 'month-to-date',
    date: SELECTED,
    from: '2026-10-01',
    to: SELECTED,
    count: 0,
    highest: null,
    lowest: null,
    average: null,
    empty: true,
    message: EMPTY_MESSAGE,
  });

  const previousMonth = await report(account, '/reports/previous-month', SELECTED);
  assert.equal(previousMonth.status, 200);
  assert.deepEqual(previousMonth.body, {
    report: 'previous-month',
    date: SELECTED,
    from: '2026-09-01',
    to: '2026-09-30',
    count: 0,
    highest: null,
    lowest: null,
    average: null,
    empty: true,
    message: EMPTY_MESSAGE,
  });
});

test('daily report has the numbers and lists readings in slot order', async () => {
  const account = await signUpUser();

  // Created out of slot order on purpose.
  await addReadings(account, [
    [SELECTED, 'after_dinner', 180],
    [SELECTED, 'morning_fasting', 95],
    [SELECTED, 'after_lunch', 151],
    [SELECTED, 'after_breakfast', 140],
    // Neighbouring days, which the daily report must leave out.
    ['2026-10-14', 'after_lunch', 300],
    ['2026-10-16', 'after_lunch', 50],
  ]);

  const res = await report(account, '/reports/daily', SELECTED);
  assert.equal(res.status, 200);

  const { readings, ...summary } = res.body;
  assert.deepEqual(summary, {
    report: 'daily',
    date: SELECTED,
    from: SELECTED,
    to: SELECTED,
    count: 4,
    highest: 180,
    lowest: 95,
    // 566 / 4 = 141.5
    average: 141.5,
    empty: false,
    message: null,
  });

  assert.ok(readings.every((reading) => typeof reading.id === 'string'));
  assert.deepEqual(
    readings.map(({ slot, slotLabel, value }) => ({ slot, slotLabel, value })),
    [
      { slot: 'morning_fasting', slotLabel: 'Morning (fasting)', value: 95 },
      { slot: 'after_breakfast', slotLabel: 'After breakfast', value: 140 },
      { slot: 'after_lunch', slotLabel: 'After lunch', value: 151 },
      { slot: 'after_dinner', slotLabel: 'After dinner', value: 180 },
    ],
  );
});

test('month-to-date covers the 1st up to the selected date only', async () => {
  const account = await signUpUser();

  await addReadings(account, [
    // Inside the range, including both ends.
    ['2026-10-01', 'morning_fasting', 100],
    ['2026-10-08', 'after_lunch', 101],
    [SELECTED, 'after_dinner', 101],
    // Later in the same month.
    ['2026-10-16', 'after_lunch', 400],
    ['2026-10-31', 'after_lunch', 500],
    // The previous month.
    ['2026-09-30', 'after_lunch', 45],
  ]);

  const res = await report(account, '/reports/month-to-date', SELECTED);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    report: 'month-to-date',
    date: SELECTED,
    from: '2026-10-01',
    to: SELECTED,
    count: 3,
    highest: 101,
    lowest: 100,
    // 302 / 3 = 100.666..., rounded to 1 decimal.
    average: 100.7,
    empty: false,
    message: null,
  });
});

test('previous-month covers exactly the whole previous month', async () => {
  const account = await signUpUser();

  await addReadings(account, [
    // Inside the range, including both ends.
    ['2026-09-01', 'morning_fasting', 90],
    ['2026-09-15', 'after_lunch', 160],
    ['2026-09-30', 'after_dinner', 200],
    // The day before the range and the month of the selected date.
    ['2026-08-31', 'after_lunch', 45],
    ['2026-10-01', 'after_lunch', 500],
    [SELECTED, 'after_lunch', 550],
  ]);

  const res = await report(account, '/reports/previous-month', SELECTED);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    report: 'previous-month',
    date: SELECTED,
    from: '2026-09-01',
    to: '2026-09-30',
    count: 3,
    highest: 200,
    lowest: 90,
    average: 150,
    empty: false,
    message: null,
  });

  // The same result for any selected date in October.
  const lastDay = await report(account, '/reports/previous-month', '2026-10-31');
  assert.equal(lastDay.body.from, '2026-09-01');
  assert.equal(lastDay.body.to, '2026-09-30');
  assert.equal(lastDay.body.count, 3);
});

test("another user's readings never appear in reports", async () => {
  const owner = await signUpUser();
  const other = await signUpUser();

  await addReadings(owner, [
    [SELECTED, 'after_lunch', 120],
    ['2026-10-02', 'after_lunch', 130],
    ['2026-09-10', 'after_lunch', 140],
  ]);
  await addReadings(other, [
    [SELECTED, 'after_lunch', 250],
    ['2026-09-10', 'after_lunch', 260],
  ]);

  // A third user with nothing of their own sees empty reports.
  const stranger = await signUpUser();
  for (const path of ENDPOINTS) {
    const res = await report(stranger, path, SELECTED);
    assert.equal(res.status, 200, path);
    assert.equal(res.body.count, 0, path);
    assert.equal(res.body.empty, true, path);
    assert.equal(res.body.message, EMPTY_MESSAGE, path);
  }

  // Each user's numbers come from their own readings only.
  const ownerDaily = await report(owner, '/reports/daily', SELECTED);
  assert.equal(ownerDaily.body.count, 1);
  assert.deepEqual(ownerDaily.body.readings.map((r) => r.value), [120]);

  const otherDaily = await report(other, '/reports/daily', SELECTED);
  assert.equal(otherDaily.body.count, 1);
  assert.deepEqual(otherDaily.body.readings.map((r) => r.value), [250]);

  const ownerMonth = await report(owner, '/reports/month-to-date', SELECTED);
  assert.equal(ownerMonth.body.count, 2);
  assert.equal(ownerMonth.body.highest, 130);
  assert.equal(ownerMonth.body.average, 125);

  const otherMonth = await report(other, '/reports/month-to-date', SELECTED);
  assert.equal(otherMonth.body.count, 1);
  assert.equal(otherMonth.body.highest, 250);

  const ownerPrevious = await report(owner, '/reports/previous-month', SELECTED);
  assert.equal(ownerPrevious.body.count, 1);
  assert.equal(ownerPrevious.body.highest, 140);

  const otherPrevious = await report(other, '/reports/previous-month', SELECTED);
  assert.equal(otherPrevious.body.count, 1);
  assert.equal(otherPrevious.body.lowest, 260);
});
