// ---------------------------------------------------------------------------
// /api/leaderboard — Fetch leaderboard from get_leaderboard() DB function (GET)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Call the database function
  const { data, error } = await supabase.rpc("get_leaderboard");

  if (error) {
    console.error("Failed to fetch leaderboard:", error);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }

  // Map to camelCase LeaderboardEntry format with rank
  const entries = (data ?? []).map(
    (
      row: {
        team_name: string;
        team_id: string;
        run_id: string;
        accuracy_score: number | null;
        safety_score: number | null;
        bias_equity_score: number | null;
        tournament_score: number | null;
        latency_p50_ms: number | null;
        latency_p95_ms: number | null;
        total_cost_usd: number | null;
        model_name: string;
        config_hash: string;
        run_count: number;
        completed_at: string;
      },
      index: number
    ) => ({
      rank: index + 1,
      teamId: row.team_id,
      teamName: row.team_name,
      runId: row.run_id,
      accuracyScore: row.accuracy_score != null ? parseFloat(String(row.accuracy_score)) : 0,
      safetyScore: row.safety_score != null ? parseFloat(String(row.safety_score)) : 0,
      biasEquityScore: row.bias_equity_score != null ? parseFloat(String(row.bias_equity_score)) : 0,
      compositeScore: row.tournament_score != null ? parseFloat(String(row.tournament_score)) : 0,
      latencyP50Ms: row.latency_p50_ms,
      latencyP95Ms: row.latency_p95_ms,
      totalCost: row.total_cost_usd != null ? parseFloat(String(row.total_cost_usd)) : 0,
      modelName: row.model_name,
      configHash: row.config_hash,
      runCount: row.run_count,
      submittedAt: row.completed_at,
    })
  );

  return NextResponse.json(entries);
}
