// ---------------------------------------------------------------------------
// Model adapter types — provider-agnostic interface for LLM calls
// ---------------------------------------------------------------------------

/**
 * A single message in a multi-turn conversation.
 */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Request payload sent to any model adapter.
 */
export interface ModelRequest {
  messages: ChatMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  responseFormat?: string;
  timeout?: number;
}

/**
 * Normalised response returned by every model adapter.
 */
export interface ModelResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
  finishReason: string;
}

/**
 * Breakdown of token costs in USD.
 */
export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

/**
 * Provider-agnostic adapter interface. Each supported LLM provider (Gemini,
 * OpenRouter, etc.) implements this so the rest of the app never touches raw SDKs.
 */
export interface ModelAdapter {
  /** Provider identifier, e.g. "gemini" or "openrouter". */
  provider: string;

  /** Specific model name, e.g. "gemini-2.0-flash". */
  modelName: string;

  /** Send a chat request and return a normalised response. */
  chat(req: ModelRequest): Promise<ModelResponse>;

  /** Estimate cost given token counts (uses MODEL_REGISTRY pricing). */
  estimateCost(inputTokens: number, outputTokens: number): CostBreakdown;
}

/**
 * Result of validating a config or request before execution.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
