# Sweety

Sweety is a blood glucose tracker. A patient records up to 4 blood glucose readings per day and views daily, month-to-date, and previous-month reports.

The project is in early development: this repository currently contains the monorepo scaffold, the API server with sign-up and login, the database schema, and a React client shell that is not connected to the API yet; features will land incrementally.

## Stack

- **Server:** Node.js + Express
- **Database:** PostgreSQL
- **Client:** React

The repository is an npm workspaces monorepo with two packages, `server/` and `client/`. All code is JavaScript (ES modules).

## Install

Requires Node.js 18 or newer.

```sh
npm install
```

Run this at the repository root; it installs dependencies for both workspaces.

## Database setup

1. Install PostgreSQL and make sure it is running locally.
2. Copy the example environment file and adjust the values as needed:

   ```sh
   cp .env.example .env
   ```

3. Create a database and user matching `DATABASE_URL` in `.env`. With the default values:

   ```sh
   psql -U postgres -c "CREATE USER sweety WITH PASSWORD 'sweety';"
   psql -U postgres -c "CREATE DATABASE sweety OWNER sweety;"
   ```

4. Create the tables by applying the SQL migrations:

   ```sh
   npm run db:migrate
   ```

   This runs the numbered `.sql` files in `server/migrations/` in order and records each one in a `schema_migrations` table, so it is safe to run again; only new migrations are applied. PostgreSQL 13 or newer is required (the schema uses the built-in `gen_random_uuid()`).

### Environment variables

| Variable        | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `PORT`          | Port the API server listens on                     |
| `DATABASE_URL`  | PostgreSQL connection string                       |
| `JWT_SECRET`    | Secret used to sign auth tokens                    |
| `JWT_EXPIRES_IN` | Optional. How long a login token lasts (default 7d) |
| `CLIENT_ORIGIN` | Origin of the React client, allowed through CORS   |
| `APP_TIMEZONE`  | Optional. Time zone that decides what "today" is for readings (default Asia/Kolkata) |

## Running

Start the API server (it restarts when a file changes):

```sh
npm run dev:server
```

The server reads `.env` from the repository root and listens on `PORT` (default 3000). To check that it is up and can reach PostgreSQL:

```sh
curl http://localhost:3000/health
# {"ok":true,"db":"up"}
```

So far the API has this health check, the database schema, and the auth and readings endpoints below; reports are not implemented yet.

### Auth endpoints

All bodies and responses are JSON. Errors look like `{ "error": "message" }`.

| Method and path     | Body                        | Success                   | Errors                                         |
| ------------------- | --------------------------- | ------------------------- | ---------------------------------------------- |
| `POST /auth/signup` | `{ name, email, password }` | `201` `{ user, token }`   | `400` invalid input, `409` email already used  |
| `POST /auth/login`  | `{ email, password }`       | `200` `{ user, token }`   | `401` `Invalid email or password.`             |
| `GET /auth/me`      | none                        | `200` `{ user }`          | `401` missing, invalid or expired token        |

- `user` is `{ id, name, email }`. The password and its hash are never returned.
- Sign-up trims the name and email, stores the email lowercased, and requires a password of 8 to 72 characters. Passwords are hashed with bcrypt.
- `token` is a JWT signed with `JWT_SECRET`, valid for 7 days (override with `JWT_EXPIRES_IN`, e.g. `12h`). Send it as `Authorization: Bearer <token>` to `GET /auth/me`.

### Readings endpoints

All of these need `Authorization: Bearer <token>` (otherwise `401`) and only work on the logged-in user's own readings.

| Method and path        | Body                           | Success              | Errors                                                      |
| ---------------------- | ------------------------------ | -------------------- | ----------------------------------------------------------- |
| `POST /readings`       | `{ date, slot, value }`        | `201` `{ reading }`  | `400` invalid input, `409` day is full or slot already used |
| `GET /readings`        | none                           | `200` `{ readings }` | `400` `Date is not valid.`                                  |
| `GET /readings/:id`    | none                           | `200` `{ reading }`  | `404` `Reading not found.`                                  |
| `PATCH /readings/:id`  | any of `{ date, slot, value }` | `200` `{ reading }`  | `400` invalid input, `404`, `409` as for `POST`             |
| `DELETE /readings/:id` | none                           | `204` no body        | `404` `Reading not found.`                                  |

- `reading` is `{ id, date, slot, slotLabel, value, createdAt, updatedAt }`. `date` is always a plain `YYYY-MM-DD` string and `value` is a whole number of mg/dl.
- `GET /readings` returns all of the user's readings, newest date first and in slot order within a day. Filter with `?date=YYYY-MM-DD` for one day, or `?from=` and/or `?to=` for an inclusive range (`date` wins if both are given). A date that does not exist, or `from` after `to`, gives `400` `Date is not valid.`
- A reading that belongs to another user, an unknown id and a malformed id all give `404` `Reading not found.`, so ids are never revealed.

Slots:

| `slot`            | `slotLabel`       |
| ----------------- | ----------------- |
| `morning_fasting` | Morning (fasting) |
| `after_breakfast` | After breakfast   |
| `after_lunch`     | After lunch       |
| `after_dinner`    | After dinner      |

Validation rules, checked in this order; the first failure is returned as the error message:

| Rule                                         | Status | Message                                   |
| -------------------------------------------- | ------ | ----------------------------------------- |
| `date` is missing                            | `400`  | `Please choose a date.`                   |
| `date` is not a real `YYYY-MM-DD` date       | `400`  | `Date is not valid.`                      |
| `date` is after today                        | `400`  | `Date cannot be in the future.`           |
| `slot` is missing                            | `400`  | `Please choose a time slot.`              |
| `slot` is not one of the four keys           | `400`  | `Time slot is not valid.`                 |
| `value` is missing                           | `400`  | `Please enter a glucose value.`           |
| `value` is not a whole number from 40 to 600 | `400`  | `Value must be between 40 and 600 mg/dl.` |
| `PATCH` body has none of the three fields    | `400`  | `Nothing to update.`                      |
| The date already has 4 readings              | `409`  | `You can add only 4 readings per day.`    |
| The date already has a reading in that slot  | `409`  | `You already have an After lunch reading for this date.` (with that slot's label) |

- "Today" is decided in the `APP_TIMEZONE` time zone (default Asia/Kolkata), not the time zone of the server machine or the client.
- `PATCH` validates only the fields that are sent. The two `409` checks run when the date or slot changes and ignore the reading being edited.

### Client

Start the React client (a Vite dev server with hot reload):

```sh
npm run dev:client
```

It serves on http://localhost:5173, which is the default `CLIENT_ORIGIN`. If that port is taken, the command fails rather than picking another one.

The client is only a shell for now: a home page (`/`) and placeholder login (`/login`) and sign-up (`/signup`) pages. The forms are not hooked up to the API yet, so submitting them does nothing.

The dev server proxies `/auth`, `/readings` and `/health` to the API at http://localhost:3000, so later client code can call the API with same-origin paths. The proxy target is set in `client/vite.config.js`; change it there if you run the API on a different `PORT`.

## Tests

The API tests use Node's built-in test runner (`node:test`) with supertest, which calls the Express app directly without opening a port.

They run against the real database from `DATABASE_URL`, so it must be set up and migrated first (see [Database setup](#database-setup)). Each test signs up its own users with unique `@example.test` emails and removes them, along with their readings, when the run finishes; no other data is touched.

```sh
npm test
```

Run this at the repository root (it runs the test script of each workspace) or inside `server/`.
