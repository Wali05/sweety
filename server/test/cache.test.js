// API tests for the report cache, run against the real database with an
// in-memory stand-in for Redis.
import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, auth, registerCleanup, signUpUser } from './helpers.js';
import pool from '../src/db/pool.js';
import { resetCacheClient, setCacheClient } from '../src/cache/redis.js';

registerCleanup();
after(resetCacheClient);

// A date in the past, so none of the readings below are in the future.
const SELECTED = '2026-10-15';

// Map-backed stand-in for the few Redis hash commands the cache uses.
function memoryClient() {
  const hashes = new Map();
  return {
    hashes,
    async hGet(key, field) {
      return hashes.get(key)?.get(field) ?? null;
    },
    async hSet(key, field, value) {
      if (!hashes.has(key)) hashes.set(key, new Map());
      hashes.get(key).set(field, value);
      return 1;
    },
    async expire() {
      return 1;
    },
    async del(key) {
      return hashes.delete(key) ? 1 : 0;
    },
  };
}

// A client where every command fails, as if Redis went away mid-request.
function brokenClient() {
  const fail = async () => {
    throw new Error('redis is down');
  };
  return { hGet: fail, hSet: fail, expire: fail, del: fail };
}

let cache;

beforeEach(() => {
  cache = memoryClient();
  setCacheClient(cache);
});

function report(account, path, date = SELECTED) {
  return request(app).get(`${path}?date=${date}`).set(auth(account));
}

function addReading(account, date, slot, value) {
  return request(app).post('/readings').set(auth(account)).send({ date, slot, value });
}

// Inserts a reading behind the API's back, so the cache is not cleared.
async function insertDirectly(account, date, slot, value) {
  await pool.query(
    'INSERT INTO readings (user_id, reading_date, slot, value) VALUES ($1, $2, $3, $4)',
    [account.user.id, date, slot, value],
  );
}

test('a cached report is reused until a reading is created', async () => {
  const account = await signUpUser();
  assert.equal((await addReading(account, SELECTED, 'morning_fasting', 100)).status, 201);

  const first = await report(account, '/reports/daily');
  assert.equal(first.status, 200);
  assert.equal(first.body.count, 1);

  await insertDirectly(account, SELECTED, 'after_breakfast', 200);

  const cached = await report(account, '/reports/daily');
  assert.equal(cached.status, 200);
  assert.deepEqual(cached.body, first.body);

  assert.equal((await addReading(account, SELECTED, 'after_lunch', 300)).status, 201);

  const fresh = await report(account, '/reports/daily');
  assert.equal(fresh.body.count, 3);
  assert.equal(fresh.body.highest, 300);
  assert.equal(fresh.body.average, 200);
  assert.deepEqual(fresh.body.readings.map((r) => r.value), [100, 200, 300]);
});

test('creating a reading clears all three reports', async () => {
  const account = await signUpUser();
  const paths = ['/reports/daily', '/reports/month-to-date', '/reports/previous-month'];

  for (const path of paths) {
    assert.equal((await report(account, path)).body.count, 0, path);
  }

  await insertDirectly(account, SELECTED, 'morning_fasting', 100);
  await insertDirectly(account, '2026-09-10', 'morning_fasting', 110);
  for (const path of paths) {
    assert.equal((await report(account, path)).body.count, 0, path);
  }

  assert.equal((await addReading(account, '2026-08-01', 'after_lunch', 120)).status, 201);
  for (const path of paths) {
    assert.equal((await report(account, path)).body.count, 1, path);
  }
});

test('updating and deleting a reading clear the cache', async () => {
  const account = await signUpUser();
  const created = await addReading(account, SELECTED, 'morning_fasting', 100);
  assert.equal(created.status, 201);
  const { id } = created.body.reading;

  assert.equal((await report(account, '/reports/daily')).body.highest, 100);
  assert.equal((await report(account, '/reports/month-to-date')).body.highest, 100);

  const patched = await request(app)
    .patch(`/readings/${id}`)
    .set(auth(account))
    .send({ value: 250 });
  assert.equal(patched.status, 200);

  const afterPatch = await report(account, '/reports/daily');
  assert.equal(afterPatch.body.highest, 250);
  assert.deepEqual(afterPatch.body.readings.map((r) => r.value), [250]);
  assert.equal((await report(account, '/reports/month-to-date')).body.highest, 250);

  const deleted = await request(app).delete(`/readings/${id}`).set(auth(account));
  assert.equal(deleted.status, 204);

  const afterDelete = await report(account, '/reports/daily');
  assert.equal(afterDelete.body.count, 0);
  assert.equal(afterDelete.body.empty, true);
  assert.equal((await report(account, '/reports/month-to-date')).body.count, 0);
});

test('a failed write leaves the cache alone', async () => {
  const account = await signUpUser();
  const created = await addReading(account, SELECTED, 'morning_fasting', 100);
  assert.equal(created.status, 201);

  const first = await report(account, '/reports/daily');
  assert.equal(first.body.count, 1);

  const duplicate = await addReading(account, SELECTED, 'morning_fasting', 150);
  assert.equal(duplicate.status, 409);

  const invalid = await addReading(account, SELECTED, 'after_lunch', 9999);
  assert.equal(invalid.status, 400);

  const missingId = '00000000-0000-4000-8000-000000000000';
  const missingDelete = await request(app).delete(`/readings/${missingId}`).set(auth(account));
  assert.equal(missingDelete.status, 404);

  const missingPatch = await request(app)
    .patch(`/readings/${missingId}`)
    .set(auth(account))
    .send({ value: 150 });
  assert.equal(missingPatch.status, 404);

  await insertDirectly(account, SELECTED, 'after_dinner', 300);

  const cached = await report(account, '/reports/daily');
  assert.equal(cached.status, 200);
  assert.deepEqual(cached.body, first.body);
});

