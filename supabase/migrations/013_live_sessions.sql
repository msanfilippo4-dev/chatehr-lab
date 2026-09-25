-- 013: Live lecture sessions and in-class poll responses for slides.fordms.com.
-- Shared course database with FordMS. Additive and idempotent: safe to run more than once.
-- RLS is enabled with no policies, so only the service role (server routes) can read or write.
-- Emails are not foreign keys to ehr_course_users on purpose: automated test accounts and
-- instructors listed only in INSTRUCTOR_EMAILS may not have a roster row.

CREATE TABLE IF NOT EXISTS ehr_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week INT NOT NULL CHECK (week BETWEEN 1 AND 12),
  current_slide INT NOT NULL DEFAULT 1 CHECK (current_slide >= 1),
  open_poll_id TEXT NULL,
  revealed BOOLEAN NOT NULL DEFAULT false,
  started_by TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NULL
);

-- The app treats the most recent session with ended_at IS NULL as the live room.
CREATE INDEX IF NOT EXISTS idx_ehr_live_sessions_active ON ehr_live_sessions (started_at DESC) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_live_sessions_week ON ehr_live_sessions (week, started_at DESC);

CREATE TABLE IF NOT EXISTS ehr_live_poll_responses (
  session_id UUID NOT NULL REFERENCES ehr_live_sessions (id) ON DELETE CASCADE,
  poll_id TEXT NOT NULL,
  email TEXT NOT NULL,
  choice INT[] NOT NULL CHECK (cardinality(choice) BETWEEN 1 AND 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, poll_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ehr_live_poll_responses_poll ON ehr_live_poll_responses (session_id, poll_id);

ALTER TABLE ehr_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ehr_live_poll_responses ENABLE ROW LEVEL SECURITY;

-- No policies: anon and authenticated roles have no access. The service role bypasses RLS.
REVOKE ALL ON ehr_live_sessions FROM anon, authenticated;
REVOKE ALL ON ehr_live_poll_responses FROM anon, authenticated;

-- Make the new tables visible to PostgREST immediately.
NOTIFY pgrst, 'reload schema';
