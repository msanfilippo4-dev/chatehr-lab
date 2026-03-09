import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonBodyWithLimit } from "@/lib/api-request";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { mapDbRowToConfig } from "@/lib/config-mapper";
import { createModelAdapter } from "@/lib/models";
import type { ModelRequest } from "@/lib/models/types";
import { tracedModelCall } from "@/lib/langfuse/trace";
import { estimateCost } from "@/lib/pricing";
import { retrieveChunks } from "@/lib/rag-retrieval";
import {
  buildInjectedGuidelineContext,
  buildRagObservabilityMetadata,
} from "@/lib/rag-observability";
import type { ConfigSnapshot, RAGChunk } from "@/lib/types";
import { getSessionContext } from "@/lib/server-context";

interface ChatRequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context?: string;
  configId?: string;
  patientId?: string;
}

interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  model: string;
  latencyMs: number;
  historyMessagesUsed: number;
  ragChunksUsed: number;
}

function buildSystemInstruction(config: ConfigSnapshot) {
  const sections = [config.systemInstruction];

  if (config.safetyPreambleEnabled) {
    sections.unshift(
      "You are an educational clinical AI assistant in a simulated EHR. Do not present yourself as a licensed clinician. Highlight uncertainty, safety risks, and when a human review is required."
    );
  }

  if (config.styleProfile === "terse") {
    sections.push(
      "Use concise bullet points and avoid filler. Keep the answer short unless the user asks for detail."
    );
  } else if (config.styleProfile === "conversational") {
    sections.push(
      "Use plain language appropriate for a non-technical graduate student audience."
    );
  } else {
    sections.push(
      "Use professional clinical language while remaining readable to graduate health informatics students."
    );
  }

  if (config.responseFormat === "structured") {
    sections.push(
      "Structure the answer with short headings: Assessment, Evidence, Risks, and Next Step."
    );
  } else if (config.responseFormat === "chain-of-thought") {
    sections.push(
      "Briefly explain your reasoning using chart evidence before the recommendation. Do not expose hidden chain-of-thought."
    );
  }

  if (config.citationRequired) {
    sections.push(
      "Cite concrete chart evidence using values, dates, medication names, or note details."
    );
  }

  if (config.abstainRule) {
    sections.push(config.abstainRule);
  }

  if (config.confidenceFloor > 0) {
    sections.push(
      `If your confidence is below ${(config.confidenceFloor * 100).toFixed(0)}%, say that directly and recommend verification.`
    );
  }

  return sections.filter(Boolean).join("\n\n");
}

async function loadConfig(
  supabase: ReturnType<typeof createAdminClient>,
  configId?: string
): Promise<ConfigSnapshot> {
  if (!configId) return { ...DEFAULT_CONFIG, name: "Default Config" };

  const { data: dbConfig, error } = await supabase
    .from("configurations")
    .select("*")
    .eq("id", configId)
    .single();

  if (error || !dbConfig) {
    throw new Error("Configuration not found.");
  }

  return mapDbRowToConfig(dbConfig);
}

async function loadPatientConditionLabels(
  supabase: ReturnType<typeof createAdminClient>,
  patientId?: string
) {
  if (!patientId) return [];

  const { data } = await supabase
    .from("conditions")
    .select("display")
    .eq("patient_id", patientId);

  return (data ?? []).map((row) => row.display);
}

async function maybeRetrieveGuidelines(args: {
  supabase: ReturnType<typeof createAdminClient>;
  config: ConfigSnapshot;
  patientId?: string;
  userQuery: string;
  teamId?: string | null;
}) {
  const { supabase, config, patientId, userQuery, teamId } = args;

  if (!config.ragEnabled) return [] as Array<RAGChunk & { score: number }>;

  const [{ data: chunks }, patientConditions] = await Promise.all([
    supabase
      .from("guideline_chunks")
      .select("id, source, title, text, keywords")
      .limit(500),
    loadPatientConditionLabels(supabase, patientId),
  ]);

  const chunkRows = (chunks ?? []) as RAGChunk[];
  const method = config.ragMethod === "hybrid" ? "keyword" : config.ragMethod;
  const retrieved = await retrieveChunks(
    chunkRows,
    userQuery,
    patientConditions,
    method === "embedding" ? "semantic" : "keyword",
    config.ragTopK
  );

  if (teamId && retrieved.length > 0) {
    await supabase.from("retrieval_logs").insert({
      team_id: teamId,
      query: userQuery,
      method: config.ragMethod,
      chunks_returned: retrieved.map((chunk) => chunk.id),
      scores: retrieved.reduce<Record<string, number>>((acc, chunk) => {
        acc[chunk.id] = chunk.score;
        return acc;
      }, {}),
    });
  }

  return retrieved;
}

