import { tracedModelCall, type TraceMetadata, type TracedModelResponse } from "@/lib/langfuse/trace";
import { createModelAdapter } from "@/lib/models";
import { getRequestedModelChain } from "@/lib/model-fallback";
import type { ModelRequest } from "@/lib/models/types";
import type { ConfigSnapshot } from "@/lib/types";

export interface ModelExecutionErrorDetails {
  code:
    | "timeout"
    | "rate_limited"
    | "provider_unavailable"
    | "model_unavailable"
    | "privacy_restriction"
    | "request_failed";
  message: string;
  transient: boolean;
  provider: string;
  modelName: string;
  status?: number;
  rawMessage?: string;
}

export class ModelExecutionError extends Error {
  code: ModelExecutionErrorDetails["code"];
  transient: boolean;
  provider: string;
  modelName: string;
  status?: number;
  rawMessage?: string;

  constructor(details: ModelExecutionErrorDetails) {
    super(details.message);
    this.name = "ModelExecutionError";
    this.code = details.code;
    this.transient = details.transient;
    this.provider = details.provider;
    this.modelName = details.modelName;
    this.status = details.status;
    this.rawMessage = details.rawMessage;
  }

  toJSON(): ModelExecutionErrorDetails {
    return {
      code: this.code,
      message: this.message,
      transient: this.transient,
      provider: this.provider,
      modelName: this.modelName,
      status: this.status,
      rawMessage: this.rawMessage,
    };
  }
}

export interface ExecutedModelCall {
  response: TracedModelResponse;
  provider: ConfigSnapshot["modelProvider"];
  modelName: string;
  usedFallback: boolean;
  attemptCount: number;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: string | null;
      error?: { message?: string | null } | null;
    };
    if (candidate.message) {
      return candidate.message;
    }
    if (candidate.error?.message) {
      return candidate.error.message;
    }
  }
  return String(error);
}

