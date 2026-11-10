// One shared PostgreSQL connection pool for the whole server.
import pg from 'pg';
import config from '../config.js';

const pool = new pg.Pool({ connectionString: config.databaseUrl });

// An idle client can error if the database restarts. Log it instead of
// letting the unhandled 'error' event crash the process.
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

export default pool;
