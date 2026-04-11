-- ============================================================================
-- 007_judge_population_and_grading.sql
-- Gemini judge metadata, teaching presets, cohort runs, and instructor grading
-- ============================================================================

ALTER TABLE configurations
  ADD COLUMN IF NOT EXISTS preset_id TEXT;

ALTER TABLE configurations
  DROP CONSTRAINT IF EXISTS configurations_preset_id_check;

ALTER TABLE configurations
  ADD CONSTRAINT configurations_preset_id_check
  CHECK (
    preset_id IS NULL OR preset_id IN (
      'small-cheap',
      'large-synthesis',
      'high-variance-creative',
      'rag-heavy',
      'safety-first'
    )
  );

CREATE INDEX IF NOT EXISTS idx_configurations_preset_id
  ON configurations(preset_id);

ALTER TABLE benchmark_runs
  ADD COLUMN IF NOT EXISTS evaluation_cost_usd NUMERIC(8,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evaluation_tokens INT NOT NULL DEFAULT 0;

ALTER TABLE team_observability_snapshots
  DROP CONSTRAINT IF EXISTS team_observability_snapshots_source_type_check;

ALTER TABLE team_observability_snapshots
  ADD CONSTRAINT team_observability_snapshots_source_type_check
  CHECK (source_type IN ('chat', 'experiment', 'benchmark', 'population'));

CREATE TABLE IF NOT EXISTS population_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cohort_id    TEXT NOT NULL,
  cohort_name  TEXT NOT NULL,
  task_id      TEXT NOT NULL,
  task_title   TEXT NOT NULL,
  prompt       TEXT NOT NULL,
  slots        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_population_runs_team_id
  ON population_runs(team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_population_runs_cohort_id
  ON population_runs(cohort_id);

CREATE TABLE IF NOT EXISTS instructor_grades (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id               UUID NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  graded_by             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experimental_design   INT NOT NULL DEFAULT 0 CHECK (experimental_design BETWEEN 0 AND 25),
  benchmark_evidence    INT NOT NULL DEFAULT 0 CHECK (benchmark_evidence BETWEEN 0 AND 20),
  cost_observability    INT NOT NULL DEFAULT 0 CHECK (cost_observability BETWEEN 0 AND 15),
  safety_reasoning      INT NOT NULL DEFAULT 0 CHECK (safety_reasoning BETWEEN 0 AND 15),
  bias_equity           INT NOT NULL DEFAULT 0 CHECK (bias_equity BETWEEN 0 AND 15),
  final_recommendation  INT NOT NULL DEFAULT 0 CHECK (final_recommendation BETWEEN 0 AND 10),
  overall_comments      TEXT NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instructor_grades_updated_at
  ON instructor_grades(updated_at DESC);

ALTER TABLE population_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS population_runs_select_own ON population_runs;
CREATE POLICY population_runs_select_own ON population_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM team_members
      WHERE team_members.team_id = population_runs.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS population_runs_insert_own ON population_runs;
CREATE POLICY population_runs_insert_own ON population_runs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM team_members
      WHERE team_members.team_id = population_runs.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS population_runs_select_instructor ON population_runs;
CREATE POLICY population_runs_select_instructor ON population_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );

DROP POLICY IF EXISTS instructor_grades_select_instructor ON instructor_grades;
CREATE POLICY instructor_grades_select_instructor ON instructor_grades
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );

DROP POLICY IF EXISTS instructor_grades_insert_instructor ON instructor_grades;
CREATE POLICY instructor_grades_insert_instructor ON instructor_grades
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );

DROP POLICY IF EXISTS instructor_grades_update_instructor ON instructor_grades;
CREATE POLICY instructor_grades_update_instructor ON instructor_grades
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin')
    )
  );
