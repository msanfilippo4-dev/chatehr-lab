import type { SupabaseClient } from "@supabase/supabase-js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

type BenchmarkRunWithCompatFields = {
  id: string;
  execution_error_count?: number | null;
  failure_reason?: string | null;
};

type BenchmarkCaseResultCompatRow = {
  run_id: string;
  scoring_details: unknown;
};

function extractExecutionError(row: BenchmarkCaseResultCompatRow) {
  const scoringDetails = asRecord(row.scoring_details);
  const error = asRecord(scoringDetails?.error);

  if (!error) {
    return null;
  }

  const reason =
    typeof error.code === "string"
      ? error.code
      : typeof error.message === "string"
        ? error.message
        : "case_execution_failure";

  return { reason };
}

export async function hydrateBenchmarkRunExecutionMetadata<
  T extends BenchmarkRunWithCompatFields,
>(supabase: SupabaseClient, runs: T[]) {
  const runIds = Array.from(
    new Set(
      runs
        .map((run) => run.id)
        .filter((runId): runId is string => typeof runId === "string" && runId.length > 0)
    )
  );

  if (runIds.length === 0) {
    return runs.map((run) => ({
      ...run,
      execution_error_count:
        typeof run.execution_error_count === "number"
          ? run.execution_error_count
          : 0,
      failure_reason:
        typeof run.failure_reason === "string" ? run.failure_reason : null,
    }));
  }

  const { data, error } = await supabase
    .from("benchmark_case_results")
    .select("run_id, scoring_details")
    .in("run_id", runIds);

  if (error) {
    throw error;
  }

  const derivedMetadata = new Map<
    string,
    { execution_error_count: number; failure_reason: string | null }
  >();

  for (const row of (data ?? []) as BenchmarkCaseResultCompatRow[]) {
    const executionError = extractExecutionError(row);
    if (!executionError) {
      continue;
    }

    const current = derivedMetadata.get(row.run_id) ?? {
      execution_error_count: 0,
      failure_reason: null,
    };

    current.execution_error_count += 1;
    current.failure_reason ??= executionError.reason;
    derivedMetadata.set(row.run_id, current);
  }

  return runs.map((run) => {
    const derived = derivedMetadata.get(run.id);
    return {
      ...run,
      execution_error_count:
        typeof run.execution_error_count === "number"
          ? run.execution_error_count
          : derived?.execution_error_count ?? 0,
      failure_reason:
        typeof run.failure_reason === "string"
          ? run.failure_reason
          : derived?.failure_reason ?? null,
    };
  });
}
