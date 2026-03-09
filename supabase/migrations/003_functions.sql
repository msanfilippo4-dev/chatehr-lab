-- ============================================================================
-- 003_functions.sql
-- Database functions for ChartEHR Project
-- ============================================================================

-- ── get_leaderboard() ───────────────────────────────────────────────────────
-- Returns the best official completed run per team, ordered by tournament_score.
-- Includes team name, run details, config model name, and run count per team.

CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  team_name        TEXT,
  team_id          UUID,
  run_id           UUID,
  accuracy_score   NUMERIC(5,2),
  safety_score     NUMERIC(5,2),
  tournament_score NUMERIC(5,2),
  latency_p50_ms   INT,
  latency_p95_ms   INT,
  total_cost_usd   NUMERIC(8,6),
  model_name       TEXT,
  config_hash      TEXT,
  run_count        BIGINT,
  completed_at     TIMESTAMPTZ
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
    t.name           AS team_name,
    rr.team_id,
    rr.run_id,
    rr.accuracy_score,
    rr.safety_score,
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


-- ── can_run_benchmark(p_team_id UUID) ───────────────────────────────────────
-- Returns TRUE if the team has no pending or running benchmark runs in the
-- last 5 minutes (rate-limit / cooldown check).

CREATE OR REPLACE FUNCTION can_run_benchmark(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM benchmark_runs
    WHERE team_id = p_team_id
      AND status IN ('pending', 'running')
      AND created_at > now() - INTERVAL '5 minutes'
  );
$$;
