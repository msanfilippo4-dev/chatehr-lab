-- ============================================================================
-- 002_rls_policies.sql
-- Row Level Security policies for all ChartEHR tables
-- ============================================================================

-- ── Enable RLS on all tables ────────────────────────────────────────────────

ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE configurations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results           ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE immunizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters            ENABLE ROW LEVEL SECURITY;
ALTER TABLE imaging_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE guideline_chunks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE retrieval_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_cases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_case_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events          ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- USERS
-- ============================================================================

-- Users can read their own profile
CREATE POLICY users_select_own ON users
  FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ============================================================================
-- TEAMS
-- ============================================================================

-- All authenticated users can read teams (for leaderboard and join-team page)
CREATE POLICY teams_select_all ON teams
  FOR SELECT TO authenticated
  USING (true);

-- Only team members can update their team
CREATE POLICY teams_update_members ON teams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
        AND team_members.user_id = auth.uid()
    )
  );

-- Authenticated users can create teams
CREATE POLICY teams_insert_authenticated ON teams
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());


-- ============================================================================
-- TEAM MEMBERS
-- ============================================================================

-- Team members can read their team's membership
CREATE POLICY team_members_select ON team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members AS tm
      WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
    )
  );

-- Authenticated users can join teams (insert themselves)
CREATE POLICY team_members_insert ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Team members can delete their own membership (leave team)
CREATE POLICY team_members_delete ON team_members
  FOR DELETE USING (user_id = auth.uid());


-- ============================================================================
-- CONFIGURATIONS
-- ============================================================================

-- Team members can read their team's configs
CREATE POLICY configurations_select ON configurations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = configurations.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Team members can create configs for their team
CREATE POLICY configurations_insert ON configurations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = configurations.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Team members can update their team's configs
CREATE POLICY configurations_update ON configurations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = configurations.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Team members can delete their team's configs
CREATE POLICY configurations_delete ON configurations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = configurations.team_id
        AND team_members.user_id = auth.uid()
    )
  );


-- ============================================================================
-- PATIENTS + ALL SUB-TABLES (public read for all authenticated users)
-- ============================================================================

CREATE POLICY patients_select_all ON patients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY conditions_select_all ON conditions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY lab_results_select_all ON lab_results
  FOR SELECT TO authenticated USING (true);

CREATE POLICY medications_select_all ON medications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY allergies_select_all ON allergies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY immunizations_select_all ON immunizations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY encounters_select_all ON encounters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY imaging_reports_select_all ON imaging_reports
  FOR SELECT TO authenticated USING (true);

CREATE POLICY social_history_select_all ON social_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY clinical_notes_select_all ON clinical_notes
  FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- GUIDELINE CHUNKS (public read)
-- ============================================================================

CREATE POLICY guideline_chunks_select_all ON guideline_chunks
  FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- BENCHMARK CASES
-- All authenticated users can read benchmark cases.
-- Hidden/adversarial prompt filtering is done at the API layer, not RLS,
-- so all rows are readable here.
-- ============================================================================

CREATE POLICY benchmark_cases_select_all ON benchmark_cases
  FOR SELECT TO authenticated USING (true);


-- ============================================================================
-- BENCHMARK RUNS
-- ============================================================================

-- Teams can read their own runs (any status)
CREATE POLICY benchmark_runs_select_own ON benchmark_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = benchmark_runs.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- All authenticated users can read completed official runs (for leaderboard)
CREATE POLICY benchmark_runs_select_official ON benchmark_runs
  FOR SELECT TO authenticated
  USING (run_mode = 'official' AND status = 'completed');

-- Team members can insert runs for their team
CREATE POLICY benchmark_runs_insert ON benchmark_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = benchmark_runs.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Team members can update their own runs (for status transitions)
CREATE POLICY benchmark_runs_update ON benchmark_runs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = benchmark_runs.team_id
        AND team_members.user_id = auth.uid()
    )
  );


-- ============================================================================
-- BENCHMARK CASE RESULTS (team read own only)
-- ============================================================================

CREATE POLICY benchmark_case_results_select_own ON benchmark_case_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM benchmark_runs
      JOIN team_members ON team_members.team_id = benchmark_runs.team_id
      WHERE benchmark_runs.id = benchmark_case_results.run_id
        AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY benchmark_case_results_insert ON benchmark_case_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM benchmark_runs
      JOIN team_members ON team_members.team_id = benchmark_runs.team_id
      WHERE benchmark_runs.id = benchmark_case_results.run_id
        AND team_members.user_id = auth.uid()
    )
  );


-- ============================================================================
-- CHAT MESSAGES (team read/insert own only)
-- ============================================================================

CREATE POLICY chat_messages_select_own ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = chat_messages.team_id
        AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY chat_messages_insert_own ON chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = chat_messages.team_id
        AND team_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );


-- ============================================================================
-- RETRIEVAL LOGS (team read own only)
-- ============================================================================

CREATE POLICY retrieval_logs_select_own ON retrieval_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = retrieval_logs.team_id
        AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY retrieval_logs_insert_own ON retrieval_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = retrieval_logs.team_id
        AND team_members.user_id = auth.uid()
    )
  );


-- ============================================================================
-- AUDIT EVENTS
-- ============================================================================

-- Team members can read their own team's audit events
CREATE POLICY audit_events_select_own ON audit_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = audit_events.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Instructors can read all audit events
CREATE POLICY audit_events_select_instructor ON audit_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'instructor'
    )
  );

-- Authenticated users can insert audit events
CREATE POLICY audit_events_insert ON audit_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
