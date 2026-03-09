-- ============================================================================
-- 006_course_product_rls_and_functions.sql
-- RLS for course-product tables and updated leaderboard function
-- ============================================================================

ALTER TABLE course_settings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_runs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_entries              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_status              ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_observability_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_flags              ENABLE ROW LEVEL SECURITY;

-- ── Course settings ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS course_settings_select_all ON course_settings;
CREATE POLICY course_settings_select_all ON course_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS course_settings_update_instructor ON course_settings;
CREATE POLICY course_settings_update_instructor ON course_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );

-- ── Team-scoped tables ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS experiment_runs_select_own ON experiment_runs;
CREATE POLICY experiment_runs_select_own ON experiment_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = experiment_runs.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS experiment_runs_insert_own ON experiment_runs;
CREATE POLICY experiment_runs_insert_own ON experiment_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = experiment_runs.team_id
        AND team_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS notebook_entries_select_own ON notebook_entries;
CREATE POLICY notebook_entries_select_own ON notebook_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = notebook_entries.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS notebook_entries_insert_own ON notebook_entries;
CREATE POLICY notebook_entries_insert_own ON notebook_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = notebook_entries.team_id
        AND team_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS reflection_submissions_select_own ON reflection_submissions;
CREATE POLICY reflection_submissions_select_own ON reflection_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = reflection_submissions.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS reflection_submissions_insert_own ON reflection_submissions;
CREATE POLICY reflection_submissions_insert_own ON reflection_submissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = reflection_submissions.team_id
        AND team_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS reflection_submissions_update_own ON reflection_submissions;
CREATE POLICY reflection_submissions_update_own ON reflection_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = reflection_submissions.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS milestone_status_select_own ON milestone_status;
CREATE POLICY milestone_status_select_own ON milestone_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = milestone_status.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS milestone_status_insert_own ON milestone_status;
CREATE POLICY milestone_status_insert_own ON milestone_status
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = milestone_status.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS milestone_status_update_own ON milestone_status;
CREATE POLICY milestone_status_update_own ON milestone_status
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = milestone_status.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS team_observability_snapshots_select_own ON team_observability_snapshots;
CREATE POLICY team_observability_snapshots_select_own ON team_observability_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_observability_snapshots.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS team_observability_snapshots_insert_own ON team_observability_snapshots;
CREATE POLICY team_observability_snapshots_insert_own ON team_observability_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_observability_snapshots.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS instructor_flags_select_instructor ON instructor_flags;
CREATE POLICY instructor_flags_select_instructor ON instructor_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );

DROP POLICY IF EXISTS instructor_flags_insert_instructor ON instructor_flags;
CREATE POLICY instructor_flags_insert_instructor ON instructor_flags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );

-- ── Instructor read access across course artifacts ────────────────────────

DROP POLICY IF EXISTS notebook_entries_select_instructor ON notebook_entries;
CREATE POLICY notebook_entries_select_instructor ON notebook_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );

DROP POLICY IF EXISTS reflection_submissions_select_instructor ON reflection_submissions;
CREATE POLICY reflection_submissions_select_instructor ON reflection_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );

DROP POLICY IF EXISTS milestone_status_select_instructor ON milestone_status;
CREATE POLICY milestone_status_select_instructor ON milestone_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );

DROP POLICY IF EXISTS experiment_runs_select_instructor ON experiment_runs;
CREATE POLICY experiment_runs_select_instructor ON experiment_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );

DROP POLICY IF EXISTS team_observability_snapshots_select_instructor ON team_observability_snapshots;
CREATE POLICY team_observability_snapshots_select_instructor ON team_observability_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );

-- ── Updated leaderboard function ──────────────────────────────────────────

DROP FUNCTION IF EXISTS get_leaderboard();
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  team_name          TEXT,
  team_id            UUID,
  run_id             UUID,
  accuracy_score     NUMERIC(5,2),
  safety_score       NUMERIC(5,2),
  bias_equity_score  NUMERIC(5,2),
  tournament_score   NUMERIC(5,2),
  latency_p50_ms     INT,
  latency_p95_ms     INT,
  total_cost_usd     NUMERIC(8,6),
  model_name         TEXT,
  config_hash        TEXT,
  run_count          BIGINT,
  completed_at       TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH ranked_runs AS (
    SELECT
      br.team_id,
      br.id AS run_id,
      br.accuracy_score,
      br.safety_score,
      br.bias_equity_score,
      br.tournament_score,
      br.latency_p50_ms,
      br.latency_p95_ms,
      br.total_cost_usd,
      br.config_hash,
      br.completed_at,
      c.model_name,
      ROW_NUMBER() OVER (
        PARTITION BY br.team_id
        ORDER BY br.tournament_score DESC NULLS LAST
      ) AS rn
    FROM benchmark_runs br
    JOIN configurations c ON c.id = br.config_id
    WHERE br.run_mode = 'official'
      AND br.status = 'completed'
  ),
  team_run_counts AS (
    SELECT
      team_id,
      COUNT(*) AS run_count
    FROM benchmark_runs
    WHERE run_mode = 'official'
      AND status = 'completed'
    GROUP BY team_id
  )
  SELECT
    t.name AS team_name,
    rr.team_id,
    rr.run_id,
    rr.accuracy_score,
    rr.safety_score,
    rr.bias_equity_score,
    rr.tournament_score,
    rr.latency_p50_ms,
    rr.latency_p95_ms,
    rr.total_cost_usd,
    rr.model_name,
    rr.config_hash,
    COALESCE(trc.run_count, 0) AS run_count,
    rr.completed_at
  FROM ranked_runs rr
  JOIN teams t ON t.id = rr.team_id
  LEFT JOIN team_run_counts trc ON trc.team_id = rr.team_id
  WHERE rr.rn = 1
  ORDER BY rr.tournament_score DESC NULLS LAST;
$$;
