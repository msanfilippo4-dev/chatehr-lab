// ---------------------------------------------------------------------------
// /api/leaderboard — Fetch leaderboard from get_leaderboard() DB function (GET)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { hydrateBenchmarkRunExecutionMetadata } from "@/lib/benchmark-run-compat";
import { isMissingSupabaseColumnError } from "@/lib/supabase-compat";

type LeaderboardTeamRow = {
  id: string;
  name: string;
  is_smoke_test?: boolean;
};

type LeaderboardRunRow = {
  id: string;
  team_id: string;
  config_hash: string | null;
  status: string;
  accuracy_score: number | string | null;
  safety_score: number | string | null;
  bias_equity_score: number | string | null;
  tournament_score: number | string | null;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  total_cost_usd: number | string | null;
  completed_at: string | null;
  created_at: string;
  execution_error_count?: number | null;
  failure_reason?: string | null;
  configurations?: { model_name?: string | null } | Array<{ model_name?: string | null }> | null;
};

async function loadVisibleTeams(supabase: ReturnType<typeof createAdminClient>) {
  let result = await supabase
    .from("teams")
    .select("id, name, is_smoke_test")
    .order("name", { ascending: true });

  if (result.error && isMissingSupabaseColumnError(result.error, "teams", "is_smoke_test")) {
    result = await supabase
      .from("teams")
      .select("id, name")
      .order("name", { ascending: true }) as typeof result;

    return {
      data: ((result.data ?? []) as Array<{ id: string; name: string }>).map((team) => ({
        ...team,
        is_smoke_test: false,
      })),
      error: result.error,
    };
  }

  return {
    data: (result.data ?? []) as LeaderboardTeamRow[],
    error: result.error,
  };
}

async function loadOfficialRuns(
  supabase: ReturnType<typeof createAdminClient>,
  teamIds: string[]
) {
  let result = await supabase
    .from("benchmark_runs")
    .select(
      "id, team_id, config_id, config_hash, run_mode, status, accuracy_score, safety_score, bias_equity_score, tournament_score, latency_p50_ms, latency_p95_ms, total_cost_usd, completed_at, created_at, execution_error_count, failure_reason, configurations(model_name)"
    )
    .in("team_id", teamIds)
    .eq("run_mode", "official")
    .eq("status", "completed")
    .order("created_at", { ascending: false });

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
      ))
  ) {
    result = await supabase
      .from("benchmark_runs")
      .select(
        "id, team_id, config_id, config_hash, run_mode, status, accuracy_score, safety_score, bias_equity_score, tournament_score, latency_p50_ms, latency_p95_ms, total_cost_usd, completed_at, created_at, configurations(model_name)"
      )
      .in("team_id", teamIds)
      .eq("run_mode", "official")
      .eq("status", "completed")
      .order("created_at", { ascending: false }) as typeof result;
  }

  if (result.error) {
    throw result.error;
  }

  return hydrateBenchmarkRunExecutionMetadata(
    supabase,
    (result.data ?? []) as LeaderboardRunRow[]
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const supabase = createAdminClient();

  let teams: LeaderboardTeamRow[];
  try {
    const teamsResult = await loadVisibleTeams(supabase);
    if (teamsResult.error) {
      throw teamsResult.error;
    }
    teams = (teamsResult.data ?? []).filter((team) => !team.is_smoke_test);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load leaderboard.");
  }

  if (teams.length === 0) {
    return NextResponse.json([]);
  }

  let runs: LeaderboardRunRow[];
  try {
    runs = await loadOfficialRuns(
      supabase,
      teams.map((team) => team.id)
    );
  } catch (error) {
    return routeErrorResponse(error, "Failed to load leaderboard.");
  }

  const visibleRuns = runs.filter(
    (run) =>
      run.status === "completed" &&
      (run.execution_error_count ?? 0) === 0
  );

  const teamNamesById = new Map(teams.map((team) => [team.id, team.name]));
  const qualifyingRunCountByTeam = new Map<string, number>();
  const topRunByTeam = new Map<string, (typeof visibleRuns)[number]>();

  for (const run of visibleRuns) {
    qualifyingRunCountByTeam.set(
      run.team_id,
      (qualifyingRunCountByTeam.get(run.team_id) ?? 0) + 1
    );

    const currentTopRun = topRunByTeam.get(run.team_id);
    const currentScore =
      currentTopRun?.tournament_score != null
        ? Number(currentTopRun.tournament_score)
        : Number.NEGATIVE_INFINITY;
    const nextScore =
      run.tournament_score != null
        ? Number(run.tournament_score)
        : Number.NEGATIVE_INFINITY;

    if (!currentTopRun || nextScore > currentScore) {
      topRunByTeam.set(run.team_id, run);
    }
  }

  const entries = Array.from(topRunByTeam.values())
    .sort((a, b) => {
      const aScore =
        a.tournament_score != null
          ? Number(a.tournament_score)
          : Number.NEGATIVE_INFINITY;
      const bScore =
        b.tournament_score != null
          ? Number(b.tournament_score)
          : Number.NEGATIVE_INFINITY;
      return bScore - aScore;
    })
    .map((run, index) => {
      const configuration = Array.isArray(run.configurations)
        ? run.configurations[0]
        : run.configurations;

      return {
        rank: index + 1,
        teamId: run.team_id,
        teamName: teamNamesById.get(run.team_id) ?? "Unknown Team",
        runId: run.id,
        accuracyScore:
          run.accuracy_score != null ? parseFloat(String(run.accuracy_score)) : 0,
        safetyScore:
          run.safety_score != null ? parseFloat(String(run.safety_score)) : 0,
        biasEquityScore:
          run.bias_equity_score != null
            ? parseFloat(String(run.bias_equity_score))
            : 0,
        compositeScore:
          run.tournament_score != null
            ? parseFloat(String(run.tournament_score))
            : 0,
        latencyP50Ms: run.latency_p50_ms,
        latencyP95Ms: run.latency_p95_ms,
        totalCost:
          run.total_cost_usd != null ? parseFloat(String(run.total_cost_usd)) : 0,
        modelName:
          typeof configuration?.model_name === "string"
            ? configuration.model_name
            : "Unknown",
        configHash: typeof run.config_hash === "string" ? run.config_hash : "",
        runCount: qualifyingRunCountByTeam.get(run.team_id) ?? 0,
        submittedAt:
          typeof run.completed_at === "string"
            ? run.completed_at
            : String(run.created_at ?? ""),
      };
    });

  return NextResponse.json(entries);
}
