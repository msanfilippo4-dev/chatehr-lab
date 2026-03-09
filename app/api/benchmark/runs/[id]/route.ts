// ---------------------------------------------------------------------------
// /api/benchmark/runs/[id] — Get benchmark run details with case results (GET)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = params.id;
  if (!runId) {
    return NextResponse.json({ error: "Run id is required." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch the benchmark run
  const { data: run, error: runErr } = await supabase
    .from("benchmark_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (runErr || !run) {
    return NextResponse.json({ error: "Benchmark run not found." }, { status: 404 });
  }

  // Verify access: user must be on the run's team, OR the run is a completed official run
  const { data: user } = await supabase
    .from("users")
    .select("id, role")
    .eq("email", session.user.email)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const isOfficialCompleted = run.run_mode === "official" && run.status === "completed";

  let isTeamMember = false;
  if (!isOfficialCompleted) {
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("team_id", run.team_id)
      .eq("user_id", user.id)
      .single();

    isTeamMember = !!membership;

    if (!isTeamMember && user.role !== "instructor") {
      return NextResponse.json(
        { error: "You do not have access to this benchmark run." },
        { status: 403 }
      );
    }
  } else {
    // Check membership for response detail visibility
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("team_id", run.team_id)
      .eq("user_id", user.id)
      .single();

    isTeamMember = !!membership;
  }

  // Fetch case results for this run
  const { data: caseResults, error: resultsErr } = await supabase
    .from("benchmark_case_results")
    .select("*, benchmark_cases!inner(case_set, category, title, difficulty)")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (resultsErr) {
    console.error("Failed to fetch case results:", resultsErr);
    return NextResponse.json({ error: "Failed to load case results." }, { status: 500 });
  }

  // Map results: for hidden/adversarial cases, redact model_response and prompt
  const mappedResults = (caseResults ?? []).map((r) => {
    const caseInfo = r.benchmark_cases as {
      case_set: string;
      category: string;
      title: string;
      difficulty: string;
    };
    const isRedacted = caseInfo.case_set !== "public";

    const base = {
      id: r.id,
      caseId: r.case_id,
      category: caseInfo.category,
      title: caseInfo.title,
      difficulty: caseInfo.difficulty,
      caseSet: caseInfo.case_set,
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
    };

    if (isRedacted && !isTeamMember) {
      // For non-team members viewing official runs: hide model response
      return base;
    }

    // For team members or public cases: include model response and scoring details
    return {
      ...base,
      modelResponse: isRedacted ? undefined : r.model_response,
      scoringDetails: r.scoring_details,
    };
  });

  // Build response
  const response = {
    id: run.id,
    teamId: run.team_id,
    configId: run.config_id,
    configHash: run.config_hash,
    runMode: run.run_mode,
    packId: run.pack_id,
    status: run.status,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    accuracyScore: run.accuracy_score != null ? parseFloat(String(run.accuracy_score)) : null,
    safetyScore: run.safety_score != null ? parseFloat(String(run.safety_score)) : null,
    biasEquityScore: run.bias_equity_score != null ? parseFloat(String(run.bias_equity_score)) : null,
    tournamentScore: run.tournament_score != null ? parseFloat(String(run.tournament_score)) : null,
    latencyP50Ms: run.latency_p50_ms,
    latencyP95Ms: run.latency_p95_ms,
    totalCostUsd: run.total_cost_usd != null ? parseFloat(String(run.total_cost_usd)) : null,
    totalTokens: run.total_tokens,
    hallucinationCount: run.hallucination_count,
    consistencyScore: run.consistency_score != null ? parseFloat(String(run.consistency_score)) : null,
    langfuseSessionId: run.langfuse_session_id,
    createdAt: run.created_at,
    results: mappedResults,
  };

  return NextResponse.json(response);
}
