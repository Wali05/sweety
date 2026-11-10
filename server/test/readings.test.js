// API tests for the /readings routes, run against the real database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, auth, registerCleanup, signUpUser } from './helpers.js';
import { todayInAppTimezone } from '../src/validation/readings.js';

registerCleanup();

const DUPLICATE_AFTER_LUNCH = 'You already have an After lunch reading for this date.';
const OUT_OF_RANGE = 'Value must be between 40 and 600 mg/dl.';
const NOT_FOUND = 'Reading not found.';
const SLOT_ORDER = ['morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner'];

function post(account, body) {
  return request(app).post('/readings').set(auth(account)).send(body);
}

// The day after a 'YYYY-MM-DD' date, as a 'YYYY-MM-DD' string.
function nextDay(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

test('requests without a token get 401', async () => {
  const list = await request(app).get('/readings');
  assert.equal(list.status, 401);

  const create = await request(app)
    .post('/readings')
    .send({ date: '2026-10-01', slot: 'after_lunch', value: 120 });
  assert.equal(create.status, 401);
});

test('creates a valid reading', async () => {
  const account = await signUpUser();
  const res = await post(account, { date: '2026-10-01', slot: 'after_lunch', value: 120 });

  assert.equal(res.status, 201);
  const { reading } = res.body;
  assert.equal(reading.date, '2026-10-01');
  assert.equal(reading.slot, 'after_lunch');
  assert.equal(reading.slotLabel, 'After lunch');
  assert.equal(reading.value, 120);
  assert.equal(typeof reading.id, 'string');
});

test('a missing or empty value is rejected', async () => {
  const account = await signUpUser();

  for (const body of [
    { date: '2026-10-02', slot: 'after_lunch' },
    { date: '2026-10-02', slot: 'after_lunch', value: '' },
  ]) {
    const res = await post(account, body);
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Please enter a glucose value.');
  }
});

test('values outside 40 to 600 or not whole numbers are rejected', async () => {
  const account = await signUpUser();

  for (const value of [39, 601, 120.5]) {
    const res = await post(account, { date: '2026-10-03', slot: 'after_lunch', value });
    assert.equal(res.status, 400, `value ${value}`);
    assert.equal(res.body.error, OUT_OF_RANGE);
  }
});

test('the boundary values 40 and 600 are accepted', async () => {
  const account = await signUpUser();

  const low = await post(account, { date: '2026-10-04', slot: 'morning_fasting', value: 40 });
  assert.equal(low.status, 201);
  assert.equal(low.body.reading.value, 40);

  const high = await post(account, { date: '2026-10-04', slot: 'after_dinner', value: 600 });
  assert.equal(high.status, 201);
  assert.equal(high.body.reading.value, 600);
});

test('a future date is rejected and today is accepted', async () => {
  const account = await signUpUser();
  const today = todayInAppTimezone();

  const future = await post(account, { date: nextDay(today), slot: 'after_lunch', value: 120 });
  assert.equal(future.status, 400);
  assert.equal(future.body.error, 'Date cannot be in the future.');

  const ok = await post(account, { date: today, slot: 'after_lunch', value: 120 });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.reading.date, today);
});

test('a second reading in the same slot is rejected', async () => {
  const account = await signUpUser();
  const body = { date: '2026-10-05', slot: 'after_lunch', value: 120 };

  const first = await post(account, body);
  assert.equal(first.status, 201);

  const second = await post(account, { ...body, value: 130 });
  assert.equal(second.status, 409);
  assert.equal(second.body.error, DUPLICATE_AFTER_LUNCH);
});

test('two concurrent creates for the same slot give one 201 and one 409', async () => {
  const account = await signUpUser();
  const body = { date: '2026-10-06', slot: 'after_lunch', value: 120 };

  const responses = await Promise.all([post(account, body), post(account, body)]);
  const statuses = responses.map((res) => res.status).sort();
  assert.deepEqual(statuses, [201, 409]);

  const rejected = responses.find((res) => res.status === 409);
  assert.equal(rejected.body.error, DUPLICATE_AFTER_LUNCH);

  const list = await request(app).get('/readings?date=2026-10-06').set(auth(account));
  assert.equal(list.body.readings.length, 1);
});

