// ---------------------------------------------------------------------------
// Model adapter factory — resolves model name to the correct provider adapter
// ---------------------------------------------------------------------------

import { MODEL_REGISTRY } from "../constants";
import type { ModelAdapter } from "./types";
import { GeminiAdapter } from "./gemini";
import { OpenRouterAdapter } from "./openrouter";

/**
 * Create a ModelAdapter for the given model name.
 *
 * Looks up the model in MODEL_REGISTRY to determine which provider SDK to
 * use, then validates that the required API key env var is present.
 *
 * @throws {Error} if the model name is not in the registry
 * @throws {Error} if the required API key env var is missing (thrown by adapter constructor)
 */
export function createModelAdapter(modelName: string): ModelAdapter {
  const entry = MODEL_REGISTRY[modelName];
  if (!entry) {
    const supported = Object.keys(MODEL_REGISTRY).join(", ");
    throw new Error(
      `Unknown model "${modelName}". Supported models: ${supported}`
    );
  }

  switch (entry.provider) {
    case "gemini":
      return new GeminiAdapter(modelName);
    case "openrouter":
      return new OpenRouterAdapter(modelName);
    default: {
      // Exhaustive check — should never be reached if MODEL_REGISTRY is valid.
      const _exhaustive: never = entry.provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}
