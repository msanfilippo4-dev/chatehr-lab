import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getSessionContext } from "@/lib/server-context";
import { hydrateBenchmarkRunExecutionMetadata } from "@/lib/benchmark-run-compat";
import { isMissingSupabaseColumnError } from "@/lib/supabase-compat";
import {
  reconcileStaleBenchmarkRuns,
  shouldReconcileStaleBenchmarkRuns,
} from "@/lib/benchmark/run-lifecycle";

async function loadTeamBenchmarkRuns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  teamId: string
) {
  let result = await supabase
    .from("benchmark_runs")
    .select("*, configurations(*)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (
    result.error &&
    (isMissingSupabaseColumnError(
      result.error,
      "benchmark_runs",
      "execution_error_count"
    ) ||
      isMissingSupabaseColumnError(
        result.error,
        "benchmark_runs",
        "failure_reason"
      ) ||
      isMissingSupabaseColumnError(
        result.error,
        "benchmark_runs",
        "cases_completed"
      ) ||
      isMissingSupabaseColumnError(
        result.error,
        "benchmark_runs",
        "cases_total"
      ) ||
      isMissingSupabaseColumnError(
        result.error,
        "benchmark_runs",
        "last_progress_at"
      ))
  ) {
    result = await supabase
      .from("benchmark_runs")
      .select(
        "id, team_id, config_id, run_mode, pack_id, status, accuracy_score, safety_score, bias_equity_score, tournament_score, latency_p95_ms, total_cost_usd, total_tokens, evaluation_cost_usd, evaluation_tokens, execution_error_count, failure_reason, completed_at, created_at, configurations(*)"
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);
  }

  return result;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load benchmark runs.");
  }

  if (!ctx.team) {
    return NextResponse.json([]);
  }

  let result = await loadTeamBenchmarkRuns(supabase, ctx.team.teamId);

  if (result.error) {
    return routeErrorResponse(result.error, "Failed to load benchmark runs.");
  }

  let runs = await hydrateBenchmarkRunExecutionMetadata(
    supabase,
    (result.data ?? []) as Array<Record<string, unknown> & { id: string }>
  );

  if (
    shouldReconcileStaleBenchmarkRuns(
      runs.map((run) => ({
        status: typeof run.status === "string" ? run.status : null,
        last_progress_at:
          typeof run.last_progress_at === "string" ? run.last_progress_at : null,
        started_at:
          typeof run.started_at === "string" ? run.started_at : null,
        created_at:
          typeof run.created_at === "string" ? run.created_at : null,
      }))
    )
  ) {
    try {
      await reconcileStaleBenchmarkRuns(supabase);
    } catch (error) {
      return routeErrorResponse(
        error,
        "Failed to reconcile stale benchmark runs."
      );
    }

    result = await loadTeamBenchmarkRuns(supabase, ctx.team.teamId);
    if (result.error) {
      return routeErrorResponse(result.error, "Failed to load benchmark runs.");
    }

    runs = await hydrateBenchmarkRunExecutionMetadata(
      supabase,
      (result.data ?? []) as Array<Record<string, unknown> & { id: string }>
    );
  }

  return NextResponse.json(
    runs.map((run) => {
      const config = Array.isArray(run.configurations)
        ? run.configurations[0]
        : run.configurations;

      return {
        id: run.id,
        configId: run.config_id,
        runMode: run.run_mode,
        packId: run.pack_id,
        status: run.status,
        accuracyScore:
          run.accuracy_score != null ? parseFloat(String(run.accuracy_score)) : null,
        safetyScore:
          run.safety_score != null ? parseFloat(String(run.safety_score)) : null,
        biasEquityScore:
          run.bias_equity_score != null
            ? parseFloat(String(run.bias_equity_score))
            : null,
        tournamentScore:
          run.tournament_score != null
            ? parseFloat(String(run.tournament_score))
            : null,
        latencyP95Ms: run.latency_p95_ms,
        totalCostUsd:
          run.total_cost_usd != null ? parseFloat(String(run.total_cost_usd)) : null,
        totalTokens: run.total_tokens,
        evaluationCostUsd:
          run.evaluation_cost_usd != null
            ? parseFloat(String(run.evaluation_cost_usd))
            : null,
        evaluationTokens: run.evaluation_tokens,
        executionErrorCount: run.execution_error_count ?? 0,
        failureReason: run.failure_reason ?? null,
        casesCompleted: run.cases_completed ?? 0,
        casesTotal:
          typeof run.cases_total === "number" ? run.cases_total : null,
        lastProgressAt: run.last_progress_at ?? null,
        completedAt: run.completed_at,
        createdAt: run.created_at,
        configName: config?.name ?? "Saved Config",
        modelName: config?.model_name ?? "Unknown",
        presetId: config?.preset_id ?? null,
      };
    })
  );
}
