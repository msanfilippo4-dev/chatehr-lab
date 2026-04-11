import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { requireInstructor } from "@/lib/server-context";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseTableError,
} from "@/lib/supabase-compat";
import { hydrateBenchmarkRunExecutionMetadata } from "@/lib/benchmark-run-compat";

type TeamRow = {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
  is_smoke_test?: boolean;
};

type GradeRow = {
  team_id: string;
  updated_at: string | null;
  experimental_design: number | null;
  benchmark_evidence: number | null;
  cost_observability: number | null;
  safety_reasoning: number | null;
  bias_equity: number | null;
  final_recommendation: number | null;
};

type BenchmarkRunRow = {
  team_id: string;
  id: string;
  run_mode: string;
  pack_id: string | null;
  tournament_score: number | null;
  safety_score: number | null;
  bias_equity_score: number | null;
  completed_at: string | null;
  created_at: string;
  status: string;
  execution_error_count?: number;
};

function gradeTotal(row: GradeRow | undefined) {
  if (!row) {
    return null;
  }

  return (
    (row.experimental_design ?? 0) +
    (row.benchmark_evidence ?? 0) +
    (row.cost_observability ?? 0) +
    (row.safety_reasoning ?? 0) +
    (row.bias_equity ?? 0) +
    (row.final_recommendation ?? 0)
  );
}

async function loadTeams(supabase: ReturnType<typeof createAdminClient>) {
  let result = await supabase
    .from("teams")
    .select("id, name, join_code, created_at, is_smoke_test")
    .order("created_at", { ascending: false });

  if (result.error && isMissingSupabaseColumnError(result.error, "teams", "is_smoke_test")) {
    result = await supabase
      .from("teams")
      .select("id, name, join_code, created_at")
      .order("created_at", { ascending: false }) as typeof result;

    return {
      data: ((result.data ?? []) as TeamRow[]).map((team) => ({
        ...team,
        is_smoke_test: false,
      })),
      error: result.error,
    };
  }

  return { data: (result.data ?? []) as TeamRow[], error: result.error };
}

async function loadRuns(supabase: ReturnType<typeof createAdminClient>, teamIds: string[]) {
  let result = await supabase
    .from("benchmark_runs")
    .select(
      "team_id, id, run_mode, pack_id, tournament_score, safety_score, bias_equity_score, completed_at, created_at, status, execution_error_count"
    )
    .in("team_id", teamIds)
    .order("created_at", { ascending: false });

  if (
    result.error &&
    isMissingSupabaseColumnError(
      result.error,
      "benchmark_runs",
      "execution_error_count"
    )
  ) {
    result = await supabase
      .from("benchmark_runs")
      .select(
        "team_id, id, run_mode, pack_id, tournament_score, safety_score, bias_equity_score, completed_at, created_at, status"
      )
      .in("team_id", teamIds)
      .order("created_at", { ascending: false }) as typeof result;

    return {
      data: (result.data ?? []) as BenchmarkRunRow[],
      error: result.error,
    };
  }

  const runs = await hydrateBenchmarkRunExecutionMetadata(
    supabase,
    (result.data ?? []) as Array<BenchmarkRunRow & { id: string }>
  );

  return { data: runs as BenchmarkRunRow[], error: result.error };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const supabase = createAdminClient();
  try {
    await requireInstructor(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load instructor teams.");
  }

  try {
    const teamsResult = await loadTeams(supabase);
    if (teamsResult.error) {
      throw teamsResult.error;
    }

    const visibleTeams = (teamsResult.data ?? []).filter(
      (team) => !team.is_smoke_test
    );

    if (visibleTeams.length === 0) {
      return NextResponse.json([]);
    }

    const teamIds = visibleTeams.map((team) => team.id);
    const [
      membersResult,
      notebookResult,
      reflectionResult,
      gradesResult,
      runsResult,
    ] = await Promise.all([
      supabase.from("team_members").select("team_id").in("team_id", teamIds),
      supabase.from("notebook_entries").select("team_id").in("team_id", teamIds),
      supabase
        .from("reflection_submissions")
        .select("team_id, updated_at")
        .in("team_id", teamIds)
        .order("updated_at", { ascending: false }),
      supabase
        .from("instructor_grades")
        .select(
          "team_id, updated_at, experimental_design, benchmark_evidence, cost_observability, safety_reasoning, bias_equity, final_recommendation"
        )
        .in("team_id", teamIds),
      loadRuns(supabase, teamIds),
    ]);

    for (const result of [membersResult, notebookResult, reflectionResult]) {
      if (result.error) {
        throw result.error;
      }
    }

    if (
      gradesResult.error &&
      !isMissingSupabaseTableError(gradesResult.error, "instructor_grades")
    ) {
      throw gradesResult.error;
    }

    if (runsResult.error) {
      throw runsResult.error;
    }

    const memberCounts = new Map<string, number>();
    for (const row of membersResult.data ?? []) {
      memberCounts.set(row.team_id, (memberCounts.get(row.team_id) ?? 0) + 1);
    }

    const notebookCounts = new Map<string, number>();
    for (const row of notebookResult.data ?? []) {
      notebookCounts.set(row.team_id, (notebookCounts.get(row.team_id) ?? 0) + 1);
    }

    const reflectionByTeamId = new Map<string, string>();
    for (const row of reflectionResult.data ?? []) {
      if (row.updated_at && !reflectionByTeamId.has(row.team_id)) {
        reflectionByTeamId.set(row.team_id, row.updated_at);
      }
    }

    const gradeByTeamId = new Map<string, GradeRow>();
    for (const row of (gradesResult.data ?? []) as GradeRow[]) {
      gradeByTeamId.set(row.team_id, row);
    }

    const latestRunByTeamId = new Map<string, BenchmarkRunRow>();
    for (const run of runsResult.data ?? []) {
      if (run.status !== "completed" || (run.execution_error_count ?? 0) > 0) {
        continue;
      }

      if (!latestRunByTeamId.has(run.team_id)) {
        latestRunByTeamId.set(run.team_id, run);
      }
    }

    return NextResponse.json(
      visibleTeams.map((team) => {
        const grade = gradeByTeamId.get(team.id);
        const latestRun = latestRunByTeamId.get(team.id);

        return {
          id: team.id,
          name: team.name,
          joinCode: team.join_code,
          createdAt: team.created_at,
          memberCount: memberCounts.get(team.id) ?? 0,
          notebookCount: notebookCounts.get(team.id) ?? 0,
          reflectionUpdatedAt: reflectionByTeamId.get(team.id) ?? null,
          gradeTotal: gradeTotal(grade),
          gradeUpdatedAt: grade?.updated_at ?? null,
          latestRun: latestRun
            ? {
              id: latestRun.id,
              runMode: latestRun.run_mode,
              packId: latestRun.pack_id,
              status: latestRun.status,
              executionErrorCount: latestRun.execution_error_count ?? 0,
              tournamentScore: latestRun.tournament_score,
              safetyScore: latestRun.safety_score,
              biasEquityScore: latestRun.bias_equity_score,
                completedAt: latestRun.completed_at ?? latestRun.created_at,
              }
            : null,
        };
      })
    );
  } catch (error) {
    return routeErrorResponse(error, "Failed to load instructor teams.");
  }
}
