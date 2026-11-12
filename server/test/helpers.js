// Shared helpers for the API tests. The tests run against the real database
// from DATABASE_URL, so they only ever touch users they created themselves.
import { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/db/pool.js';
import { closeCache } from '../src/cache/redis.js';

// Ids of the users signed up by this test file, removed again in cleanup.
const createdUserIds = [];

// Signs up a fresh user with a unique email and returns { token, user }.
export async function signUpUser() {
  const email = `test-${randomUUID()}@example.test`;
  const res = await request(app)
    .post('/auth/signup')
    .send({ name: 'Test User', email, password: 'test-password-123' });

  if (res.status !== 201) {
    throw new Error(`Test sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  createdUserIds.push(res.body.user.id);
  return { token: res.body.token, user: res.body.user };
}

// Authorization header for a signed-up user.
export function auth(account) {
  return { Authorization: `Bearer ${account.token}` };
}

// Deletes the users this run created (their readings cascade) and closes the
// pool so the test process can exit.
export async function cleanup() {
  try {
    if (createdUserIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUserIds]);
    }
  } finally {
    await pool.end();
    // Only does something when REDIS_URL is set and a connection was opened.
    await closeCache();
  }
}

// Call once at the top level of a test file that uses the database.
export function registerCleanup() {
  after(cleanup);
}

export { app };
