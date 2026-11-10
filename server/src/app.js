// Builds the Express app. Kept separate from index.js so tests can import
// the app without opening a network port.
import express from 'express';
import cors from 'cors';
import config from './config.js';
import pool from './db/pool.js';
import authRoutes from './routes/auth.js';

const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

// Liveness check that also pings the database.
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (err) {
    console.error('Health check could not reach the database:', err.message);
    res.status(503).json({ ok: false, db: 'down' });
  }
});

app.use('/auth', authRoutes);

// Unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler (four arguments so Express treats it as one).
app.use((err, req, res, next) => {
  // Malformed JSON bodies and similar client errors carry a 4xx status.
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Invalid request' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

export default app;
