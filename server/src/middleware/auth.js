// Auth middleware: requires "Authorization: Bearer <token>", verifies the
// JWT and attaches the current user to req.user as { id, name, email }.
import jwt from 'jsonwebtoken';
import config from '../config.js';
import { findUserById } from '../models/users.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn,
  });
}

export async function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const [scheme, token] = header.split(' ');

  if (!/^Bearer$/i.test(scheme) || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    // Covers bad signatures, malformed tokens and expired tokens.
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  try {
    const user = await findUserById(payload.sub);
    if (!user) {
      // The account was deleted after the token was issued.
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
