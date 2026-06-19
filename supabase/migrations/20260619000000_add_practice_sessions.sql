CREATE TABLE IF NOT EXISTS practice_sessions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  words      jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions"
  ON practice_sessions FOR ALL USING (auth.uid() = user_id);
