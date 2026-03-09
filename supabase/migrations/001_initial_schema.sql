-- ============================================================================
-- 001_initial_schema.sql
-- Full database schema for ChartEHR Project
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  image      TEXT,
  role       TEXT NOT NULL DEFAULT 'student'
               CHECK (role IN ('student', 'instructor', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Teams ───────────────────────────────────────────────────────────────────

CREATE TABLE teams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,
  join_code        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
  created_by       UUID NOT NULL REFERENCES users(id),
  active_config_id UUID,                          -- FK added after configurations table
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Team Members ────────────────────────────────────────────────────────────

CREATE TABLE team_members (
  team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('lead', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- ── Configurations ──────────────────────────────────────────────────────────

CREATE TABLE configurations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL DEFAULT 'Untitled Config',

  -- Provider / Model (knobs 1-6)
  model_provider         TEXT NOT NULL DEFAULT 'gemini'
                           CHECK (model_provider IN ('gemini', 'openai')),
  model_name             TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  fallback_model         TEXT NOT NULL DEFAULT '',
  max_output_tokens      INT  NOT NULL DEFAULT 1024
                           CHECK (max_output_tokens BETWEEN 1 AND 65536),
  request_timeout_ms     INT  NOT NULL DEFAULT 30000
                           CHECK (request_timeout_ms BETWEEN 1000 AND 120000),
  retries                INT  NOT NULL DEFAULT 1
                           CHECK (retries BETWEEN 0 AND 5),

  -- Sampling (knobs 7-11)
  temperature            NUMERIC(3,2) NOT NULL DEFAULT 0.30
                           CHECK (temperature BETWEEN 0.0 AND 2.0),
  top_p                  NUMERIC(3,2) NOT NULL DEFAULT 0.95
                           CHECK (top_p BETWEEN 0.0 AND 1.0),
  top_k                  INT NOT NULL DEFAULT 40
                           CHECK (top_k BETWEEN 1 AND 100),
  frequency_penalty      NUMERIC(3,2) NOT NULL DEFAULT 0.00
                           CHECK (frequency_penalty BETWEEN -2.0 AND 2.0),
  presence_penalty       NUMERIC(3,2) NOT NULL DEFAULT 0.00
                           CHECK (presence_penalty BETWEEN -2.0 AND 2.0),

  -- Prompt Engineering (knobs 12-18)
  system_instruction     TEXT NOT NULL DEFAULT 'You are a clinical decision-support assistant.',
  style_profile          TEXT NOT NULL DEFAULT 'clinical'
                           CHECK (style_profile IN ('clinical', 'conversational', 'terse')),
  response_format        TEXT NOT NULL DEFAULT 'free-form'
                           CHECK (response_format IN ('free-form', 'structured', 'chain-of-thought')),
  few_shot_count         INT NOT NULL DEFAULT 0
                           CHECK (few_shot_count BETWEEN 0 AND 10),
  safety_preamble_enabled BOOLEAN NOT NULL DEFAULT true,
  citation_required      BOOLEAN NOT NULL DEFAULT false,
  abstain_rule           TEXT NOT NULL DEFAULT 'If you cannot answer with confidence, state that clearly.',

  -- Context / RAG (knobs 19-26)
  context_level          TEXT NOT NULL DEFAULT 'STANDARD'
                           CHECK (context_level IN ('LIMITED', 'STANDARD', 'FULL')),
  note_window            INT NOT NULL DEFAULT 5
                           CHECK (note_window BETWEEN 0 AND 50),
  section_toggles        JSONB NOT NULL DEFAULT '{"demographics":true,"conditions":true,"medications":true,"allergies":true,"labs":true,"vitals":true,"immunizations":true,"visits":true,"imaging":false,"socialHistory":false,"clinicalNotes":false}',
  summary_prepass        BOOLEAN NOT NULL DEFAULT false,
  rag_enabled            BOOLEAN NOT NULL DEFAULT false,
  rag_top_k              INT NOT NULL DEFAULT 3
                           CHECK (rag_top_k BETWEEN 1 AND 20),
  rag_method             TEXT NOT NULL DEFAULT 'keyword'
                           CHECK (rag_method IN ('keyword', 'embedding', 'hybrid')),
  rag_reranker           BOOLEAN NOT NULL DEFAULT false,

  -- Memory (knobs 27-28)
  history_depth          INT NOT NULL DEFAULT 10
                           CHECK (history_depth BETWEEN 0 AND 100),
  memory_strategy        TEXT NOT NULL DEFAULT 'sliding-window'
                           CHECK (memory_strategy IN ('none', 'sliding-window', 'summary')),

  -- Guardrails (knobs 29-30)
  confidence_floor       NUMERIC(3,2) NOT NULL DEFAULT 0.00
                           CHECK (confidence_floor BETWEEN 0.0 AND 1.0),
  per_turn_token_budget  INT NOT NULL DEFAULT 2048
                           CHECK (per_turn_token_budget BETWEEN 64 AND 65536),

  -- Budget (knob 31)
  per_run_budget_cap     NUMERIC(6,2) NOT NULL DEFAULT 1.00
                           CHECK (per_run_budget_cap BETWEEN 0.01 AND 100.00),

  -- Versioning (knobs 32-34)
  version                INT NOT NULL DEFAULT 1,
  config_hash            TEXT,
  is_frozen              BOOLEAN NOT NULL DEFAULT false,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             UUID NOT NULL REFERENCES users(id)
);

-- Now add the FK from teams.active_config_id -> configurations.id
ALTER TABLE teams
  ADD CONSTRAINT fk_teams_active_config
  FOREIGN KEY (active_config_id) REFERENCES configurations(id)
  ON DELETE SET NULL;

-- ── Patients ────────────────────────────────────────────────────────────────

CREATE TABLE patients (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  dob             DATE NOT NULL,
  age             INT NOT NULL,
  gender          TEXT NOT NULL,
  race            TEXT,
  ethnicity       TEXT,
  language        TEXT DEFAULT 'English',
  marital_status  TEXT,
  address_zip     TEXT,
  insurance_type  TEXT,
  is_complex      BOOLEAN NOT NULL DEFAULT false,
  last_visit      DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Conditions ──────────────────────────────────────────────────────────────

CREATE TABLE conditions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  display    TEXT NOT NULL,
  onset      DATE,
  status     TEXT DEFAULT 'active'
);

-- ── Lab Results ─────────────────────────────────────────────────────────────

CREATE TABLE lab_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  value           NUMERIC NOT NULL,
  unit            TEXT NOT NULL,
  flag            TEXT,
  reference_range TEXT,
  date            DATE NOT NULL
);

-- ── Medications ─────────────────────────────────────────────────────────────

CREATE TABLE medications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  dose       TEXT,
  frequency  TEXT,
  route      TEXT,
  status     TEXT DEFAULT 'Active',
  started    DATE,
  ended      DATE
);

-- ── Allergies ───────────────────────────────────────────────────────────────

CREATE TABLE allergies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  allergen   TEXT NOT NULL,
  reaction   TEXT,
  severity   TEXT
);

