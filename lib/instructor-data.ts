import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseNoRowsError, notFoundError, toApiRouteError } from "@/lib/api-error";
import {
  isMissingSupabaseColumnError,
  isMissingSupabaseTableError,
} from "@/lib/supabase-compat";
import { hydrateBenchmarkRunExecutionMetadata } from "@/lib/benchmark-run-compat";

interface TeamMemberRow {
  user_id: string;
  role: "lead" | "member";
}

function isVisibleInstructorRun(run: Record<string, unknown>) {
  const executionErrorCount =
    typeof run.execution_error_count === "number"
      ? run.execution_error_count
      : 0;

  return run.status === "completed" && executionErrorCount === 0;
}

export async function loadInstructorTeamDetail(
  supabase: SupabaseClient,
  teamId: string
) {
  const teamQuery = supabase
    .from("teams")
    .select("id, name, join_code, created_at, is_smoke_test")
    .eq("id", teamId)
    .single();
  const fallbackTeamQuery = supabase
    .from("teams")
    .select("id, name, join_code, created_at")
    .eq("id", teamId)
    .single();
  const runQuery = supabase
    .from("benchmark_runs")
    .select("*, configurations(*)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(12);
  const fallbackRunQuery = supabase
    .from("benchmark_runs")
    .select(
      "id, team_id, config_id, run_mode, pack_id, status, accuracy_score, safety_score, bias_equity_score, tournament_score, evaluation_cost_usd, evaluation_tokens, hallucination_count, completed_at, created_at, configurations(*)"
    )
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(12);

  const [
    teamResult,
    memberResult,
    notebookResult,
    reflectionResult,
    runResult,
    flagResult,
    gradeResult,
    experimentResult,
    populationRunResult,
  ] = await Promise.all([
    teamQuery,
    supabase.from("team_members").select("user_id, role").eq("team_id", teamId),
    supabase
      .from("notebook_entries")
      .select("id, category, title, content, linked_experiment_id, tags, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("reflection_submissions")
      .select("*")
      .eq("team_id", teamId)
      .order("updated_at", { ascending: false })
      .limit(1),
    runQuery,
    supabase
      .from("instructor_flags")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("instructor_grades").select("*").eq("team_id", teamId).maybeSingle(),
    supabase
      .from("experiment_runs")
      .select("id, prompt, recipe_id, variable_focus, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("population_runs")
      .select("id, cohort_id, cohort_name, task_id, task_title, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  let normalizedTeamResult:
    | {
        data: {
          id: string;
          name: string;
          join_code: string;
          created_at: string;
          is_smoke_test?: boolean;
        } | null;
        error: typeof teamResult.error;
      }
    | typeof teamResult = teamResult;

  if (teamResult.error && isMissingSupabaseColumnError(teamResult.error, "teams", "is_smoke_test")) {
    const fallbackTeamResult = await fallbackTeamQuery;
    normalizedTeamResult = {
      data: fallbackTeamResult.data
        ? { ...fallbackTeamResult.data, is_smoke_test: false }
        : null,
      error: fallbackTeamResult.error,
    };
  }

  if (normalizedTeamResult.error) {
    if (isSupabaseNoRowsError(normalizedTeamResult.error)) {
      throw notFoundError("Team not found.");
    }
    throw toApiRouteError(normalizedTeamResult.error, "Failed to load team detail.");
  }

  if (!normalizedTeamResult.data) {
    throw notFoundError("Team not found.");
  }

  if (normalizedTeamResult.data.is_smoke_test) {
    throw notFoundError("Team not found.");
  }

  const memberRows = (memberResult.data ?? []) as TeamMemberRow[];
  const userIds = memberRows.map((member) => member.user_id);

  const usersResult =
    userIds.length > 0
      ? await supabase
          .from("users")
          .select("id, email, name, role")
          .in("id", userIds)
      : { data: [], error: null };

  if (memberResult.error) {
    throw toApiRouteError(memberResult.error, "Failed to load team members.");
  }

  if (usersResult.error) {
    throw toApiRouteError(usersResult.error, "Failed to load team members.");
  }

  let normalizedRunResult = runResult;
  if (
    runResult.error &&
    (isMissingSupabaseColumnError(
      runResult.error,
      "benchmark_runs",
      "execution_error_count"
    ) ||
      isMissingSupabaseColumnError(
        runResult.error,
        "benchmark_runs",
        "failure_reason"
      ))
  ) {
    normalizedRunResult = await fallbackRunQuery;
  }

  for (const result of [
    notebookResult,
    reflectionResult,
    normalizedRunResult,
    flagResult,
    gradeResult,
    experimentResult,
    populationRunResult,
  ]) {
    if (
      result.error &&
      !isSupabaseNoRowsError(result.error) &&
      !isMissingSupabaseTableError(result.error, "instructor_grades") &&
      !isMissingSupabaseTableError(result.error, "population_runs")
    ) {
      throw toApiRouteError(result.error, "Failed to load team detail.");
    }
  }

  const usersById = new Map(
    (usersResult.data ?? []).map((user) => [user.id, user])
  );

  const members = memberRows.map((member) => {
    const user = usersById.get(member.user_id);
    return {
      userId: member.user_id,
      name: user?.name ?? "Unknown user",
      email: user?.email ?? "",
      role: member.role,
      platformRole: user?.role ?? "student",
    };
  });

  const hydratedRuns = await hydrateBenchmarkRunExecutionMetadata(
    supabase,
    ((normalizedRunResult.data ?? []) as Array<Record<string, unknown> & { id: string }>)
  );

  const runs = hydratedRuns
    .filter((run) => isVisibleInstructorRun(run))
    .map((run) => {
      const config = Array.isArray(run.configurations)
        ? run.configurations[0]
        : run.configurations;
      return {
        id: run.id,
        configId: run.config_id,
        runMode: run.run_mode,
        packId: run.pack_id,
        status: run.status,
        executionErrorCount:
          typeof run.execution_error_count === "number"
            ? run.execution_error_count
            : 0,
        failureReason:
          typeof run.failure_reason === "string" ? run.failure_reason : null,
        accuracyScore: run.accuracy_score,
        safetyScore: run.safety_score,
        biasEquityScore: run.bias_equity_score,
        tournamentScore: run.tournament_score,
        evaluationCostUsd: run.evaluation_cost_usd,
        evaluationTokens: run.evaluation_tokens,
        hallucinationCount: run.hallucination_count,
        completedAt: run.completed_at,
        createdAt: run.created_at,
        configName: config?.name ?? "Saved Config",
        modelName: config?.model_name ?? "Unknown",
        presetId: config?.preset_id ?? null,
      };
    });

  const reflection = reflectionResult.data?.[0] ?? null;
  const grade = isMissingSupabaseTableError(gradeResult.error, "instructor_grades")
    ? null
    : (gradeResult.data ?? null);

  return {
    team: normalizedTeamResult.data,
    members,
    notebookEntries: notebookResult.data ?? [],
    reflection,
    runs,
    flags: flagResult.data ?? [],
    grade,
    experiments: experimentResult.data ?? [],
    populationRuns: isMissingSupabaseTableError(
      populationRunResult.error,
      "population_runs"
    )
      ? []
      : (populationRunResult.data ?? []),
  };
}
