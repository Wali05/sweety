// Optional Redis connection for the report cache. Everything here is
// best-effort: with no REDIS_URL, or with Redis down, getCacheClient() returns
// null and callers fall back to the database.
import { createClient } from 'redis';
import config from '../config.js';

const CONNECT_TIMEOUT_MS = 2000;
// After a failed connection, wait this long before trying again.
const RETRY_AFTER_MS = 30000;

let injected = null;
let client = null;
let connecting = null;
let retryAt = 0;

// Logs the reason only: never the Redis URL, which may hold a password.
export function warnCacheFailure(action, err) {
  const reason = err?.code || err?.message || 'unknown error';
  console.warn(`Report cache ${action} failed: ${reason}`);
}

// Lets tests swap in an in-memory stand-in with hGet, hSet, expire and del.
export function setCacheClient(standIn) {
  injected = standIn;
}

export function resetCacheClient() {
  injected = null;
}

async function connect() {
  let next = null;
  let failed = false;

  // Runs once per connection, whether connecting failed or it dropped later.
  const giveUp = (err) => {
    if (failed) return;
    failed = true;
    warnCacheFailure('connection', err);
    retryAt = Date.now() + RETRY_AFTER_MS;
    if (client === next) client = null;
    try {
      next?.destroy();
    } catch {
      // Already closed.
    }
  };

  try {
    next = createClient({
      url: config.redisUrl,
      // Fail straight away instead of queueing commands or retrying in the
      // background; the next request after RETRY_AFTER_MS reconnects.
      disableOfflineQueue: true,
      socket: { connectTimeout: CONNECT_TIMEOUT_MS, reconnectStrategy: false },
    });
    next.on('error', giveUp);
    await next.connect();
    if (failed) return null;
    client = next;
    return next;
  } catch (err) {
    giveUp(err);
    return null;
  } finally {
    connecting = null;
  }
}

// The cache client to use right now, or null when there is none.
export async function getCacheClient() {
  if (injected) return injected;
  if (!config.redisUrl) return null;
  if (client) return client;
  if (Date.now() < retryAt) return null;

  connecting ??= connect();
  return connecting;
}

// Closes the Redis connection if one was opened. Safe to call at any time.
export async function closeCache() {
  if (connecting) await connecting;
  if (!client) return;

  const open = client;
  client = null;
  try {
    await open.close();
  } catch (err) {
    warnCacheFailure('close', err);
  }
}
