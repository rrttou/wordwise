ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_date date,
  ADD COLUMN IF NOT EXISTS streak integer NOT NULL DEFAULT 0;
