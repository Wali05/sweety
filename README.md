# Sweety

Sweety is a blood glucose tracker. A patient records up to 4 blood glucose readings per day and views daily, month-to-date, and previous-month reports.

The project is in active development: this repository currently contains the monorepo scaffold, the API server (sign-up and login, readings, and reports), the database schema, and a React client with sign-up, login, a readings page for viewing, adding, editing and deleting a day's readings, and a reports page with the daily, month-to-date and previous-month summaries and a month-to-date chart.

## Stack

- **Server:** Node.js + Express
- **Database:** PostgreSQL
- **Client:** React

The repository is an npm workspaces monorepo with two packages, `server/` and `client/`. All code is JavaScript (ES modules).

## Install

Requires Node.js 22.22 or newer (the client tooling needs it).

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

| Variable         | Purpose                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ |
| `PORT`           | Port the API server listens on                                                       |
| `DATABASE_URL`   | PostgreSQL connection string                                                         |
| `JWT_SECRET`     | Secret used to sign auth tokens                                                      |
| `JWT_EXPIRES_IN` | Optional. How long a login token lasts (default 7d)                                  |
| `CLIENT_ORIGIN`  | Origin of the React client, allowed through CORS                                     |
| `APP_TIMEZONE`   | Optional. Time zone that decides what "today" is for readings (default Asia/Kolkata) |

### Demo data

To try the app with sample data, after the migrations:

```sh
npm run db:seed
```

This creates a demo user you can log in with:

- **Email:** `demo@sweety.local`
- **Password:** `demo1234`

and gives it readings for every day of the previous month and the current month up to today ("today" in `APP_TIMEZONE`): mostly full days, some days with only 2 or 3 readings and a few with none, with values typical of a type 2 patient plus the occasional high and low. The values are generated from a fixed seed, so they are the same on every run. Running it again keeps the user, resets its password and replaces only its readings; no other users are touched.

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

So far the API has this health check, the database schema, and the auth, readings and reports endpoints below.

### Auth endpoints

All bodies and responses are JSON. Errors look like `{ "error": "message" }`.

| Method and path     | Body                        | Success                 | Errors                                        |
| ------------------- | --------------------------- | ----------------------- | --------------------------------------------- |
| `POST /auth/signup` | `{ name, email, password }` | `201` `{ user, token }` | `400` invalid input, `409` email already used |
| `POST /auth/login`  | `{ email, password }`       | `200` `{ user, token }` | `401` `Invalid email or password.`            |
| `GET /auth/me`      | none                        | `200` `{ user }`        | `401` missing, invalid or expired token       |

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

