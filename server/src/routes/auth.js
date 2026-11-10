// Sign-up, login and "who am I" routes, mounted at /auth.
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { createUser, findUserByEmailWithHash } from '../models/users.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();

const BCRYPT_COST = 10;
const MIN_PASSWORD_LENGTH = 8;
// bcrypt only looks at the first 72 bytes of a password, so reject longer ones.
const MAX_PASSWORD_BYTES = 72;
// Deliberately simple: something@something.something with no spaces.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Compared against when the email is unknown, so both login failures take
// about the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Returns an error message, or null when the sign-up input is valid.
function validateSignup({ name, email, password }) {
  if (!name) return 'Name is required.';
  if (!email) return 'Email is required.';
  if (!EMAIL_PATTERN.test(email)) return 'Email is not valid.';
  if (typeof password !== 'string' || password === '') return 'Password is required.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} bytes.`;
  }
  return null;
}

router.post('/signup', async (req, res) => {
  const body = req.body || {};
  const name = asTrimmedString(body.name);
  const email = asTrimmedString(body.email).toLowerCase();
  const password = body.password;

  const problem = validateSignup({ name, email, password });
  if (problem) {
    return res.status(400).json({ error: problem });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  let user;
  try {
    user = await createUser({ name, email, passwordHash });
  } catch (err) {
    // 23505 = unique_violation: the email is already registered.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    throw err;
  }

  res.status(201).json({ user, token: signToken(user) });
});

router.post('/login', async (req, res) => {
  const body = req.body || {};
  const email = asTrimmedString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  const found = email ? await findUserByEmailWithHash(email) : null;
  const matches = await bcrypt.compare(password, found ? found.password_hash : DUMMY_HASH);

  // Same message for an unknown email and a wrong password.
  if (!found || !matches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const user = { id: found.id, name: found.name, email: found.email };
  res.json({ user, token: signToken(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
