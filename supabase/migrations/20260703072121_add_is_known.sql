ALTER TABLE user_words
  ADD COLUMN IF NOT EXISTS is_known boolean NOT NULL DEFAULT false;
