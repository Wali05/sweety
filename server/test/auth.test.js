// API tests for the /auth routes and the token check, run against the real
// database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import config from '../src/config.js';
import pool from '../src/db/pool.js';
import { app, auth, registerCleanup, signUpUser } from './helpers.js';

registerCleanup();

const PASSWORD = 'test-password-123';
const DUPLICATE = 'An account with this email already exists.';
const INVALID_TOKEN = 'Invalid or expired token.';

test('sign-up stores the email in lower case and login ignores its case', async () => {
  const email = `Mixed-${randomUUID()}@Example.TEST`;
  const res = await request(app)
    .post('/auth/signup')
    .send({ name: ' Asha ', email: ` ${email} `, password: PASSWORD });

  try {
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, email.toLowerCase());
    assert.equal(res.body.user.name, 'Asha');
    assert.equal(res.body.user.password_hash, undefined);

    const login = await request(app)
      .post('/auth/login')
      .send({ email: email.toUpperCase(), password: PASSWORD });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.id, res.body.user.id);
  } finally {
    await pool.query('DELETE FROM users WHERE email = $1', [email.toLowerCase()]);
  }
});

test('signing up again with the same email in any case is refused', async () => {
  const account = await signUpUser();

  for (const email of [account.user.email, account.user.email.toUpperCase()]) {
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'Someone Else', email, password: PASSWORD });
    assert.equal(res.status, 409, email);
    assert.equal(res.body.error, DUPLICATE);
  }
});

test('a wrong password and an unknown email get the same 401', async () => {
  const account = await signUpUser();

  const wrong = await request(app)
    .post('/auth/login')
    .send({ email: account.user.email, password: 'wrong-password' });
  const unknown = await request(app)
    .post('/auth/login')
    .send({ email: `nobody-${randomUUID()}@example.test`, password: PASSWORD });

  for (const res of [wrong, unknown]) {
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid email or password.');
  }
});

test('sign-up checks name, email and password', async () => {
  const cases = [
    [{ email: 'a@example.test', password: PASSWORD }, 'Name is required.'],
    [{ name: 'A', password: PASSWORD }, 'Email is required.'],
    [{ name: 'A', email: 'not-an-email', password: PASSWORD }, 'Email is not valid.'],
    [{ name: 'A', email: 'a@example.test' }, 'Password is required.'],
    [{ name: 'A', email: 'a@example.test', password: 'short' }, 'Password must be at least 8 characters.'],
  ];

  for (const [body, message] of cases) {
    const res = await request(app).post('/auth/signup').send(body);
    assert.equal(res.status, 400, message);
    assert.equal(res.body.error, message);
  }
});

test('missing, malformed, forged and expired tokens get 401', async () => {
  const account = await signUpUser();
  const sub = account.user.id;

  const missing = await request(app).get('/auth/me');
  assert.equal(missing.status, 401);
  assert.equal(missing.body.error, 'Authentication required.');

  const tokens = [
    'not-a-jwt',
    jwt.sign({ sub }, 'some-other-secret', { algorithm: 'HS256' }),
    jwt.sign({ sub, exp: Math.floor(Date.now() / 1000) - 60 }, config.jwtSecret, {
      algorithm: 'HS256',
    }),
  ];
  for (const token of tokens) {
    for (const path of ['/auth/me', '/readings', '/reports/daily']) {
      const res = await request(app).get(path).set({ Authorization: `Bearer ${token}` });
      assert.equal(res.status, 401, path);
      assert.equal(res.body.error, INVALID_TOKEN);
    }
  }

  const me = await request(app).get('/auth/me').set(auth(account));
  assert.equal(me.status, 200);
  assert.equal(me.body.user.id, sub);
});
