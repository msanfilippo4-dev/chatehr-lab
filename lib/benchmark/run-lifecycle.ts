import type { SupabaseClient } from "@supabase/supabase-js";

export const BENCHMARK_STALE_THRESHOLD_MINUTES = 15;
export const BENCHMARK_POLL_INTERVAL_MS = 5_000;
export const BENCHMARK_STALE_THRESHOLD_MS =
  BENCHMARK_STALE_THRESHOLD_MINUTES * 60 * 1000;

type BenchmarkLifecycleLike = {
  status?: string | null;
  last_progress_at?: string | null;
  started_at?: string | null;
  created_at?: string | null;
};

export function isActiveBenchmarkRunStatus(status: string | null | undefined) {
  return status === "pending" || status === "running";
}

export function getBenchmarkRunProgressTimestamp(
  run: BenchmarkLifecycleLike
) {
  return run.last_progress_at ?? run.started_at ?? run.created_at ?? null;
}

export function isStaleBenchmarkRun(run: BenchmarkLifecycleLike) {
  if (!isActiveBenchmarkRunStatus(run.status)) {
    return false;
  }

  const progressTimestamp = getBenchmarkRunProgressTimestamp(run);
  if (!progressTimestamp) {
    return false;
  }

  const progressTime = new Date(progressTimestamp).getTime();
  if (Number.isNaN(progressTime)) {
    return false;
  }

  return Date.now() - progressTime > BENCHMARK_STALE_THRESHOLD_MS;
}

export function shouldReconcileStaleBenchmarkRuns(
  runs: BenchmarkLifecycleLike[]
) {
  return runs.some((run) => isStaleBenchmarkRun(run));
}

export async function reconcileStaleBenchmarkRuns(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("reconcile_stale_benchmark_runs");

  if (error) {
    throw error;
  }
}