| Rule                                         | Status | Message                                                                           |
| -------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| `date` is missing                            | `400`  | `Please choose a date.`                                                           |
| `date` is not a real `YYYY-MM-DD` date       | `400`  | `Date is not valid.`                                                              |
| `date` is after today                        | `400`  | `Date cannot be in the future.`                                                   |
| `slot` is missing                            | `400`  | `Please choose a time slot.`                                                      |
| `slot` is not one of the four keys           | `400`  | `Time slot is not valid.`                                                         |
| `value` is missing                           | `400`  | `Please enter a glucose value.`                                                   |
| `value` is not a whole number from 40 to 600 | `400`  | `Value must be between 40 and 600 mg/dl.`                                         |
| `PATCH` body has none of the three fields    | `400`  | `Nothing to update.`                                                              |
| The date already has 4 readings              | `409`  | `You can add only 4 readings per day.`                                            |
| The date already has a reading in that slot  | `409`  | `You already have an After lunch reading for this date.` (with that slot's label) |

- "Today" is decided in the `APP_TIMEZONE` time zone (default Asia/Kolkata), not the time zone of the server machine or the client.
- `PATCH` validates only the fields that are sent. The two `409` checks run when the date or slot changes and ignore the reading being edited.

### Reports endpoints

All of these need `Authorization: Bearer <token>` (otherwise `401`) and only ever read the logged-in user's own readings.

| Method and path               | Report covers                                    | Success                               | Errors                       |
| ----------------------------- | ------------------------------------------------ | ------------------------------------- | ---------------------------- |
| `GET /reports/daily`          | The selected date                                | `200` summary and that day's readings | `400` invalid or future date |
| `GET /reports/month-to-date`  | The 1st of the month up to the selected date     | `200` summary                         | `400` invalid or future date |
| `GET /reports/previous-month` | The whole month before the selected date's month | `200` summary                         | `400` invalid or future date |

Each report takes one optional query parameter:

| Parameter | Value        | Default | Errors                                                                                                       |
| --------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------ |
| `date`    | `YYYY-MM-DD` | Today   | `400` `Date is not valid.` for a date that does not exist, `400` `Date cannot be in the future.` after today |

"Today" is decided in the `APP_TIMEZONE` time zone, as for readings.

Date range per report (both ends inclusive), with the selected date 15 Oct 2026 as the example:

| Report           | From                                 | To                               | `?date=2026-10-15`        |
| ---------------- | ------------------------------------ | -------------------------------- | ------------------------- |
| `daily`          | The selected date                    | The selected date                | 15 Oct 2026 only          |
| `month-to-date`  | The 1st of the selected date's month | The selected date                | 1 Oct 2026 to 15 Oct 2026 |
| `previous-month` | The 1st of the month before          | The last day of the month before | 1 Sep 2026 to 30 Sep 2026 |

The previous month of a January date is December of the year before, and the range always ends on the month's real last day (29 Feb in a leap year).

Every report returns the same summary fields:

- `report`, `date`, `from`, `to`: the report name, the selected date and the range that was used.
- `count`, `highest`, `lowest`, `average`: the number of readings in the range and their highest, lowest and average value in mg/dl. The average is rounded to 1 decimal.
- `empty` and `message`: `empty` is `true` when the range has no readings, and `message` then holds a friendly text to show; otherwise `message` is `null`.

The daily report also has `readings`, the day's readings in slot order, each as `{ id, slot, slotLabel, value }`. The other two reports have no `readings` list.

`GET /reports/daily?date=2026-10-15`:

```json
{
  "report": "daily",
  "date": "2026-10-15",
  "from": "2026-10-15",
  "to": "2026-10-15",
  "count": 4,
  "highest": 180,
  "lowest": 95,
  "average": 141.5,
  "empty": false,
  "message": null,
  "readings": [
    { "id": "5f0c1a52-8f7e-4f1b-9a61-2d3c4b5a6e70", "slot": "morning_fasting", "slotLabel": "Morning (fasting)", "value": 95 },
    { "id": "0b9d7c3e-1a2f-4c5d-8e6f-7a8b9c0d1e2f", "slot": "after_breakfast", "slotLabel": "After breakfast", "value": 140 },
    { "id": "c4e8a1b2-3d4f-4a5b-9c6d-7e8f9a0b1c2d", "slot": "after_lunch", "slotLabel": "After lunch", "value": 151 },
    { "id": "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d", "slot": "after_dinner", "slotLabel": "After dinner", "value": 180 }
  ]
}
```

When the range has no readings the response is still `200`, with a count of 0 and no numbers. The same daily report for a day without readings:

```json
{
  "report": "daily",
  "date": "2026-10-15",
  "from": "2026-10-15",
  "to": "2026-10-15",
  "count": 0,
  "highest": null,
  "lowest": null,
  "average": null,
  "empty": true,
  "message": "No readings for this period yet.",
  "readings": []
}
```

### Client

Start the React client (a Vite dev server with hot reload):

```sh
npm run dev:client
```

It serves on http://localhost:5173, which is the default `CLIENT_ORIGIN`. If that port is taken, the command fails rather than picking another one.

The client has a home page (`/`), sign-up (`/signup`) and login (`/login`) pages that call the auth API, a dashboard (`/dashboard`), a readings page (`/readings`) and a reports page (`/reports`):

- After signing up or logging in, the token is kept in `localStorage` under `sweety.token`, so the session survives a reload. On start-up the client checks a stored token with `GET /auth/me` and removes it if the server answers `401`.
- The dashboard, readings and reports pages are only for logged-in users. Anyone else is sent to the login page and brought back afterwards; logged-in users who open `/login` or `/signup` go straight to the dashboard. The dashboard greets the user and links to the readings and reports pages.
- **Log out** in the header removes the token and returns to the login page.
- Validation messages come from the server and are shown as they are. A few checks (missing fields, an email that is not valid on sign-up, a password shorter than 8 characters) run in the browser first, with the same messages, so they don't need a request.

The readings page is linked from the header and the dashboard:

- Pick a date (today to start with; the picker stops at today) to see that day's readings in slot order with a count such as `3 of 4 readings`, or `No readings for this date yet.`
- **Add a reading**, beside the list on wide screens and below it on phones, takes a date, a time slot and a value in mg/dl. It starts on the page's date and the first free slot, and marks the slots already used on its date as taken. After a save the list is fetched again and the page moves to the saved reading's date. When the form's date already has 4 readings, it shows `You can add only 4 readings per day.` and only the date can be changed.
- **Edit** opens the same form inside the row, one row at a time. Only the changed fields are sent; saving with nothing changed just closes the form. If the date changes, the page moves to the new date.
- **Delete** asks `Delete this reading?` and sends the request only after it is confirmed.
- These checks run in the browser before any request, with the server's messages: `Please choose a date.`, `Date cannot be in the future.`, the slot already used on that date (e.g. `You already have an After lunch reading for this date.`), `Please enter a glucose value.` and `Value must be between 40 and 600 mg/dl.` (whole numbers only).
- The server remains the source of truth and checks everything again. When it refuses a save or delete, its message is shown as it is, for example the `409` for a slot saved from another tab after the list loaded, or `Reading not found.` for a reading already deleted.
- If any readings request gets a `401` (the token has expired or is no longer valid), the client logs out and shows the login page, which leads back to `/readings` after logging in again.

The reports page is linked from the header and the dashboard:

- One date picker (today to start with; it stops at today) drives all three reports: **Daily** for that date with its readings in slot order, **Month to date** from the 1st of its month up to that date, and **Previous month** for the whole month before. Each shows the number of readings and the highest, lowest and average value in mg/dl (the average always with one decimal), or the server's `No readings for this period yet.` when there are none.
- The three reports are fetched together and shown once all of them are back for the selected date. If the date changes while requests are still out, the older answers are ignored, so a slow response never replaces the current one.
- A **month-to-date chart** under the summaries draws one line per time slot across the days of the month so far, from `GET /readings?from=&to=`. Each reading gets a dot and a slot's line joins its readings across days without one, so a missed day is never drawn as zero; the tooltip says `No readings` for such a day. The chart library is loaded only when the reports page opens, and if the chart fails the summaries stay on the page with a short message in its place.
- If a report request gets a `401`, the client logs out and leads back to `/reports` after logging in again.

The pages share one set of styles in `client/src/index.css` (colours, spacing, buttons, form fields, cards, alerts) and three small components in `client/src/ui/` for error, empty and loading states, so every page words and shows these the same way. The layout works from narrow phones up to desktop: the header navigation wraps, the readings list and form stack on small screens, and the report summaries sit in a grid when there is room.

The date picker's maximum and the browser's future-date check use the browser's local date, while the server decides what "today" is in `APP_TIMEZONE` (Asia/Kolkata by default). They agree when the browser is in that time zone. In another time zone they can be a day apart for part of the day: the server may then refuse a date the browser allowed (with `Date cannot be in the future.`), or the picker may not yet offer a date the server would accept.

The dev server proxies `/auth`, `/readings`, `/reports` and `/health` to the API at http://localhost:3000, so the client calls the API with same-origin paths. `/readings` and `/reports` are both API paths and client pages, so for them the proxy checks the `Accept` header: a request that accepts `text/html` (the browser opening or reloading the page) gets the app, and the client's API calls, which send `Accept: application/json`, go to the server. The proxy target is set in `client/vite.config.js`; change it there if you run the API on a different `PORT`.

## Tests

```sh
npm test
```

Run this at the repository root; it runs the test script of each workspace, the server tests first and then the client tests. Both run once and exit (no watch mode).

### Server tests

The server tests use Node's built-in test runner (`node:test`). The API tests add supertest, which calls the Express app directly without opening a port.

| File                               | Covers                                                    |
| ---------------------------------- | --------------------------------------------------------- |
| `server/test/validation.test.js`   | Unit tests for the readings validation rules              |
| `server/test/readings.test.js`     | API tests for the readings endpoints                      |
| `server/test/reports-unit.test.js` | Unit tests for the report date ranges and summary numbers |
| `server/test/reports.test.js`      | API tests for the reports endpoints                       |
| `server/test/seed.test.js`         | Unit tests for the demo data generator                    |

The API tests run against the real database from `DATABASE_URL`, so it must be set up and migrated first (see [Database setup](#database-setup)). Each test signs up its own users with unique `@example.test` emails and removes them, along with their readings, when the run finishes; no other data is touched.

To run only the server tests:

```sh
npm test --workspace server
```

### Client tests

The client tests use Vitest and React Testing Library in a jsdom environment. `fetch` is mocked in every test, so they need neither the API server nor the database. Most of them render the whole app (`<App />` inside a `MemoryRouter` and the `AuthProvider`) and use it the way a person would: typing into the forms and clicking buttons.

| File                                              | Tests | Covers                                                                                                                                                                                                                                                                |
| ------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/src/__tests__/apiClient.test.js`          | 8     | API client: JSON body and Bearer header, server error messages, network failures, the readings calls (by date, by range, create, update, delete) and the report calls                                                                                                 |
| `client/src/__tests__/Login.test.jsx`             | 3     | Login form checks, server errors, storing the token and landing on the dashboard                                                                                                                                                                                      |
| `client/src/__tests__/Signup.test.jsx`            | 2     | Sign-up password length check and the server message for an email already in use                                                                                                                                                                                      |
| `client/src/__tests__/routeGuard.test.jsx`        | 4     | Protected dashboard: logged-out redirect, session restore, rejected token, logout, and the active link in the header                                                                                                                                                  |
| `client/src/__tests__/Readings.test.jsx`          | 5     | Readings page: the day's list in slot order with the count, the empty state, picking another date, a failed load, logout on `401`, links from the header and dashboard                                                                                                |
| `client/src/__tests__/ReadingForm.test.jsx`       | 9     | Add form: browser checks for the value, a future date and a taken slot, the server's message, saving and refreshing the list, saving to another date, the 4 per day limit, logout on `401`                                                                            |
| `client/src/__tests__/ReadingEditDelete.test.jsx` | 12    | Inline edit (only changed fields sent, the same browser checks, the server's message, cancel, saving with nothing changed, one row at a time, moving to a new date) and delete (confirm, cancel, the server's message), logout on `401` for both                      |
| `client/src/__tests__/slots.test.js`              | 4     | Slot keys, labels and order, sorting by slot, a or an in the duplicate slot message, the browser's local date                                                                                                                                                         |
| `client/src/__tests__/Reports.test.jsx`           | 19    | Reports page: the three summaries and the daily readings, empty reports, changing the date, ignoring late answers for an old date, a failed load, logout on `401`, links from the header and dashboard, and the month-to-date chart's loading, empty and error states |
| `client/src/__tests__/formatRange.test.js`        | 4     | Formatting a report's date range from `YYYY-MM-DD` strings                                                                                                                                                                                                            |
| `client/src/__tests__/chartData.test.js`          | 13    | Turning a month's readings into one chart point per day with one value per slot, with empty values for missed days                                                                                                                                                    |
| `client/src/__tests__/MonthChart.test.jsx`        | 8     | The month-to-date chart: accessible name, one line per slot with the legend in slot order, dots and lines, axis labels, the tooltip (including days without readings) and keyboard stepping through the days                                                          |
| `client/src/__tests__/ui.test.jsx`                | 3     | The shared error, empty and loading components and how screen readers are told about them                                                                                                                                                                             |

That is 94 client tests in 13 files.

The test setup and the shared helpers (rendering the app, mocking `fetch`, reading the rows of the readings list) are in `client/src/test/`. To run only the client tests:

```sh
npm test --workspace client
```