test('a fifth reading on a full day is rejected', async () => {
  const account = await signUpUser();

  for (const slot of SLOT_ORDER) {
    const res = await post(account, { date: '2026-10-07', slot, value: 110 });
    assert.equal(res.status, 201, slot);
  }

  const extra = await post(account, { date: '2026-10-07', slot: 'after_lunch', value: 110 });
  assert.equal(extra.status, 409);
  assert.equal(extra.body.error, 'You can add only 4 readings per day.');
});

test('list by date is in slot order and is private to the user', async () => {
  const owner = await signUpUser();
  const other = await signUpUser();

  // Created out of order on purpose.
  for (const slot of ['after_dinner', 'morning_fasting', 'after_lunch', 'after_breakfast']) {
    const res = await post(owner, { date: '2026-10-08', slot, value: 100 });
    assert.equal(res.status, 201);
  }
  // A different day, which the date filter must leave out.
  await post(owner, { date: '2026-10-09', slot: 'after_lunch', value: 100 });

  const list = await request(app).get('/readings?date=2026-10-08').set(auth(owner));
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.readings.map((r) => r.slot), SLOT_ORDER);
  assert.ok(list.body.readings.every((r) => r.date === '2026-10-08'));

  const othersDay = await request(app).get('/readings?date=2026-10-08').set(auth(other));
  assert.equal(othersDay.status, 200);
  assert.deepEqual(othersDay.body.readings, []);

  const othersAll = await request(app).get('/readings').set(auth(other));
  assert.deepEqual(othersAll.body.readings, []);
});

test("another user's reading and a malformed id give 404", async () => {
  const owner = await signUpUser();
  const other = await signUpUser();

  const created = await post(owner, { date: '2026-10-10', slot: 'after_lunch', value: 120 });
  const { id } = created.body.reading;

  const attempts = [
    () => request(app).get(`/readings/${id}`),
    () => request(app).patch(`/readings/${id}`).send({ value: 200 }),
    () => request(app).delete(`/readings/${id}`),
  ];
  for (const attempt of attempts) {
    const res = await attempt().set(auth(other));
    assert.equal(res.status, 404);
    assert.equal(res.body.error, NOT_FOUND);
  }

  // Untouched for the owner.
  const still = await request(app).get(`/readings/${id}`).set(auth(owner));
  assert.equal(still.status, 200);
  assert.equal(still.body.reading.value, 120);

  const malformed = await request(app).get('/readings/not-a-uuid').set(auth(owner));
  assert.equal(malformed.status, 404);
  assert.equal(malformed.body.error, NOT_FOUND);
});

test('edit and delete a reading', async () => {
  const account = await signUpUser();
  const date = '2026-10-11';

  const lunch = await post(account, { date, slot: 'after_lunch', value: 120 });
  const dinner = await post(account, { date, slot: 'after_dinner', value: 140 });
  assert.equal(lunch.status, 201);
  assert.equal(dinner.status, 201);
  const dinnerId = dinner.body.reading.id;

  const edited = await request(app)
    .patch(`/readings/${dinnerId}`)
    .set(auth(account))
    .send({ value: 150 });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.reading.value, 150);
  assert.equal(edited.body.reading.slot, 'after_dinner');
  assert.equal(edited.body.reading.date, date);

  const moved = await request(app)
    .patch(`/readings/${dinnerId}`)
    .set(auth(account))
    .send({ slot: 'after_lunch' });
  assert.equal(moved.status, 409);
  assert.equal(moved.body.error, DUPLICATE_AFTER_LUNCH);

  const removed = await request(app).delete(`/readings/${dinnerId}`).set(auth(account));
  assert.equal(removed.status, 204);

  const gone = await request(app).get(`/readings/${dinnerId}`).set(auth(account));
  assert.equal(gone.status, 404);
  assert.equal(gone.body.error, NOT_FOUND);
});
