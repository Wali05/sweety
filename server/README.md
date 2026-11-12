# @sweety/server

The Sweety API: Node.js + Express backed by PostgreSQL.

- `src/index.js` starts the HTTP server.
- `src/app.js` builds the Express app (CORS, JSON parsing, routes).
- `src/config.js` loads the repository root `.env`.
- `src/db/pool.js` is the shared PostgreSQL pool.
- `src/db/migrate.js` applies the SQL files in `migrations/` in order.
- `src/cache/` is the optional Redis cache for report results.

Routes: `GET /health`, `/auth` (sign-up, login, me), `/readings` and `/reports`. See the root README for setup and the full API.
