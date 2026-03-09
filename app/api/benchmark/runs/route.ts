import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/server-context";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const ctx = await getSessionContext(supabase, session);
  if (!ctx.team) {
    return NextResponse.json([]);
  }

  const { data: runs, error } = await supabase
    .from("benchmark_runs")
    .select(
      "id, run_mode, pack_id, status, accuracy_score, safety_score, bias_equity_score, tournament_score, latency_p95_ms, total_cost_usd, total_tokens, completed_at, created_at, configurations(model_name, name)"
    )
    .eq("team_id", ctx.team.teamId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load benchmark runs." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    (runs ?? []).map((run) => {
      const config = Array.isArray(run.configurations)
        ? run.configurations[0]
        : run.configurations;
      return {
        id: run.id,
        runMode: run.run_mode,
        packId: run.pack_id,
        status: run.status,
        accuracyScore: run.accuracy_score,
        safetyScore: run.safety_score,
        biasEquityScore: run.bias_equity_score,
        tournamentScore: run.tournament_score,
        latencyP95Ms: run.latency_p95_ms,
        totalCostUsd: run.total_cost_usd,
        totalTokens: run.total_tokens,
        completedAt: run.completed_at,
        createdAt: run.created_at,
        configName: config?.name ?? "Saved Config",
        modelName: config?.model_name ?? "Unknown",
      };
    })
  );
}
