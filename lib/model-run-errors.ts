import type { ConfigSnapshot } from "./types";
import { isModelExecutionError } from "./model-execution";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function formatModelRunError(error: unknown, config: ConfigSnapshot) {
  const configLabel = config.name || config.modelName || "Selected config";
  const message = getErrorMessage(error);

  if (isModelExecutionError(error)) {
    switch (error.code) {
      case "privacy_restriction":
        return `The config "${configLabel}" is currently blocked by OpenRouter privacy settings. Use "Safety First" or "RAG Heavy", or update the OpenRouter data policy.`;
      case "model_unavailable":
        return `The config "${configLabel}" points to a model that is not currently available. Pick a different model or refresh the starter presets before trying again.`;
      case "timeout":
        return `The config "${configLabel}" timed out while waiting for the model provider. Try again or increase the request timeout.`;
      case "rate_limited":
        return `The config "${configLabel}" was rate-limited by the model provider. Wait a moment and retry.`;
      case "provider_unavailable":
        return `The config "${configLabel}" failed because the model provider is temporarily unavailable. Try again in a few minutes.`;
      default:
        break;
    }
  }

  if (
    config.modelProvider === "openrouter" &&
    message.includes(
      "No endpoints available matching your guardrail restrictions and data policy"
    )
  ) {
    return `The config "${configLabel}" is currently blocked by OpenRouter privacy settings. Use "Safety First" or "RAG Heavy", or update the OpenRouter data policy.`;
  }

  if (
    config.modelProvider === "openrouter" &&
    (message.includes("No endpoints found for") ||
      message.includes("is not currently available"))
  ) {
    return `The config "${configLabel}" points to an OpenRouter model that is not currently available. Pick a different model or refresh the starter presets before trying again.`;
  }

  return `The config "${configLabel}" failed: ${message}`;
}
