// Loads environment variables and exposes them as one config object.
// Import this module before anything that reads process.env.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '..');
const repoRoot = path.resolve(serverDir, '..');

// The shared .env lives at the repository root. A server/.env is also read
// as a fallback; dotenv never overrides variables that are already set.
dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });
dotenv.config({ path: path.join(serverDir, '.env'), quiet: true });

const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  // How long a login lasts; any value jsonwebtoken accepts, e.g. "7d" or "12h".
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // IANA time zone that decides what "today" is, independent of the server clock.
  appTimezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  // Optional: report results are cached in Redis when this is set.
  redisUrl: process.env.REDIS_URL || null,
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env at the repository root.');
}

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is not set. Copy .env.example to .env at the repository root.');
}

export default config;
