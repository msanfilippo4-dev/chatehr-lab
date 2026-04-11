import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse, routeErrorResponse } from "@/lib/api-response";
import { getLangfuseStatus } from "@/lib/langfuse/client";
import { getSessionContext } from "@/lib/server-context";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return errorResponse("Unauthorized", 401, "unauthorized");
  }

  const supabase = createAdminClient();
  let ctx;
  try {
    ctx = await getSessionContext(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to load observability data.");
  }
  if (!ctx.team) {
    return NextResponse.json({
      summary: null,
      ragSummary: null,
      chatEvents: [],
      snapshots: [],
      langfuse: getLangfuseStatus(),
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

  if (chatMessagesResult.error) {
    return routeErrorResponse(
      chatMessagesResult.error,
      "Failed to load observability data."
    );
  }

  if (snapshotResult.error) {
    return routeErrorResponse(
      snapshotResult.error,
      "Failed to load observability data."
    );
  }

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

  const chunkCountByTitle = new Map<string, { title: string; hits: number }>();
  let ragEnabledTraces = 0;
  let tracesWithRetrievedContext = 0;
  let retrievedChunkTotal = 0;

  for (const snapshot of snapshots) {
    const metadata = asRecord(snapshot.metadata);
    const rag = metadata ? asRecord(metadata.rag) : null;
    if (!rag || rag.enabled !== true) continue;

    ragEnabledTraces += 1;

    const retrievedChunkCount =
      asNumber(rag.retrievedChunkCount) ||
      asNumber(rag.totalRetrievedChunks) ||
      asNumber(rag.casesWithRetrievedGuidelines);

    if (retrievedChunkCount > 0) {
      tracesWithRetrievedContext += 1;
      retrievedChunkTotal += retrievedChunkCount;
    }

    const retrievedChunks = Array.isArray(rag.retrievedChunks)
      ? rag.retrievedChunks
      : Array.isArray(rag.topRetrievedChunks)
        ? rag.topRetrievedChunks
        : [];

    for (const chunk of retrievedChunks) {
      const chunkRecord = asRecord(chunk);
      if (!chunkRecord?.title || typeof chunkRecord.title !== "string") continue;
      const key = chunkRecord.title;
      const current = chunkCountByTitle.get(key) ?? { title: key, hits: 0 };
      current.hits += asNumber(chunkRecord.hits) || 1;
      chunkCountByTitle.set(key, current);
    }
  }

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
    ragSummary: {
      ragEnabledTraces,
      tracesWithRetrievedContext,
      averageRetrievedChunks:
        tracesWithRetrievedContext > 0
          ? Number((retrievedChunkTotal / tracesWithRetrievedContext).toFixed(2))
          : 0,
      topRetrievedTitles: Array.from(chunkCountByTitle.values())
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 5),
    },
    chatEvents: assistantMessages,
    snapshots,
    langfuse: getLangfuseStatus(),
  });
}
