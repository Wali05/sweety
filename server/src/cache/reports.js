// Report cache. Each user has one Redis hash holding their cached reports,
// one field per report and date, so clearing a user's reports is a single DEL.
// Every function swallows cache errors: a report is then read from the
// database as if nothing had been cached.
import { getCacheClient, warnCacheFailure } from './redis.js';

// Safety net only; writes to readings clear the cache straight away.
const TTL_SECONDS = 300;

function userKey(userId) {
  return `sweety:reports:${userId}`;
}

function reportField(report, date) {
  return `${report}:${date}`;
}

// The cached report body, or null on a miss or a cache failure.
export async function getCachedReport(userId, report, date) {
  try {
    const client = await getCacheClient();
    if (!client) return null;

    const cached = await client.hGet(userKey(userId), reportField(report, date));
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    warnCacheFailure('get', err);
    return null;
  }
}

export async function cacheReport(userId, report, date, body) {
  try {
    const client = await getCacheClient();
    if (!client) return;

    const key = userKey(userId);
    await client.hSet(key, reportField(report, date), JSON.stringify(body));
    await client.expire(key, TTL_SECONDS);
  } catch (err) {
    warnCacheFailure('set', err);
  }
}

// Clears every cached report of one user, whatever the kind or date.
export async function invalidateReports(userId) {
  try {
    const client = await getCacheClient();
    if (!client) return;

    await client.del(userKey(userId));
  } catch (err) {
    warnCacheFailure('del', err);
  }
}