function buildPromptRequest(args: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  config: ConfigSnapshot;
  context?: string;
  ragChunks: RAGChunk[];
}) {
  const { messages, config, context, ragChunks } = args;
  const systemInstruction = buildSystemInstruction(config);
  const trimmedMessages =
    config.historyDepth > 0 && messages.length > config.historyDepth
      ? messages.slice(-config.historyDepth)
      : messages;

  const contextBlocks: string[] = [];
  if (context) {
    contextBlocks.push(`PATIENT EHR CONTEXT:\n${context}`);
  }
  if (ragChunks.length > 0) {
    contextBlocks.push(buildInjectedGuidelineContext(ragChunks));
  }

  const requestMessages = [...trimmedMessages];
  const lastUserIndex = requestMessages.map((msg) => msg.role).lastIndexOf("user");
  if (lastUserIndex >= 0 && contextBlocks.length > 0) {
    requestMessages[lastUserIndex] = {
      ...requestMessages[lastUserIndex],
      content: `${contextBlocks.join("\n\n")}\n\nUSER QUESTION:\n${requestMessages[lastUserIndex].content}`,
    };
  }

  const request: ModelRequest = {
    messages: requestMessages,
    systemInstruction,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    topP: config.topP,
    topK: config.topK,
  };

  return {
    request,
    historyMessagesUsed: trimmedMessages.length,
  };
}

async function callWithFallback(args: {
  config: ConfigSnapshot;
  request: ModelRequest;
  teamId?: string | null;
  userId: string;
}) {
  const attempts = [args.config.modelName];
  if (args.config.fallbackModel) attempts.push(args.config.fallbackModel);

  let lastError: unknown;
  for (const modelName of attempts) {
    try {
      const adapter = createModelAdapter(modelName);
      return await tracedModelCall(adapter, args.request, {
        teamId: args.teamId ?? "no-team",
        userId: args.userId,
        sessionId: `${args.teamId ?? "solo"}:chat`,
        context: "chat",
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Model call failed.");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBodyWithLimit<ChatRequestBody>(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const { messages, context, configId, patientId } = body.data;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "At least one message is required." },
      { status: 400 }
    );
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    return NextResponse.json(
      { error: "The last message must be from the user." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const ctx = await getSessionContext(supabase, session);

  let config: ConfigSnapshot;
  try {
    config = await loadConfig(supabase, configId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load configuration." },
      { status: 404 }
    );
  }

  if (config.teamId && ctx.team?.teamId && config.teamId !== ctx.team.teamId) {
    return NextResponse.json(
      { error: "This configuration does not belong to your team." },
      { status: 403 }
    );
  }

  const ragChunks = await maybeRetrieveGuidelines({
    supabase,
    config,
    patientId,
    userQuery: lastMessage.content,
    teamId: ctx.team?.teamId,
  });

  const ragMetadata = buildRagObservabilityMetadata({
    enabled: config.ragEnabled,
    method: config.ragMethod,
    topK: config.ragTopK,
    userQuery: lastMessage.content,
    patientConditions: await loadPatientConditionLabels(supabase, patientId),
    retrievedChunks: ragChunks,
    includeSourceInInjectedContext: true,
  });

  const { request, historyMessagesUsed } = buildPromptRequest({
    messages,
    config,
    context,
    ragChunks,
  });

  let response;
  try {
    response = await callWithFallback({
      config,
      request,
      teamId: ctx.team?.teamId,
      userId: ctx.user.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown model call failure.";

    if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Model call failed: ${message}` },
      { status: 502 }
    );
  }

  const costBreakdown = estimateCost(
    response.model,
    response.inputTokens,
    response.outputTokens
  );

  if (ctx.team) {
    await supabase.from("chat_messages").insert([
      {
        team_id: ctx.team.teamId,
        user_id: ctx.user.id,
        patient_id: patientId ?? null,
        config_id: configId ?? null,
        role: "user",
        content: lastMessage.content,
        model_name: null,
        input_tokens: null,
        output_tokens: null,
        latency_ms: null,
        cost_usd: null,
        langfuse_trace_id: null,
      },
      {
        team_id: ctx.team.teamId,
        user_id: ctx.user.id,
        patient_id: patientId ?? null,
        config_id: configId ?? null,
        role: "assistant",
        content: response.text,
        model_name: response.model,
        input_tokens: response.inputTokens,
        output_tokens: response.outputTokens,
        latency_ms: response.latencyMs,
        cost_usd: costBreakdown.totalCost,
        langfuse_trace_id: response.traceId,
      },
    ]);

    await supabase.from("team_observability_snapshots").insert({
      team_id: ctx.team.teamId,
      source_type: "chat",
      source_id: response.traceId || `${Date.now()}`,
      model_name: response.model,
      provider: config.modelProvider,
      input_tokens: response.inputTokens,
      output_tokens: response.outputTokens,
      total_tokens: response.inputTokens + response.outputTokens,
      estimated_cost_usd: costBreakdown.totalCost,
      latency_ms: response.latencyMs,
      metadata: {
        patientId: patientId ?? null,
        configId: configId ?? null,
        rag: ragMetadata,
      },
    });
  }

  const usage: ChatUsage = {
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    totalTokens: response.inputTokens + response.outputTokens,
    estimatedCost: costBreakdown.totalCost,
    model: response.model,
    latencyMs: response.latencyMs,
    historyMessagesUsed,
    ragChunksUsed: ragChunks.length,
  };

  return NextResponse.json({
    text: response.text,
    usage,
    ragChunks,
  });
}