test('reports and writes still work without a cache client', async () => {
  resetCacheClient();
  const account = await signUpUser();
  assert.equal((await addReading(account, SELECTED, 'morning_fasting', 100)).status, 201);

  const first = await report(account, '/reports/daily');
  assert.equal(first.status, 200);
  assert.equal(first.body.count, 1);

  await insertDirectly(account, SELECTED, 'after_lunch', 200);

  const second = await report(account, '/reports/daily');
  assert.equal(second.status, 200);
  assert.equal(second.body.count, 2);
  assert.equal(second.body.average, 150);
});

test('reports and writes still work when every cache command fails', async () => {
  setCacheClient(brokenClient());
  const account = await signUpUser();

  const created = await addReading(account, SELECTED, 'morning_fasting', 100);
  assert.equal(created.status, 201);
  const { id } = created.body.reading;

  for (const path of ['/reports/daily', '/reports/month-to-date', '/reports/previous-month']) {
    assert.equal((await report(account, path)).status, 200, path);
  }

  await insertDirectly(account, SELECTED, 'after_lunch', 200);

  const daily = await report(account, '/reports/daily');
  assert.equal(daily.status, 200);
  assert.equal(daily.body.count, 2);
  assert.equal(daily.body.highest, 200);

  const patched = await request(app)
    .patch(`/readings/${id}`)
    .set(auth(account))
    .send({ value: 120 });
  assert.equal(patched.status, 200);

  const deleted = await request(app).delete(`/readings/${id}`).set(auth(account));
  assert.equal(deleted.status, 204);

  const afterDelete = await report(account, '/reports/daily');
  assert.equal(afterDelete.status, 200);
  assert.deepEqual(afterDelete.body.readings.map((r) => r.value), [200]);
});

test('cached reports are kept apart per user', async () => {
  const owner = await signUpUser();
  const other = await signUpUser();
  assert.equal((await addReading(owner, SELECTED, 'morning_fasting', 100)).status, 201);
  assert.equal((await addReading(other, SELECTED, 'morning_fasting', 250)).status, 201);

  const ownerFirst = await report(owner, '/reports/daily');
  assert.deepEqual(ownerFirst.body.readings.map((r) => r.value), [100]);

  const otherFirst = await report(other, '/reports/daily');
  assert.deepEqual(otherFirst.body.readings.map((r) => r.value), [250]);

  // A write by one user only clears that user's reports.
  await insertDirectly(owner, SELECTED, 'after_lunch', 300);
  assert.equal((await addReading(other, SELECTED, 'after_lunch', 260)).status, 201);

  const ownerCached = await report(owner, '/reports/daily');
  assert.deepEqual(ownerCached.body, ownerFirst.body);

  const otherFresh = await report(other, '/reports/daily');
  assert.deepEqual(otherFresh.body.readings.map((r) => r.value), [250, 260]);
});

test('cached reports are kept apart per report and per date', async () => {
  const account = await signUpUser();
  assert.equal((await addReading(account, '2026-10-01', 'morning_fasting', 100)).status, 201);
  assert.equal((await addReading(account, '2026-10-14', 'morning_fasting', 200)).status, 201);
  assert.equal((await addReading(account, SELECTED, 'morning_fasting', 300)).status, 201);

  const daily = await report(account, '/reports/daily');
  assert.equal(daily.body.report, 'daily');
  assert.equal(daily.body.count, 1);
  assert.ok(Array.isArray(daily.body.readings));

  const monthToDate = await report(account, '/reports/month-to-date');
  assert.equal(monthToDate.body.report, 'month-to-date');
  assert.equal(monthToDate.body.from, '2026-10-01');
  assert.equal(monthToDate.body.count, 3);
  assert.equal(monthToDate.body.readings, undefined);

  const dayBefore = await report(account, '/reports/daily', '2026-10-14');
  assert.equal(dayBefore.body.date, '2026-10-14');
  assert.deepEqual(dayBefore.body.readings.map((r) => r.value), [200]);

  const monthToDayBefore = await report(account, '/reports/month-to-date', '2026-10-14');
  assert.equal(monthToDayBefore.body.to, '2026-10-14');
  assert.equal(monthToDayBefore.body.count, 2);

  // All four are separate entries, and reading them again gives the same.
  const [entries] = [...cache.hashes.values()];
  assert.deepEqual([...entries.keys()].sort(), [
    'daily:2026-10-14',
    `daily:${SELECTED}`,
    'month-to-date:2026-10-14',
    `month-to-date:${SELECTED}`,
  ]);
  assert.deepEqual((await report(account, '/reports/daily')).body, daily.body);
  assert.deepEqual((await report(account, '/reports/month-to-date')).body, monthToDate.body);
  assert.deepEqual((await report(account, '/reports/daily', '2026-10-14')).body, dayBefore.body);
});
