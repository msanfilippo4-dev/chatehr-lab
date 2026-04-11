import { getBenchmarkPackMeta } from "@/lib/course";

export type BenchmarkMetricDimension = "accuracy" | "safety" | "biasEquity";

interface BenchmarkRunLike {
  packId: string | null | undefined;
  status: string | null | undefined;
  executionErrorCount?: number | null;
  accuracyScore: number | null | undefined;
  safetyScore: number | null | undefined;
  biasEquityScore: number | null | undefined;
  tournamentScore: number | null | undefined;
}

export function isActiveBenchmarkRunLike(args: {
  status: string | null | undefined;
}) {
  return args.status === "pending" || args.status === "running";
}

export function isCompletedBenchmarkRunLike(args: {
  status: string | null | undefined;
  executionErrorCount?: number | null;
}) {
  return args.status === "completed" && (args.executionErrorCount ?? 0) === 0;
}

export function isBenchmarkMetricCovered(
  metric: BenchmarkMetricDimension,
  packId: string | null | undefined
) {
  if (metric === "accuracy") {
    return true;
  }

  const pack = getBenchmarkPackMeta(packId);
  if (!pack) {
    return true;
  }

  if (metric === "safety") {
    return pack.coverage.safety;
  }

  return pack.coverage.biasEquity;
}

export function formatBenchmarkMetric(args: {
  metric: BenchmarkMetricDimension;
  value: number | null | undefined;
  packId: string | null | undefined;
  status: string | null | undefined;
  executionErrorCount?: number | null;
  withPercent?: boolean;
}) {
  if (
    isCompletedBenchmarkRunLike({
      status: args.status,
      executionErrorCount: args.executionErrorCount,
    }) &&
    !isBenchmarkMetricCovered(args.metric, args.packId)
  ) {
    return "N/A";
  }

  if (args.value == null) {
    return "--";
  }

  return args.withPercent === false
    ? args.value.toFixed(1)
    : `${args.value.toFixed(1)}%`;
}

export function isFullyScoredBenchmarkRunLike(run: BenchmarkRunLike) {
  if (
    !isCompletedBenchmarkRunLike({
      status: run.status,
      executionErrorCount: run.executionErrorCount,
    })
  ) {
    return false;
  }

  if (run.accuracyScore == null || run.tournamentScore == null) {
    return false;
  }

  if (
    isBenchmarkMetricCovered("safety", run.packId) &&
    run.safetyScore == null
  ) {
    return false;
  }

  if (
    isBenchmarkMetricCovered("biasEquity", run.packId) &&
    run.biasEquityScore == null
  ) {
    return false;
  }

  return true;
}
