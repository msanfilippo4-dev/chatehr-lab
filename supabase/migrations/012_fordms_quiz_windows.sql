-- Quiz windows, timers, random draws, per-week settings, and per-student extensions.
-- Additive and idempotent: safe to run more than once. Existing attempt rows keep
-- their answers and scores; they default to status 'submitted' with no draw
-- (the app reads a null drawn_item_ids as "the week's fixed items in bank order").
-- Requires migration 011 (ehr_quiz_attempts).

-- ---------------------------------------------------------------- attempts
ALTER TABLE ehr_quiz_attempts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted';
ALTER TABLE ehr_quiz_attempts ADD COLUMN IF NOT EXISTS drawn_item_ids TEXT[];
ALTER TABLE ehr_quiz_attempts ADD COLUMN IF NOT EXISTS option_orders JSONB;
ALTER TABLE ehr_quiz_attempts ADD COLUMN IF NOT EXISTS saved_answers JSONB;
ALTER TABLE ehr_quiz_attempts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ehr_quiz_attempts_status_check' AND conrelid = 'ehr_quiz_attempts'::regclass
  ) THEN
    ALTER TABLE ehr_quiz_attempts ADD CONSTRAINT ehr_quiz_attempts_status_check
      CHECK (status IN ('in_progress', 'submitted', 'auto_submitted'));
  END IF;
END $$;

-- In-progress attempts have no submission time yet. The default stays so
-- one-step (legacy) inserts that omit submitted_at still record now().
ALTER TABLE ehr_quiz_attempts ALTER COLUMN submitted_at DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ehr_quiz_attempts_submitted_check' AND conrelid = 'ehr_quiz_attempts'::regclass
  ) THEN
    ALTER TABLE ehr_quiz_attempts ADD CONSTRAINT ehr_quiz_attempts_submitted_check
      CHECK (status = 'in_progress' OR submitted_at IS NOT NULL);
  END IF;
END $$;

-- At most one open attempt per student per week (guards double-clicked "Start").
CREATE UNIQUE INDEX IF NOT EXISTS idx_ehr_quiz_attempts_one_open
  ON ehr_quiz_attempts (email, week) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS idx_ehr_quiz_attempts_open_expiry
  ON ehr_quiz_attempts (expires_at) WHERE status = 'in_progress';

-- ---------------------------------------------------------------- per-week settings
-- Null columns mean "use the quiz bank default".
CREATE TABLE IF NOT EXISTS ehr_quiz_settings (
  week INT PRIMARY KEY CHECK (week BETWEEN 1 AND 12),
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  time_limit_min INT CHECK (time_limit_min IS NULL OR time_limit_min BETWEEN 0 AND 600),   -- 0 = untimed
  draw_count INT CHECK (draw_count IS NULL OR draw_count BETWEEN 1 AND 100),
  attempts_allowed INT CHECK (attempts_allowed IS NULL OR attempts_allowed BETWEEN 0 AND 100), -- 0 = unlimited
  show_answers TEXT CHECK (show_answers IS NULL OR show_answers IN ('after_close', 'after_submit')),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (opens_at IS NULL OR closes_at IS NULL OR opens_at < closes_at)
);
ALTER TABLE ehr_quiz_settings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- per-student extensions
CREATE TABLE IF NOT EXISTS ehr_quiz_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL REFERENCES ehr_course_users (email) ON DELETE CASCADE,
  week INT NOT NULL CHECK (week BETWEEN 1 AND 12),
  extra_minutes INT NOT NULL DEFAULT 0 CHECK (extra_minutes BETWEEN 0 AND 600),
  closes_at_override TIMESTAMPTZ,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email, week)
);
ALTER TABLE ehr_quiz_extensions ENABLE ROW LEVEL SECURITY;

-- RLS is enabled with no policies, like the other ehr_ tables: only the
-- service role (server routes) can read or write these tables.

-- Ask PostgREST to pick up the new columns and tables immediately.
NOTIFY pgrst, 'reload schema';
