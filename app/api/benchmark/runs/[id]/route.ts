// ---------------------------------------------------------------------------
// /api/benchmark/runs/[id] — Get benchmark run details with case results (GET)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMissionForBenchmarkCase, getMissionPath } from "@/lib/course";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getSessionContext } from "@/lib/server-context";
import { hydrateBenchmarkRunExecutionMetadata } from "@/lib/benchmark-run-compat";
import { isMissingSupabaseColumnError } from "@/lib/supabase-compat";
import {
  reconcileStaleBenchmarkRuns,
  shouldReconcileStaleBenchmarkRuns,
} from "@/lib/benchmark/run-lifecycle";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function loadBenchmarkRun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  runId: string
) {
  let runResult = await supabase
    .from("benchmark_runs")
    .select("*, configurations(*), teams(id, name)")
    .eq("id", runId)
    .single();

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
      ) ||
      isMissingSupabaseColumnError(
        runResult.error,
        "benchmark_runs",
        "cases_completed"
      ) ||
      isMissingSupabaseColumnError(
        runResult.error,
        "benchmark_runs",
        "cases_total"
      ) ||
      isMissingSupabaseColumnError(
        runResult.error,
        "benchmark_runs",
        "last_progress_at"
      ))
  ) {
    runResult = await supabase
      .from("benchmark_runs")
      .select(
        "id, team_id, config_id, config_hash, run_mode, pack_id, status, started_at, completed_at, accuracy_score, safety_score, bias_equity_score, tournament_score, latency_p50_ms, latency_p95_ms, total_cost_usd, total_tokens, evaluation_cost_usd, evaluation_tokens, hallucination_count, consistency_score, execution_error_count, failure_reason, langfuse_session_id, created_at, cases_completed, cases_total, last_progress_at, configurations(*), teams(id, name)"
      )
      .eq("id", runId)
      .single();
  }

  return runResult;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const runId = params.id;
  if (!runId) {
    return NextResponse.json({ error: "Run id is required." }, { status: 400 });
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load benchmark run.");
  }

  let runResult = await loadBenchmarkRun(supabase, runId);

  let { data: run, error: runErr } = runResult;

  if (runErr || !run) {
    if (runErr) {
      return routeErrorResponse(runErr, "Failed to load benchmark run.");
    }
    return errorResponse("Benchmark run not found.", 404, "not_found");
  }

  let [runWithExecutionMetadata] = await hydrateBenchmarkRunExecutionMetadata(
    supabase,
    [run as Record<string, unknown> & { id: string }]
  );

  if (
    shouldReconcileStaleBenchmarkRuns([
      {
        status:
          typeof runWithExecutionMetadata.status === "string"
            ? runWithExecutionMetadata.status
            : null,
        last_progress_at:
          typeof runWithExecutionMetadata.last_progress_at === "string"
            ? runWithExecutionMetadata.last_progress_at
            : null,
        started_at:
          typeof runWithExecutionMetadata.started_at === "string"
            ? runWithExecutionMetadata.started_at
            : null,
        created_at:
          typeof runWithExecutionMetadata.created_at === "string"
            ? runWithExecutionMetadata.created_at
            : null,
      },
    ])
  ) {
    try {
      await reconcileStaleBenchmarkRuns(supabase);
    } catch (error) {
      return routeErrorResponse(
        error,
        "Failed to reconcile stale benchmark run."
      );
    }

    runResult = await loadBenchmarkRun(supabase, runId);
    run = runResult.data;
    runErr = runResult.error;

    if (runErr || !run) {
      if (runErr) {
        return routeErrorResponse(runErr, "Failed to load benchmark run.");
      }
      return errorResponse("Benchmark run not found.", 404, "not_found");
    }

    [runWithExecutionMetadata] = await hydrateBenchmarkRunExecutionMetadata(
      supabase,
      [run as Record<string, unknown> & { id: string }]
    );
  }

  const isOfficialCompleted = run.run_mode === "official" && run.status === "completed";
  const isInstructor = ["instructor", "admin"].includes(ctx.user.role);
  const isTeamMember = ctx.team?.teamId === run.team_id;

  if (!isInstructor && !isTeamMember && !isOfficialCompleted) {
    return NextResponse.json(
      { error: "You do not have access to this benchmark run." },
      { status: 403 }
    );
  }

  const canViewHiddenDetails = isInstructor || isTeamMember;
  const { data: caseResults, error: resultsErr } = await supabase
    .from("benchmark_case_results")
    .select(
      "*, benchmark_cases!inner(id, patient_id, case_set, category, title, difficulty, pack_id, phase, prompt, description, learning_objective, evidence_checklist, fairness_dimension, recommended_comparison)"
    )
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (resultsErr) {
    return routeErrorResponse(resultsErr, "Failed to load case results.");
  }

  const mappedResults = (caseResults ?? []).map((r) => {
    const caseInfo = r.benchmark_cases as {
      id: string;
      patient_id: string | null;
      case_set: string;
      category: string;
      title: string;
      difficulty: string;
      pack_id: string;
      phase: string;
      prompt: string;
      description: string;
      learning_objective: string | null;
      evidence_checklist: string[] | null;
      fairness_dimension: string | null;
      recommended_comparison: string | null;
    };
    const isRedacted = caseInfo.case_set !== "public";
    const scoringDetails = asRecord(r.scoring_details);
    const executionError = asRecord(scoringDetails?.error);
    const judge = asRecord(scoringDetails?.judge);
    const teachingReview = asRecord(scoringDetails?.teachingReview);
    const suggestedMission = getMissionForBenchmarkCase({
      category: caseInfo.category,
      patientId: caseInfo.patient_id,
      fairnessDimension: caseInfo.fairness_dimension,
    });

    const base = {
      id: r.id,
      caseId: r.case_id,
      category: caseInfo.category,
      title: caseInfo.title,
      difficulty: caseInfo.difficulty,
      caseSet: caseInfo.case_set,
      packId: caseInfo.pack_id,
      phase: caseInfo.phase,
      modelName: r.model_name,
      latencyMs: r.latency_ms,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      costUsd: r.cost_usd != null ? parseFloat(String(r.cost_usd)) : null,
      deterministicScore: r.deterministic_score != null ? parseFloat(String(r.deterministic_score)) : null,
      rubricScore: r.rubric_score != null ? parseFloat(String(r.rubric_score)) : null,
      judgeScore: r.judge_score != null ? parseFloat(String(r.judge_score)) : null,
      finalScore: r.final_score != null ? parseFloat(String(r.final_score)) : null,
      maxScore: r.max_score,
      isHallucination: r.is_hallucination,
      isFlagged: r.is_flagged,
      executionError,
    };

    if (isRedacted && !canViewHiddenDetails) {
      return base;
    }

    return {
      ...base,
      description: caseInfo.description,
      prompt: caseInfo.prompt,
      modelResponse: r.model_response,
      scoringDetails,
      learningObjective: caseInfo.learning_objective,
      evidenceChecklist: caseInfo.evidence_checklist ?? [],
      fairnessDimension: caseInfo.fairness_dimension,
      recommendedComparison: caseInfo.recommended_comparison,
      suggestedMissionId: suggestedMission?.id ?? null,
      suggestedMissionTitle: suggestedMission?.title ?? null,
      suggestedMissionPath: suggestedMission
        ? getMissionPath(suggestedMission.id)
        : null,
      judge,
      teachingReview,
      studentFeedback:
        typeof judge?.studentFeedback === "string"
          ? judge.studentFeedback
          : null,
      strengths: asArray(judge?.strengths),
      missingEvidence: asArray(judge?.missingEvidence),
      unsupportedClaims: asArray(judge?.unsupportedClaims),
      safetyConcerns: asArray(judge?.safetyConcerns),
      biasEquityConcerns: asArray(judge?.biasEquityConcerns),
      likelyFailureCause:
        typeof judge?.likelyFailureCause === "string"
          ? judge.likelyFailureCause
          : null,
      recommendedSettingChange:
        typeof judge?.recommendedSettingChange === "string"
          ? judge.recommendedSettingChange
          : null,
    };
  });

  const config = Array.isArray(run.configurations)
    ? run.configurations[0]
    : run.configurations;
  const team = Array.isArray(run.teams) ? run.teams[0] : run.teams;

  const response = {
    id: runWithExecutionMetadata.id,
    teamId: runWithExecutionMetadata.team_id,
    teamName: team?.name ?? "Unknown Team",
    configId: runWithExecutionMetadata.config_id,
    configHash: runWithExecutionMetadata.config_hash,
    runMode: runWithExecutionMetadata.run_mode,
    packId: runWithExecutionMetadata.pack_id,
    status: runWithExecutionMetadata.status,
    executionErrorCount: runWithExecutionMetadata.execution_error_count ?? 0,
    failureReason: runWithExecutionMetadata.failure_reason ?? null,
    casesCompleted: runWithExecutionMetadata.cases_completed ?? 0,
    casesTotal:
      typeof runWithExecutionMetadata.cases_total === "number"
        ? runWithExecutionMetadata.cases_total
        : null,
    lastProgressAt: runWithExecutionMetadata.last_progress_at ?? null,
    startedAt: runWithExecutionMetadata.started_at,
    completedAt: runWithExecutionMetadata.completed_at,
    accuracyScore:
      runWithExecutionMetadata.accuracy_score != null
        ? parseFloat(String(runWithExecutionMetadata.accuracy_score))
        : null,
    safetyScore:
      runWithExecutionMetadata.safety_score != null
        ? parseFloat(String(runWithExecutionMetadata.safety_score))
        : null,
    biasEquityScore:
      runWithExecutionMetadata.bias_equity_score != null
        ? parseFloat(String(runWithExecutionMetadata.bias_equity_score))
        : null,
    tournamentScore:
      runWithExecutionMetadata.tournament_score != null
        ? parseFloat(String(runWithExecutionMetadata.tournament_score))
        : null,
    latencyP50Ms: runWithExecutionMetadata.latency_p50_ms,
    latencyP95Ms: runWithExecutionMetadata.latency_p95_ms,
    totalCostUsd:
      runWithExecutionMetadata.total_cost_usd != null
        ? parseFloat(String(runWithExecutionMetadata.total_cost_usd))
        : null,
    totalTokens: runWithExecutionMetadata.total_tokens,
    evaluationCostUsd:
      runWithExecutionMetadata.evaluation_cost_usd != null
        ? parseFloat(String(runWithExecutionMetadata.evaluation_cost_usd))
        : null,
    evaluationTokens: runWithExecutionMetadata.evaluation_tokens,
    hallucinationCount: runWithExecutionMetadata.hallucination_count,
    consistencyScore:
      runWithExecutionMetadata.consistency_score != null
        ? parseFloat(String(runWithExecutionMetadata.consistency_score))
        : null,
    langfuseSessionId: runWithExecutionMetadata.langfuse_session_id,
    createdAt: runWithExecutionMetadata.created_at,
    config: config
      ? {
          id: config.id,
          name: config.name,
          modelName: config.model_name,
          modelProvider: config.model_provider,
          presetId: config.preset_id ?? null,
          temperature:
            config.temperature != null ? parseFloat(String(config.temperature)) : null,
          contextLevel: config.context_level,
          ragEnabled: config.rag_enabled,
          responseFormat: config.response_format,
        }
      : null,
    canViewHiddenDetails,
    results: mappedResults,
  };

  return NextResponse.json(response);
}
