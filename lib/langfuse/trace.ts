// ---------------------------------------------------------------------------
// tracedModelCall — wraps any ModelAdapter call with Langfuse observability
// ---------------------------------------------------------------------------

import type { ModelAdapter, ModelRequest, ModelResponse } from "../models/types";
import { disableLangfuse, getLangfuse } from "./client";

export interface TraceMetadata {
  teamId: string;
  userId: string;
  sessionId?: string;
  context: "chat" | "experiment" | "benchmark" | "population";
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
  if (!langfuse) {
    const response = await adapter.chat(request);
    return { ...response, traceId: "" };
  }

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
          responseMimeType: request.responseMimeType ?? null,
        },
      });
  } catch {
    const message =
      "Trace initialization failed. Check LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_BASE_URL.";
    console.warn(`[langfuse] ${message}`);
    disableLangfuse("trace_initialization_failed");
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
    void langfuse.flushAsync().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[langfuse] flush failed: ${message}`);
      disableLangfuse("flush_failed");
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[langfuse] generation end failed: ${message}`);
    disableLangfuse("generation_end_failed");
  }

  return { ...response, traceId };
}
