-- Weekly quiz attempts delivered in FordMS. Additive and idempotent.
CREATE TABLE IF NOT EXISTS ehr_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL REFERENCES ehr_course_users (email) ON DELETE CASCADE,
  week INT NOT NULL CHECK (week BETWEEN 1 AND 12),
  attempt INT NOT NULL CHECK (attempt >= 1),
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_count INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 6,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  late BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, week, attempt)
);
CREATE INDEX IF NOT EXISTS idx_ehr_quiz_attempts_email ON ehr_quiz_attempts (email, week);
ALTER TABLE ehr_quiz_attempts ENABLE ROW LEVEL SECURITY;
