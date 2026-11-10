// All SQL for the users table lives here so route handlers stay readable.
import pool from '../db/pool.js';

// Inserts a user and returns the public fields. Throws the pg error with
// code 23505 if the email is already taken (unique constraint).
export async function createUser({ name, email, passwordHash }) {
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email`,
    [name, email, passwordHash]
  );
  return result.rows[0];
}

// Includes password_hash: only for checking a login, never send it to clients.
export async function findUserByEmailWithHash(email) {
  const result = await pool.query(
    'SELECT id, name, email, password_hash FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await pool.query(
    'SELECT id, name, email FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}
