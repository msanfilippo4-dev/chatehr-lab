ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS is_smoke_test BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE benchmark_runs
  ADD COLUMN IF NOT EXISTS execution_error_count INT NOT NULL DEFAULT 0;

ALTER TABLE benchmark_runs
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

UPDATE benchmark_runs
SET execution_error_count = 0
WHERE execution_error_count IS NULL;

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
    JOIN teams t ON t.id = br.team_id
    WHERE br.run_mode = 'official'
      AND br.status = 'completed'
      AND COALESCE(br.execution_error_count, 0) = 0
      AND COALESCE(t.is_smoke_test, FALSE) = FALSE
  ),
  team_run_counts AS (
    SELECT
      br.team_id,
      COUNT(*) AS run_count
    FROM benchmark_runs br
    JOIN teams t ON t.id = br.team_id
    WHERE br.run_mode = 'official'
      AND br.status = 'completed'
      AND COALESCE(br.execution_error_count, 0) = 0
      AND COALESCE(t.is_smoke_test, FALSE) = FALSE
    GROUP BY br.team_id
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