-- ── Immunizations ───────────────────────────────────────────────────────────

CREATE TABLE immunizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  cvx        TEXT,
  date       DATE NOT NULL
);

-- ── Encounters ──────────────────────────────────────────────────────────────

CREATE TABLE encounters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  type             TEXT NOT NULL,
  provider         TEXT,
  chief_complaint  TEXT,
  assessment       TEXT,
  plan             TEXT,
  vitals           JSONB,
  orders           JSONB DEFAULT '[]'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Imaging Reports ─────────────────────────────────────────────────────────

CREATE TABLE imaging_reports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  finding    TEXT,
  impression TEXT,
  date       DATE NOT NULL
);

-- ── Social History ──────────────────────────────────────────────────────────

CREATE TABLE social_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  housing_status    TEXT,
  employment_status TEXT,
  food_security     TEXT,
  education_level   TEXT,
  tobacco_use       TEXT,
  alcohol_use       TEXT,
  recorded_date     DATE
);

-- ── Clinical Notes ──────────────────────────────────────────────────────────

CREATE TABLE clinical_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id UUID REFERENCES encounters(id) ON DELETE SET NULL,
  note_type    TEXT NOT NULL,
  content      TEXT NOT NULL,
  author       TEXT,
  date         DATE NOT NULL
);

-- ── Guideline Chunks (RAG) ──────────────────────────────────────────────────
-- NOTE: requires pgvector extension. Enable it in Supabase Dashboard:
--   Database > Extensions > vector

CREATE TABLE guideline_chunks (
  id        TEXT PRIMARY KEY,
  source    TEXT NOT NULL,
  title     TEXT NOT NULL,
  text      TEXT NOT NULL,
  keywords  TEXT[] DEFAULT '{}',
  embedding VECTOR(768)           -- pgvector; NULL until embeddings are computed
);

-- ── Retrieval Logs ──────────────────────────────────────────────────────────

CREATE TABLE retrieval_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  query           TEXT NOT NULL,
  method          TEXT NOT NULL,
  chunks_returned TEXT[] DEFAULT '{}',
  scores          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Benchmark Cases ─────────────────────────────────────────────────────────