function getErrorStatus(error: unknown, rawMessage: string) {
  if (error && typeof error === "object") {
    const candidate = error as { status?: number; code?: string | number };
    if (typeof candidate.status === "number") {
      return candidate.status;
    }
    if (typeof candidate.code === "number") {
      return candidate.code;
    }
  }

  const match = rawMessage.match(/\b(408|409|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : undefined;
}

function buildTimeoutError(timeoutMs: number, provider: string, modelName: string) {
  return new ModelExecutionError({
    code: "timeout",
    message: `The request timed out after ${Math.round(timeoutMs / 1000)}s.`,
    transient: true,
    provider,
    modelName,
    status: 504,
    rawMessage: `Timed out after ${timeoutMs}ms`,
  });
}

async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number | undefined,
  provider: string,
  modelName: string
) {
  if (!timeoutMs || timeoutMs <= 0) {
    return task;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(buildTimeoutError(timeoutMs, provider, modelName));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function isModelExecutionError(error: unknown): error is ModelExecutionError {
  return error instanceof ModelExecutionError;
}

export function normalizeModelExecutionError(args: {
  error: unknown;
  provider: string;
  modelName: string;
}): ModelExecutionError {
  if (isModelExecutionError(args.error)) {
    return args.error;
  }

  const rawMessage = getErrorMessage(args.error);
  const lowerMessage = rawMessage.toLowerCase();
  const status = getErrorStatus(args.error, rawMessage);

  if (
    status === 429 ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("too many requests") ||
    lowerMessage.includes("quota exceeded") ||
    lowerMessage.includes("resource exhausted")
  ) {
    return new ModelExecutionError({
      code: "rate_limited",
      message: "The model provider rate-limited this request.",
      transient: true,
      provider: args.provider,
      modelName: args.modelName,
      status,
      rawMessage,
    });
  }

  if (
    status === 408 ||
    status === 504 ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("deadline exceeded")
  ) {
    return new ModelExecutionError({
      code: "timeout",
      message: "The request timed out while waiting for the model provider.",
      transient: true,
      provider: args.provider,
      modelName: args.modelName,
      status,
      rawMessage,
    });
  }

  if (
    lowerMessage.includes(
      "no endpoints available matching your guardrail restrictions and data policy"
    ) ||
    (lowerMessage.includes("guardrail restrictions") &&
      lowerMessage.includes("data policy"))
  ) {
    return new ModelExecutionError({
      code: "privacy_restriction",
      message:
        "OpenRouter blocked this request because of the model's privacy or guardrail policy.",
      transient: false,
      provider: args.provider,
      modelName: args.modelName,
      status,
      rawMessage,
    });
  }

  if (
    lowerMessage.includes("no endpoints found for") ||
    lowerMessage.includes("not currently available") ||
    lowerMessage.includes("unknown model") ||
    lowerMessage.includes("model not found") ||
    lowerMessage.includes("does not exist") ||
    lowerMessage.includes("unsupported model") ||
    lowerMessage.includes("retired") ||
    lowerMessage.includes("deprecated")
  ) {
    return new ModelExecutionError({
      code: "model_unavailable",
      message: "The selected model is not currently available.",
      transient: false,
      provider: args.provider,
      modelName: args.modelName,
      status,
      rawMessage,
    });
  }

  if (
    status === 502 ||
    status === 503 ||
    lowerMessage.includes("service unavailable") ||
    lowerMessage.includes("temporarily unavailable") ||
    lowerMessage.includes("bad gateway") ||
    lowerMessage.includes("upstream error") ||
    lowerMessage.includes("provider unavailable") ||
    lowerMessage.includes("overloaded") ||
    lowerMessage.includes("model is overloaded") ||
    lowerMessage.includes("fetch failed") ||
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("socket hang up") ||
    lowerMessage.includes("econnreset") ||
    lowerMessage.includes("network error")
  ) {
    return new ModelExecutionError({
      code: "provider_unavailable",
      message: "The model provider is temporarily unavailable.",
      transient: true,
      provider: args.provider,
      modelName: args.modelName,
      status,
      rawMessage,
    });
  }

  return new ModelExecutionError({
    code: "request_failed",
    message: rawMessage || "The model request failed.",
    transient: false,
    provider: args.provider,
    modelName: args.modelName,
    status,
    rawMessage,
  });
}

function getBackoffDelayMs(attemptIndex: number) {
  return Math.min(1_500, 300 * Math.max(1, attemptIndex + 1));
}

function getEffectiveTimeoutMs(args: {
  baseTimeoutMs: number | undefined;
  provider: string;
  context: "chat" | "experiment" | "benchmark" | "population";
  config: ConfigSnapshot;
}) {
  const baseTimeoutMs = args.baseTimeoutMs;

  if (args.provider !== "gemini" || args.context === "chat") {
    return baseTimeoutMs;
  }

  const minimumBatchTimeoutMs =
    args.config.ragEnabled || args.config.contextLevel === "FULL" ? 60_000 : 45_000;

  if (!baseTimeoutMs || baseTimeoutMs <= 0) {
    return minimumBatchTimeoutMs;
  }

  return Math.max(baseTimeoutMs, minimumBatchTimeoutMs);
}

export async function executeModelWithConfig(args: {
  config: ConfigSnapshot;
  request: ModelRequest;
  trace: TraceMetadata;
}) {
  const attemptsPerModel = Math.max(1, Math.floor(args.config.retries ?? 0) + 1);
  const timeoutMs =
    args.config.requestTimeoutMs && args.config.requestTimeoutMs > 0
      ? args.config.requestTimeoutMs
      : args.request.timeout;

  const requestedModels = getRequestedModelChain(args.config);

  let attemptCount = 0;
  let lastError: ModelExecutionError | null = null;

  for (let modelIndex = 0; modelIndex < requestedModels.length; modelIndex += 1) {
    const modelName = requestedModels[modelIndex]!;
    const adapter = createModelAdapter(modelName);
    const effectiveTimeoutMs = getEffectiveTimeoutMs({
      baseTimeoutMs: timeoutMs,
      provider: adapter.provider,
      context: args.trace.context,
      config: args.config,
    });

    for (let attemptIndex = 0; attemptIndex < attemptsPerModel; attemptIndex += 1) {
      attemptCount += 1;

      try {
        const response = await withTimeout(
          tracedModelCall(
            adapter,
            { ...args.request, timeout: effectiveTimeoutMs },
            args.trace
          ),
          effectiveTimeoutMs,
          adapter.provider,
          modelName
        );

        return {
          response,
          provider: adapter.provider as ConfigSnapshot["modelProvider"],
          modelName,
          usedFallback: modelIndex > 0,
          attemptCount,
        } satisfies ExecutedModelCall;
      } catch (error) {
        lastError = normalizeModelExecutionError({
          error,
          provider: adapter.provider,
          modelName,
        });

        const hasMoreRetries = attemptIndex < attemptsPerModel - 1;
        if (hasMoreRetries && lastError.transient) {
          await wait(getBackoffDelayMs(attemptIndex));
          continue;
        }

        break;
      }
    }
  }

  throw (
    lastError ??
    new ModelExecutionError({
      code: "request_failed",
      message: "The model request failed.",
      transient: false,
      provider: "unknown",
      modelName: args.config.modelName,
    })
  );
}
