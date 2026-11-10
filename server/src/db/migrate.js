// Applies pending SQL migrations from server/migrations in filename order.
// Each applied file is recorded in schema_migrations so it runs only once.
// Usage: npm run db:migrate
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../migrations');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = await client.query('SELECT filename FROM schema_migrations');
    const done = new Set(applied.rows.map((row) => row.filename));

    const files = (await fs.readdir(migrationsDir))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const filename of files) {
      if (done.has(filename)) continue;

      const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8');

      // Run the file and record it in one transaction, so a failing
      // migration leaves nothing half-applied.
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${filename} failed: ${err.message}`);
      }

      console.log(`Applied ${filename}`);
      count += 1;
    }

    console.log(count === 0 ? 'Database is already up to date.' : `Done. Applied ${count} migration(s).`);
  } finally {
    client.release();
  }
}

try {
  await migrate();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
