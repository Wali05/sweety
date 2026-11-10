-- Blood glucose readings in mg/dl: at most one per user, date and slot.
CREATE TABLE readings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reading_date date NOT NULL,
  slot         text NOT NULL,
  value        integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT readings_slot_check
    CHECK (slot IN ('morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner')),
  CONSTRAINT readings_value_check
    CHECK (value BETWEEN 40 AND 600),
  CONSTRAINT readings_user_date_slot_key
    UNIQUE (user_id, reading_date, slot)
);

-- Reports and daily lists look up a user's readings by date range.
CREATE INDEX readings_user_date_idx ON readings (user_id, reading_date);
