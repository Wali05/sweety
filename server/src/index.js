// Entry point: starts the HTTP server and shuts it down cleanly.
import config from './config.js';
import app from './app.js';
import pool from './db/pool.js';
import { closeCache } from './cache/redis.js';

const server = app.listen(config.port, () => {
  console.log(`Sweety API listening on http://localhost:${config.port}`);
});

async function shutdown() {
  server.close();
  await Promise.all([pool.end(), closeCache()]);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
