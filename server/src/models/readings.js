// All SQL for the readings table lives here. Every query filters by user_id
// so a user can only ever see or change their own readings.
import pool from '../db/pool.js';
import { SLOTS, slotLabel } from '../validation/readings.js';

const SLOT_KEYS = SLOTS.map((slot) => slot.key);

// The date is formatted in SQL so it stays a plain 'YYYY-MM-DD' string and is
// never turned into a JS Date (which would shift it between time zones).
const COLUMNS = `id, to_char(reading_date, 'YYYY-MM-DD') AS date, slot, value, created_at, updated_at`;

// Request field name -> column name, for the fields an edit may change.
const EDITABLE_COLUMNS = { date: 'reading_date', slot: 'slot', value: 'value' };

// Shape of a reading as sent to clients.
function toReading(row) {
  return {
    id: row.id,
    date: row.date,
    slot: row.slot,
    slotLabel: slotLabel(row.slot),
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Lists a user's readings, newest date first and in slot order within a day.
// from and to are optional inclusive 'YYYY-MM-DD' bounds.
export async function listReadings(userId, { from, to } = {}) {
  const result = await pool.query(
    `SELECT ${COLUMNS}
       FROM readings
      WHERE user_id = $1
        AND ($2::date IS NULL OR reading_date >= $2::date)
        AND ($3::date IS NULL OR reading_date <= $3::date)
      ORDER BY reading_date DESC, array_position($4::text[], slot)`,
    [userId, from ?? null, to ?? null, SLOT_KEYS]
  );
  return result.rows.map(toReading);
}

export async function findReading(userId, id) {
  const result = await pool.query(
    `SELECT ${COLUMNS} FROM readings WHERE user_id = $1 AND id = $2`,
    [userId, id]
  );
  return result.rows[0] ? toReading(result.rows[0]) : null;
}

// Number of readings the user has on a date. Pass excludeId to leave one
// reading out (the one being edited).
export async function countReadingsOnDate(userId, date, excludeId = null) {
  const result = await pool.query(
    `SELECT count(*)::int AS count
       FROM readings
      WHERE user_id = $1
        AND reading_date = $2::date
        AND ($3::uuid IS NULL OR id <> $3::uuid)`,
    [userId, date, excludeId]
  );
  return result.rows[0].count;
}

// The user's reading for a date and slot, or null. excludeId as above.
export async function findReadingBySlot(userId, date, slot, excludeId = null) {
  const result = await pool.query(
    `SELECT ${COLUMNS}
       FROM readings
      WHERE user_id = $1
        AND reading_date = $2::date
        AND slot = $3
        AND ($4::uuid IS NULL OR id <> $4::uuid)`,
    [userId, date, slot, excludeId]
  );
  return result.rows[0] ? toReading(result.rows[0]) : null;
}

// Inserts a reading. Throws the pg error with code 23505 if the user already
// has a reading for that date and slot (unique constraint).
export async function createReading(userId, { date, slot, value }) {
  const result = await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, value)
     VALUES ($1, $2::date, $3, $4)
     RETURNING ${COLUMNS}`,
    [userId, date, slot, value]
  );
  return toReading(result.rows[0]);
}

// Updates whichever of date, slot and value are present in fields and returns
// the updated reading, or null if the user has no reading with that id.
export async function updateReading(userId, id, fields) {
  const assignments = ['updated_at = now()'];
  const params = [userId, id];

  for (const [field, column] of Object.entries(EDITABLE_COLUMNS)) {
    if (fields[field] === undefined) continue;
    params.push(fields[field]);
    assignments.push(`${column} = $${params.length}`);
  }

  const result = await pool.query(
    `UPDATE readings
        SET ${assignments.join(', ')}
      WHERE user_id = $1 AND id = $2
      RETURNING ${COLUMNS}`,
    params
  );
  return result.rows[0] ? toReading(result.rows[0]) : null;
}

// Returns true if a reading was deleted, false if there was none to delete.
export async function deleteReading(userId, id) {
  const result = await pool.query(
    'DELETE FROM readings WHERE user_id = $1 AND id = $2',
    [userId, id]
  );
  return result.rowCount > 0;
}
