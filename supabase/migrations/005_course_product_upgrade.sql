-- ============================================================================
-- 005_course_product_upgrade.sql
-- Course-product persistence, OpenRouter migration, and benchmark pack fields
-- ============================================================================

-- ── Provider migration ─────────────────────────────────────────────────────

UPDATE configurations
SET model_provider = 'openrouter'
WHERE model_provider = 'openai';

ALTER TABLE configurations
  DROP CONSTRAINT IF EXISTS configurations_model_provider_check;

ALTER TABLE configurations
  ADD CONSTRAINT configurations_model_provider_check
  CHECK (model_provider IN ('gemini', 'openrouter'));

-- ── Benchmark case metadata ────────────────────────────────────────────────

ALTER TABLE benchmark_cases
  ADD COLUMN IF NOT EXISTS recommended_patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pack_id TEXT NOT NULL DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'practice',
  ADD COLUMN IF NOT EXISTS learning_objective TEXT,
  ADD COLUMN IF NOT EXISTS evidence_checklist TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fairness_dimension TEXT,
  ADD COLUMN IF NOT EXISTS recommended_comparison TEXT;

ALTER TABLE benchmark_cases
  DROP CONSTRAINT IF EXISTS benchmark_cases_pack_id_check;

ALTER TABLE benchmark_cases
  ADD CONSTRAINT benchmark_cases_pack_id_check
  CHECK (pack_id IN ('practice', 'checkpoint', 'final'));

ALTER TABLE benchmark_cases
  DROP CONSTRAINT IF EXISTS benchmark_cases_phase_check;

ALTER TABLE benchmark_cases
  ADD CONSTRAINT benchmark_cases_phase_check
  CHECK (phase IN ('practice', 'checkpoint', 'final'));

CREATE INDEX IF NOT EXISTS idx_benchmark_cases_pack_id
  ON benchmark_cases(pack_id);

CREATE INDEX IF NOT EXISTS idx_benchmark_cases_phase
  ON benchmark_cases(phase);

CREATE INDEX IF NOT EXISTS idx_benchmark_cases_fairness_dimension
  ON benchmark_cases(fairness_dimension);

-- ── Benchmark run metadata ────────────────────────────────────────────────

UPDATE benchmark_runs
SET run_mode = CASE
  WHEN run_mode = 'official' THEN 'official'
  ELSE 'practice'
END
WHERE run_mode IN ('dev', 'official');

ALTER TABLE benchmark_runs
  ADD COLUMN IF NOT EXISTS pack_id TEXT,
  ADD COLUMN IF NOT EXISTS bias_equity_score NUMERIC(5,2);

UPDATE benchmark_runs
SET pack_id = CASE
  WHEN run_mode = 'official' THEN 'final'
  ELSE 'practice'
END
WHERE pack_id IS NULL;

ALTER TABLE benchmark_runs
  DROP CONSTRAINT IF EXISTS benchmark_runs_run_mode_check;

ALTER TABLE benchmark_runs
  ADD CONSTRAINT benchmark_runs_run_mode_check
  CHECK (run_mode IN ('practice', 'checkpoint', 'official'));

ALTER TABLE benchmark_runs
  DROP CONSTRAINT IF EXISTS benchmark_runs_pack_id_check;

ALTER TABLE benchmark_runs
  ADD CONSTRAINT benchmark_runs_pack_id_check
  CHECK (pack_id IN ('practice', 'checkpoint', 'final'));

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_pack_id
  ON benchmark_runs(pack_id);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_bias_equity
  ON benchmark_runs(bias_equity_score DESC NULLS LAST);

-- ── Course settings ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_settings (
  id                         TEXT PRIMARY KEY,
  official_benchmark_locked  BOOLEAN NOT NULL DEFAULT false,
  checkpoint_benchmark_locked BOOLEAN NOT NULL DEFAULT false,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO course_settings (id, official_benchmark_locked, checkpoint_benchmark_locked)
VALUES ('hinf6117', false, false)
ON CONFLICT (id) DO NOTHING;

-- ── Experiments ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS experiment_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name   TEXT NOT NULL,
  prompt         TEXT NOT NULL,
  recipe_id      TEXT,
  variable_focus TEXT,
  slots          JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiment_runs_team_id
  ON experiment_runs(team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_experiment_runs_patient_id
  ON experiment_runs(patient_id);

-- ── Notebook ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notebook_entries (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id              UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category             TEXT NOT NULL
                         CHECK (category IN ('hypothesis', 'observation', 'governance', 'bias_equity', 'cost', 'reflection')),
  title                TEXT NOT NULL,
  content              TEXT NOT NULL,
  linked_experiment_id UUID REFERENCES experiment_runs(id) ON DELETE SET NULL,
  tags                 TEXT[] NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notebook_entries_team_id
  ON notebook_entries(team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notebook_entries_category
  ON notebook_entries(category);

-- ── Reflection submissions ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reflection_submissions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                   UUID NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  best_config_id            UUID REFERENCES configurations(id) ON DELETE SET NULL,
  title                     TEXT NOT NULL,
  summary                   TEXT NOT NULL,
  benchmark_evidence        TEXT NOT NULL,
  cost_observability        TEXT NOT NULL,
  bias_equity_risk          TEXT NOT NULL,
  safety_control            TEXT NOT NULL,
  deployment_recommendation TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reflection_submissions_updated_at
  ON reflection_submissions(updated_at DESC);

-- ── Milestones ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS milestone_status (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  milestone_key TEXT NOT NULL
                  CHECK (milestone_key IN (
                    'orientation',
                    'controlled_experiments',
                    'practice_benchmark',
                    'checkpoint_benchmark',
                    'final_benchmark',
                    'final_reflection'
                  )),
  completed     BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS idx_milestone_status_team_id
  ON milestone_status(team_id, milestone_key);

-- ── Observability snapshots ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_observability_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  source_type        TEXT NOT NULL
                       CHECK (source_type IN ('chat', 'experiment', 'benchmark')),
  source_id          TEXT NOT NULL,
  model_name         TEXT NOT NULL,
  provider           TEXT NOT NULL
                       CHECK (provider IN ('gemini', 'openrouter')),
  input_tokens       INT NOT NULL DEFAULT 0,
  output_tokens      INT NOT NULL DEFAULT 0,
  total_tokens       INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(8,6) NOT NULL DEFAULT 0,
  latency_ms         INT NOT NULL DEFAULT 0,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_observability_team_id
  ON team_observability_snapshots(team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_observability_source
  ON team_observability_snapshots(source_type, source_id);

-- ── Instructor flags ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS instructor_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  run_id      UUID REFERENCES benchmark_runs(id) ON DELETE CASCADE,
  case_id     TEXT REFERENCES benchmark_cases(id) ON DELETE SET NULL,
  flag_type   TEXT NOT NULL
                CHECK (flag_type IN ('safety', 'bias_equity', 'hallucination', 'cost')),
  severity    TEXT NOT NULL
                CHECK (severity IN ('low', 'medium', 'high')),
  summary     TEXT NOT NULL,
  details     TEXT,
  resolved    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instructor_flags_team_id
  ON instructor_flags(team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_instructor_flags_run_id
  ON instructor_flags(run_id);
