// Creates (or resets) a demo user with sample readings for the previous month
// and the current month up to today. Safe to run again: only the demo user's
// readings are replaced, all in one transaction.
// Usage: npm run db:seed
import bcrypt from 'bcrypt';
import pool from './pool.js';
import { generateSampleReadings } from './sampleReadings.js';
import { todayInAppTimezone } from '../validation/readings.js';
import { previousMonthRange } from '../reports/ranges.js';
import { BCRYPT_COST } from '../routes/auth.js';

const DEMO_USER = {
  name: 'Demo Patient',
  email: 'demo@sweety.local',
  password: 'demo1234',
};

async function seed() {
  const today = todayInAppTimezone();
  const readings = generateSampleReadings(today);
  const passwordHash = await bcrypt.hash(DEMO_USER.password, BCRYPT_COST);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const user = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [DEMO_USER.name, DEMO_USER.email, passwordHash]
    );
    const userId = user.rows[0].id;

    await client.query('DELETE FROM readings WHERE user_id = $1', [userId]);

    // One insert for all rows, passing the columns as parallel arrays.
    await client.query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       SELECT $1, d, s, v
       FROM unnest($2::date[], $3::text[], $4::int[]) AS t(d, s, v)`,
      [
        userId,
        readings.map((r) => r.date),
        readings.map((r) => r.slot),
        readings.map((r) => r.value),
      ]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const { from } = previousMonthRange(today);
  console.log('Demo data ready.');
  console.log(`  Email:    ${DEMO_USER.email}`);
  console.log(`  Password: ${DEMO_USER.password}`);
  console.log(`  Readings: ${readings.length} (${from} to ${today})`);
}

try {
  await seed();
} catch (err) {
  console.error(`Seeding failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
