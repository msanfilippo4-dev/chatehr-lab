/**
 * Langfuse Metrics — Extract and aggregate metrics from traces.
 */

export interface LatencyMetrics {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
  count: number;
}

export interface CostMetrics {
  totalCostUsd: number;
  avgCostPerCallUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  count: number;
}

export interface TeamKpiSnapshot {
  accuracyScore: number | null;
  safetyScore: number | null;
  tournamentScore: number | null;
  latency: LatencyMetrics;
  cost: CostMetrics;
  hallucinations: number;
  totalRuns: number;
}

/**
 * Compute latency percentiles from an array of latency values.
 */
export function computeLatencyPercentiles(latencies: number[]): LatencyMetrics {
  if (latencies.length === 0) {
    return { p50Ms: 0, p95Ms: 0, p99Ms: 0, avgMs: 0, count: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const count = sorted.length;
  const avg = sorted.reduce((sum, v) => sum + v, 0) / count;

  return {
    p50Ms: sorted[Math.floor(count * 0.5)] ?? 0,
    p95Ms: sorted[Math.floor(count * 0.95)] ?? 0,
    p99Ms: sorted[Math.floor(count * 0.99)] ?? 0,
    avgMs: Math.round(avg),
    count,
  };
}

/**
 * Compute aggregate cost metrics.
 */
export function computeCostMetrics(
  costs: Array<{ inputTokens: number; outputTokens: number; costUsd: number }>
): CostMetrics {
  if (costs.length === 0) {
    return {
      totalCostUsd: 0,
      avgCostPerCallUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      count: 0,
    };
  }

  const totalCost = costs.reduce((sum, c) => sum + c.costUsd, 0);
  const totalInput = costs.reduce((sum, c) => sum + c.inputTokens, 0);
  const totalOutput = costs.reduce((sum, c) => sum + c.outputTokens, 0);

  return {
    totalCostUsd: Number(totalCost.toFixed(6)),
    avgCostPerCallUsd: Number((totalCost / costs.length).toFixed(6)),
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    count: costs.length,
  };
}

/**
 * Compute a normalized tournament score using only the benchmark dimensions
 * that are actually present in the evaluated pack.
 */
export function computeTournamentScore(scores: {
  accuracy: number | null;
  safety: number | null;
  biasEquity: number | null;
}, weights: {
  accuracy: number;
  safety: number;
  biasEquity: number;
}): number | null {
  const weightedTotal =
    (scores.accuracy != null ? weights.accuracy * scores.accuracy : 0) +
    (scores.safety != null ? weights.safety * scores.safety : 0) +
    (scores.biasEquity != null ? weights.biasEquity * scores.biasEquity : 0);

  const availableWeight =
    (scores.accuracy != null ? weights.accuracy : 0) +
    (scores.safety != null ? weights.safety : 0) +
    (scores.biasEquity != null ? weights.biasEquity : 0);

  if (availableWeight === 0) {
    return null;
  }

  return Number((weightedTotal / availableWeight).toFixed(2));
}

/**
 * Determine consistency score by comparing responses from identical prompts.
 * Returns a 0-100 score where 100 = perfectly consistent.
 */
export function computeConsistencyScore(
  responseGroups: Array<{ prompt: string; responses: string[] }>
): number {
  if (responseGroups.length === 0) return 100;

  let totalPairs = 0;
  let matchingPairs = 0;

  for (const group of responseGroups) {
    const responses = group.responses;
    if (responses.length < 2) continue;

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        totalPairs++;
        // Simple similarity: check if responses share significant overlap
        const similarity = computeTextSimilarity(responses[i], responses[j]);
        if (similarity > 0.8) matchingPairs++;
      }
    }
  }

  if (totalPairs === 0) return 100;
  return Number(((matchingPairs / totalPairs) * 100).toFixed(2));
}

/**
 * Compute simple text similarity (Jaccard on word sets).
 */
function computeTextSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));

  let intersection = 0;
  for (const word of Array.from(wordsA)) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  if (union === 0) return 1;
  return intersection / union;
}
