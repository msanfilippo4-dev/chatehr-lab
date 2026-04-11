-- Async benchmark jobs, progress tracking, and stale-run reconciliation

ALTER TABLE benchmark_runs
  ADD COLUMN IF NOT EXISTS cases_completed INT NOT NULL DEFAULT 0;

ALTER TABLE benchmark_runs
  ADD COLUMN IF NOT EXISTS cases_total INT NOT NULL DEFAULT 0;

ALTER TABLE benchmark_runs
  ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ;

UPDATE benchmark_runs
SET last_progress_at = COALESCE(completed_at, started_at, created_at)
WHERE last_progress_at IS NULL;

WITH run_result_counts AS (
  SELECT run_id, COUNT(*)::INT AS result_count
  FROM benchmark_case_results
  GROUP BY run_id
)
UPDATE benchmark_runs br
SET cases_completed = rrc.result_count
FROM run_result_counts rrc
WHERE br.id = rrc.run_id;

WITH pack_case_counts AS (
  SELECT pack_id, COUNT(*)::INT AS case_count
  FROM benchmark_cases
  GROUP BY pack_id
)
UPDATE benchmark_runs br
SET cases_total = pcc.case_count
FROM pack_case_counts pcc
WHERE br.pack_id = pcc.pack_id;

DELETE FROM benchmark_case_results
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY run_id, case_id
        ORDER BY created_at DESC, id DESC
      ) AS row_num
    FROM benchmark_case_results
  ) ranked
  WHERE row_num > 1
);

ALTER TABLE benchmark_case_results
  DROP CONSTRAINT IF EXISTS uq_benchmark_case_results_run_case;

ALTER TABLE benchmark_case_results
  ADD CONSTRAINT uq_benchmark_case_results_run_case
  UNIQUE (run_id, case_id);

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
      AND COALESCE(last_progress_at, started_at, created_at) >
        now() - INTERVAL '15 minutes'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM benchmark_runs
    WHERE team_id = p_team_id
      AND status IN ('completed', 'failed')
      AND COALESCE(completed_at, last_progress_at, created_at) >
        now() - INTERVAL '1 minute'
  );
$$;

CREATE OR REPLACE FUNCTION reconcile_stale_benchmark_runs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE benchmark_runs
  SET
    status = 'failed',
    completed_at = COALESCE(completed_at, now()),
    failure_reason = COALESCE(failure_reason, 'job_interrupted'),
    last_progress_at = now()
  WHERE status IN ('pending', 'running')
    AND COALESCE(last_progress_at, started_at, created_at) <
      now() - INTERVAL '15 minutes';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
