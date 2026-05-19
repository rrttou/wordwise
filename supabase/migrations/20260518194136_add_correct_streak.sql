ALTER TABLE user_words
  ADD COLUMN IF NOT EXISTS correct_streak integer NOT NULL DEFAULT 0;
