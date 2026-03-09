import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/server-context";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const ctx = await getSessionContext(supabase, session);
  if (!ctx.team) {
    return NextResponse.json({
      summary: null,
      chatEvents: [],
      snapshots: [],
    });
  }

  const range = new URL(req.url).searchParams.get("range") ?? "7d";
  const days = range === "30d" ? 30 : range === "24h" ? 1 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [chatMessagesResult, snapshotResult] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("id, role, content, model_name, input_tokens, output_tokens, latency_ms, cost_usd, langfuse_trace_id, created_at")
      .eq("team_id", ctx.team.teamId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("team_observability_snapshots")
      .select("*")
      .eq("team_id", ctx.team.teamId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const assistantMessages = (chatMessagesResult.data ?? []).filter(
    (row) => row.role === "assistant"
  );
  const snapshots = snapshotResult.data ?? [];

  const totalChatTokens = assistantMessages.reduce(
    (sum, row) => sum + (row.input_tokens ?? 0) + (row.output_tokens ?? 0),
    0
  );
  const totalChatCost = assistantMessages.reduce(
    (sum, row) => sum + Number(row.cost_usd ?? 0),
    0
  );
  const avgLatency =
    assistantMessages.length > 0
      ? Math.round(
          assistantMessages.reduce((sum, row) => sum + (row.latency_ms ?? 0), 0) /
            assistantMessages.length
        )
      : 0;

  return NextResponse.json({
    summary: {
      totalTraces: assistantMessages.length + snapshots.length,
      totalTokens: totalChatTokens + snapshots.reduce((sum, row) => sum + row.total_tokens, 0),
      totalCost: Number(
        (totalChatCost +
          snapshots.reduce(
            (sum, row) => sum + Number(row.estimated_cost_usd ?? 0),
            0
          )).toFixed(6)
      ),
      avgLatencyMs: avgLatency,
    },
    chatEvents: assistantMessages,
    snapshots,
  });
}