CREATE TABLE benchmark_cases (
  id             TEXT PRIMARY KEY,
  category       TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  patient_id     TEXT REFERENCES patients(id) ON DELETE SET NULL,
  prompt         TEXT NOT NULL,
  ground_truth   JSONB NOT NULL,
  scoring_method TEXT NOT NULL,
  max_score      INT NOT NULL DEFAULT 10,
  difficulty     TEXT NOT NULL DEFAULT 'medium',
  case_set       TEXT NOT NULL DEFAULT 'public'
                   CHECK (case_set IN ('public', 'hidden', 'adversarial')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Benchmark Runs ──────────────────────────────────────────────────────────

CREATE TABLE benchmark_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  config_id           UUID NOT NULL REFERENCES configurations(id),
  config_hash         TEXT,
  run_mode            TEXT NOT NULL DEFAULT 'dev'
                        CHECK (run_mode IN ('dev', 'official')),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  accuracy_score      NUMERIC(5,2),
  safety_score        NUMERIC(5,2),
  tournament_score    NUMERIC(5,2),
  latency_p50_ms      INT,
  latency_p95_ms      INT,
  total_cost_usd      NUMERIC(8,6),
  total_tokens        INT,
  hallucination_count INT DEFAULT 0,
  consistency_score   NUMERIC(5,2),
  langfuse_session_id TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Benchmark Case Results ──────────────────────────────────────────────────

CREATE TABLE benchmark_case_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
  case_id           TEXT NOT NULL REFERENCES benchmark_cases(id),
  model_response    TEXT,
  model_name        TEXT,
  latency_ms        INT,
  input_tokens      INT,
  output_tokens     INT,
  cost_usd          NUMERIC(8,6),
  deterministic_score NUMERIC(5,2),
  rubric_score      NUMERIC(5,2),
  judge_score       NUMERIC(5,2),
  final_score       NUMERIC(5,2),
  max_score         INT,
  scoring_details   JSONB,
  is_hallucination  BOOLEAN DEFAULT false,
  is_flagged        BOOLEAN DEFAULT false,
  langfuse_trace_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Chat Messages ───────────────────────────────────────────────────────────

CREATE TABLE chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id),
  patient_id       TEXT REFERENCES patients(id) ON DELETE SET NULL,
  config_id        UUID REFERENCES configurations(id) ON DELETE SET NULL,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  model_name       TEXT,
  input_tokens     INT,
  output_tokens    INT,
  latency_ms       INT,
  cost_usd         NUMERIC(8,6),
  langfuse_trace_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Audit Events ────────────────────────────────────────────────────────────

CREATE TABLE audit_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID REFERENCES teams(id) ON DELETE SET NULL,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  details    JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users
CREATE INDEX idx_users_email ON users(email);

-- Teams
CREATE INDEX idx_teams_join_code ON teams(join_code);
CREATE INDEX idx_teams_created_by ON teams(created_by);

-- Team Members
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- Configurations
CREATE INDEX idx_configurations_team_id ON configurations(team_id);
CREATE INDEX idx_configurations_config_hash ON configurations(config_hash);
CREATE INDEX idx_configurations_team_version ON configurations(team_id, version DESC);

-- Patient sub-tables
CREATE INDEX idx_conditions_patient_id ON conditions(patient_id);
CREATE INDEX idx_lab_results_patient_id ON lab_results(patient_id);
CREATE INDEX idx_lab_results_date ON lab_results(patient_id, date DESC);
CREATE INDEX idx_medications_patient_id ON medications(patient_id);
CREATE INDEX idx_allergies_patient_id ON allergies(patient_id);
CREATE INDEX idx_immunizations_patient_id ON immunizations(patient_id);
CREATE INDEX idx_encounters_patient_id ON encounters(patient_id);
CREATE INDEX idx_encounters_date ON encounters(patient_id, date DESC);
CREATE INDEX idx_imaging_reports_patient_id ON imaging_reports(patient_id);
CREATE INDEX idx_social_history_patient_id ON social_history(patient_id);
CREATE INDEX idx_clinical_notes_patient_id ON clinical_notes(patient_id);
CREATE INDEX idx_clinical_notes_encounter_id ON clinical_notes(encounter_id);

-- Guideline Chunks
CREATE INDEX idx_guideline_chunks_source ON guideline_chunks(source);
CREATE INDEX idx_guideline_chunks_keywords ON guideline_chunks USING GIN(keywords);

-- Retrieval Logs
CREATE INDEX idx_retrieval_logs_team_id ON retrieval_logs(team_id);
CREATE INDEX idx_retrieval_logs_created_at ON retrieval_logs(created_at DESC);

-- Benchmark Cases
CREATE INDEX idx_benchmark_cases_category ON benchmark_cases(category);
CREATE INDEX idx_benchmark_cases_case_set ON benchmark_cases(case_set);
CREATE INDEX idx_benchmark_cases_patient_id ON benchmark_cases(patient_id);

-- Benchmark Runs
CREATE INDEX idx_benchmark_runs_team_id ON benchmark_runs(team_id);
CREATE INDEX idx_benchmark_runs_config_id ON benchmark_runs(config_id);
CREATE INDEX idx_benchmark_runs_status ON benchmark_runs(status);
CREATE INDEX idx_benchmark_runs_team_status ON benchmark_runs(team_id, status);
CREATE INDEX idx_benchmark_runs_leaderboard ON benchmark_runs(run_mode, status, tournament_score DESC NULLS LAST);

-- Benchmark Case Results
CREATE INDEX idx_benchmark_case_results_run_id ON benchmark_case_results(run_id);
CREATE INDEX idx_benchmark_case_results_case_id ON benchmark_case_results(case_id);

-- Chat Messages
CREATE INDEX idx_chat_messages_team_id ON chat_messages(team_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_patient_id ON chat_messages(patient_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(team_id, created_at DESC);

-- Audit Events
CREATE INDEX idx_audit_events_team_id ON audit_events(team_id);
CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC);
