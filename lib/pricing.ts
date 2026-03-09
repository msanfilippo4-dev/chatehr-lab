// ---------------------------------------------------------------------------
// Token cost estimation per model
// ---------------------------------------------------------------------------

import type { CostBreakdown } from "./types";
import { MODEL_REGISTRY } from "./constants";

/**
 * Estimate the USD cost for a given model call based on token counts.
 *
 * Prices are stored in the MODEL_REGISTRY as cost-per-million-tokens.
 * If the model is not found in the registry the function returns zero costs
 * so callers never throw on an unknown model.
 */
export function estimateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): CostBreakdown {
  const entry = MODEL_REGISTRY[modelName];

  if (!entry) {
    return { inputCost: 0, outputCost: 0, totalCost: 0, currency: "USD" };
  }

  const inputCost = (inputTokens / 1_000_000) * entry.inputPricePerMToken;
  const outputCost = (outputTokens / 1_000_000) * entry.outputPricePerMToken;

  return {
    inputCost: parseFloat(inputCost.toFixed(8)),
    outputCost: parseFloat(outputCost.toFixed(8)),
    totalCost: parseFloat((inputCost + outputCost).toFixed(8)),
    currency: "USD",
  };
}
