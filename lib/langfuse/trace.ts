// ---------------------------------------------------------------------------
// tracedModelCall — wraps any ModelAdapter call with Langfuse observability
// ---------------------------------------------------------------------------

import type { ModelAdapter, ModelRequest, ModelResponse } from "../models/types";
import { getLangfuse } from "./client";

export interface TraceMetadata {
  teamId: string;
  userId: string;
  sessionId?: string;
  context: "chat" | "benchmark";
  caseId?: string;
}

export type TracedModelResponse = ModelResponse & { traceId: string };

/**
 * Execute a model call through the given adapter and record the full
 * request / response lifecycle in Langfuse.
 *
 * If Langfuse is misconfigured or the telemetry call fails the function
 * still returns the model response — observability should never break the
 * critical path.
 */
export async function tracedModelCall(
  adapter: ModelAdapter,
  request: ModelRequest,
  metadata: TraceMetadata
): Promise<TracedModelResponse> {
  const langfuse = getLangfuse();
  let traceId = "";

  // ── Create Langfuse trace ───────────────────────────────────────────
  let trace;
  let generation;
  try {
    trace = langfuse.trace({
      name: `${metadata.context}:${adapter.modelName}`,
      userId: metadata.userId,
      sessionId: metadata.sessionId,
      metadata: {
        teamId: metadata.teamId,
        context: metadata.context,
        caseId: metadata.caseId,
        provider: adapter.provider,
        modelName: adapter.modelName,
      },
    });
    traceId = trace.id;

    generation = trace.generation({
      name: "llm-call",
      model: adapter.modelName,
      input: request.messages,
      modelParameters: {
        temperature: request.temperature ?? null,
        maxOutputTokens: request.maxOutputTokens ?? null,
        topP: request.topP ?? null,
        topK: request.topK ?? null,
      },
    });
  } catch {
    // Langfuse initialisation failed — proceed without tracing
  }

  // ── Execute the model call ──────────────────────────────────────────
  const response = await adapter.chat(request);

  // ── Record output on the generation ─────────────────────────────────
  try {
    if (generation) {
      generation.end({
        output: response.text,
        usage: {
          input: response.inputTokens,
          output: response.outputTokens,
          unit: "TOKENS" as const,
        },
        metadata: {
          latencyMs: response.latencyMs,
          finishReason: response.finishReason,
        },
      });
    }

    // Flush asynchronously — do not block the response
    langfuse.flushAsync();
  } catch {
    // Telemetry flush failed — not critical
  }

  return { ...response, traceId };
}
