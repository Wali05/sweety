-- Users who can sign in. The app stores email lowercased.
-- gen_random_uuid() is built in from PostgreSQL 13.
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
