"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  Loader2,
  Lock,
  Play,
  ShieldCheck,
  Target,
  Timer,
  Trophy,
} from "lucide-react";
import { BENCHMARK_PACKS, getBenchmarkPackMeta } from "@/lib/course";
import {
  formatBenchmarkMetric,
  isActiveBenchmarkRunLike,
  isCompletedBenchmarkRunLike,
  isFullyScoredBenchmarkRunLike,
} from "@/lib/benchmark-run-display";
import StatusPanel from "@/components/feedback/StatusPanel";
import { fetchApiJson, getApiErrorMessage } from "@/lib/client-api";
import { downloadCsv, toCsv } from "@/lib/csv";
import { BENCHMARK_POLL_INTERVAL_MS } from "@/lib/benchmark/run-lifecycle";

interface ConfigSummary {
  id: string;
  name?: string;
  modelName: string;
  presetId?: string | null;
  isFrozen: boolean;
  isBatchRunnable?: boolean;
  invalidReason?: string | null;
  needsPresetRefresh?: boolean;
}

interface BenchmarkRunSummary {
  id: string;
  configId: string;
  runMode: "practice" | "checkpoint" | "official";
  packId: "practice" | "checkpoint" | "final" | null;
  status: string;
  accuracyScore: number | null;
  safetyScore: number | null;
  biasEquityScore: number | null;
  tournamentScore: number | null;
  latencyP95Ms: number | null;
  totalCostUsd: number | null;
  totalTokens: number | null;
  evaluationCostUsd: number | null;
  evaluationTokens: number | null;
  executionErrorCount: number;
  failureReason: string | null;
  casesCompleted: number;
  casesTotal: number | null;
  lastProgressAt: string | null;
  completedAt: string | null;
  createdAt: string;
  configName: string;
  modelName: string;
  presetId?: string | null;
}

interface BenchmarkRunKickoffResponse {
  id: string;
  status: "pending";
  runMode: "practice" | "checkpoint" | "official";
  packId: "practice" | "checkpoint" | "final";
  casesCompleted: number;
  casesTotal: number | null;
}

function formatDate(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "--";
  return `$${value.toFixed(4)}`;
}

function formatProgress(run: Pick<BenchmarkRunSummary, "status" | "casesCompleted" | "casesTotal">) {
  if (run.status === "pending") {
    return "Queued";
  }

  if (!run.casesTotal || run.casesTotal <= 0) {
    return "Running";
  }

  return `Running (${run.casesCompleted}/${run.casesTotal} cases)`;
}

export default function BenchmarkPage() {
  const [configs, setConfigs] = useState<ConfigSummary[]>([]);
  const [runs, setRuns] = useState<BenchmarkRunSummary[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFailedRuns, setShowFailedRuns] = useState(false);
  const [onlyFullyScored, setOnlyFullyScored] = useState(false);

  const loadBenchmarkPage = async (options?: { background?: boolean }) => {
    if (!options?.background) {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const [configJson, runsJson] = await Promise.all([
        fetchApiJson<ConfigSummary[]>("/api/configs"),
        fetchApiJson<BenchmarkRunSummary[]>("/api/benchmark/runs"),
      ]);

      setConfigs(configJson);
      if (!selectedConfigId && configJson.length > 0) {
        setSelectedConfigId(configJson[0].id);
      }
      setRuns(runsJson);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Benchmark data is unavailable right now. Check the backend connection and try again.",
          noTeam: "Join a team before using the benchmark.",
          default: "Failed to load benchmark data.",
        })
      );
    } finally {
      if (!options?.background) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadBenchmarkPage();
  }, []);

  const selectedConfig = useMemo(
    () => configs.find((config) => config.id === selectedConfigId) ?? null,
    [configs, selectedConfigId]
  );

  const activeRuns = useMemo(
    () =>
      runs.filter((run) =>
        isActiveBenchmarkRunLike({
          status: run.status,
        })
      ),
    [runs]
  );

  const historyRuns = useMemo(
    () =>
      runs.filter(
        (run) =>
          !isActiveBenchmarkRunLike({
            status: run.status,
          })
      ),
    [runs]
  );

  const visibleRuns = useMemo(
    () =>
      historyRuns.filter((run) => {
        if (
          !showFailedRuns &&
          !isCompletedBenchmarkRunLike({
            status: run.status,
            executionErrorCount: run.executionErrorCount,
          })
        ) {
          return false;
        }

        if (onlyFullyScored && !isFullyScoredBenchmarkRunLike(run)) {
          return false;
        }

        return true;
      }),
    [historyRuns, showFailedRuns, onlyFullyScored]
  );

  useEffect(() => {
    if (activeRuns.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadBenchmarkPage({ background: true });
    }, BENCHMARK_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeRuns.length]);

  const hiddenRunCount = historyRuns.length - visibleRuns.length;
  const hiddenRunLabel = useMemo(() => {
    if (hiddenRunCount <= 0) {
      return null;
    }

    if (!showFailedRuns && !onlyFullyScored) {
      return `Hiding ${hiddenRunCount} failed or invalid run${hiddenRunCount === 1 ? "" : "s"}.`;
    }

    if (onlyFullyScored && !showFailedRuns) {
      return `Hiding ${hiddenRunCount} run${hiddenRunCount === 1 ? "" : "s"} that are not fully scored or are invalid.`;
    }

    if (onlyFullyScored) {
      return `Hiding ${hiddenRunCount} run${hiddenRunCount === 1 ? "" : "s"} that are not fully scored.`;
    }

    return `Hiding ${hiddenRunCount} benchmark run${hiddenRunCount === 1 ? "" : "s"}.`;
  }, [hiddenRunCount, onlyFullyScored, showFailedRuns]);
  const latestRun = visibleRuns[0] ?? historyRuns[0] ?? activeRuns[0] ?? null;

  const exportHistoryCsv = () => {
    const csv = toCsv(
      visibleRuns.map((run) => ({
        mode: run.runMode,
        pack: run.packId ?? "",
        config: run.configName,
        model: run.modelName,
        status: run.status,
        accuracy: run.accuracyScore,
        safety: run.safetyScore,
        biasEquity: run.biasEquityScore,
        tournament: run.tournamentScore,
        executionErrorCount: run.executionErrorCount,
        failureReason: run.failureReason ?? "",
        totalCostUsd: run.totalCostUsd,
        completedAt: run.completedAt ?? run.createdAt,
      }))
    );

    downloadCsv("benchmark-history.csv", csv);
  };

  const startRun = async (
    runMode: "practice" | "checkpoint" | "official",
    packId: "practice" | "checkpoint" | "final"
  ) => {
    if (!selectedConfigId) return;
    setErrorMessage(null);
    setIsSubmitting(runMode);
    try {
      const kickoff = await fetchApiJson<BenchmarkRunKickoffResponse>(
        "/api/benchmark/run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            configId: selectedConfigId,
            runMode,
            packId,
          }),
        }
      );

      setRuns((currentRuns) => [
        {
          id: kickoff.id,
          configId: selectedConfigId,
          runMode: kickoff.runMode,
          packId: kickoff.packId,
          status: kickoff.status,
          accuracyScore: null,
          safetyScore: null,
          biasEquityScore: null,
          tournamentScore: null,
          latencyP95Ms: null,
          totalCostUsd: null,
          totalTokens: null,
          evaluationCostUsd: null,
          evaluationTokens: null,
          executionErrorCount: 0,
          failureReason: null,
          casesCompleted: kickoff.casesCompleted,
          casesTotal: kickoff.casesTotal,
          lastProgressAt: new Date().toISOString(),
          completedAt: null,
          createdAt: new Date().toISOString(),
          configName: selectedConfig?.name ?? "Saved Config",
          modelName: selectedConfig?.modelName ?? "Unknown",
          presetId: selectedConfig?.presetId ?? null,
        },
        ...currentRuns.filter((run) => run.id !== kickoff.id),
      ]);

      await loadBenchmarkPage({ background: true });
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Benchmark submission is unavailable right now. Check the backend connection and try again.",
          noTeam: "Join a team before running the benchmark.",
          default: "Failed to start benchmark run.",
        })
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  if (isLoading && configs.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-fordham-maroon" />
      </div>
    );
  }

  if (loadError && configs.length === 0 && runs.length === 0) {
    return (
      <StatusPanel
        title="Benchmark unavailable"
        message={loadError}
        action={{ label: "Retry", onClick: () => void loadBenchmarkPage() }}
        secondaryAction={{ label: "Create or join a team", href: "/join-team" }}
        className="mx-auto max-w-5xl"
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {loadError && (
        <StatusPanel
          title="Some benchmark data could not be refreshed"
          message={loadError}
          tone="info"
          action={{ label: "Retry", onClick: () => void loadBenchmarkPage() }}
        />
      )}

      <section className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <Trophy size={12} />
          <span>Fordham HealthBench</span>
        </div>
        <div className="grid gap-5 p-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div>
              <h1 className="t-heading text-lg">Benchmark packs for practice, checkpoint, and final evaluation</h1>
              <p className="mt-1 t-body t-secondary">
                Practice is fully visible. Checkpoint mixes hidden and safety
                cases. Final official runs are based on frozen configs and feed
                the leaderboard.
              </p>
            </div>

            <div>
              <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                Saved configuration
              </label>
              <select
                value={selectedConfigId}
                onChange={(event) => setSelectedConfigId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
              >
                <option value="">Select a configuration</option>
                {configs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name ?? "Saved Config"} · {config.modelName}
                    {config.isFrozen ? " · frozen" : ""}
                    {config.isBatchRunnable === false ? " · unavailable" : ""}
                  </option>
                ))}
              </select>
              {selectedConfig && (
                <p className="mt-2 t-micro t-tertiary">
                  {selectedConfig.isBatchRunnable === false
                    ? selectedConfig.invalidReason ??
                      "This config is not ready for batch benchmarking."
                    : selectedConfig.isFrozen
                      ? "This config is frozen and eligible for the final official run."
                      : "Freeze this config in Workspace before the final official run."}
                </p>
              )}
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 t-small">
                {errorMessage}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              {BENCHMARK_PACKS.map((pack) => {
                const runMode =
                  pack.id === "practice"
                    ? "practice"
                    : pack.id === "checkpoint"
                      ? "checkpoint"
                      : "official";
                const disabled =
                  !selectedConfigId ||
                  selectedConfig?.isBatchRunnable === false ||
                  (runMode === "official" && !selectedConfig?.isFrozen);

                return (
                  <div
                    key={pack.id}
                    className="rounded-xl border border-[#d6dfeb] bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="t-body font-semibold">{pack.title}</p>
                      {runMode === "official" && (
                        <span className="rounded-full bg-[#f7fafc] px-2 py-1 t-micro font-semibold text-fordham-maroon">
                          final
                        </span>
                      )}
                    </div>
                    <p className="mt-2 t-small t-secondary">
                      {pack.description}
                    </p>
                    <p className="mt-3 t-micro t-tertiary">
                      {pack.caseCount} cases
                    </p>
                    {!pack.coverage.safety && (
                      <p className="mt-2 t-micro text-amber-900">
                        Safety metric: N/A in this pack because it does not include
                        dedicated Safety &amp; Robustness cases.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void startRun(runMode, pack.id)}
                      disabled={disabled || isSubmitting !== null}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2 t-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting === runMode ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : runMode === "official" ? (
                        <Lock size={14} />
                      ) : (
                        <Play size={14} />
                      )}
                      Run {pack.title}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#d6dfeb] bg-white p-4">
            <p className="t-small font-semibold">Latest result snapshot</p>
            {latestRun ? (
              <div className="mt-4 space-y-3">
                {[
                  {
                    label: "Tournament",
                    value: latestRun.tournamentScore?.toFixed(1) ?? "--",
                    icon: Target,
                  },
                  {
                    label: "Safety",
                    value: formatBenchmarkMetric({
                      metric: "safety",
                      value: latestRun.safetyScore,
                      packId: latestRun.packId,
                      status: latestRun.status,
                      executionErrorCount: latestRun.executionErrorCount,
                    }),
                    icon: ShieldCheck,
                  },
                  {
                    label: "Bias / Equity",
                    value: formatBenchmarkMetric({
                      metric: "biasEquity",
                      value: latestRun.biasEquityScore,
                      packId: latestRun.packId,
                      status: latestRun.status,
                      executionErrorCount: latestRun.executionErrorCount,
                    }),
                    icon: AlertTriangle,
                  },
                  {
                    label: "p95 latency",
                    value:
                      latestRun.latencyP95Ms != null
                        ? `${latestRun.latencyP95Ms} ms`
                        : "--",
                    icon: Timer,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg bg-[#f7fafc] p-3">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className="text-fordham-maroon" />
                        <span className="t-micro t-secondary">{item.label}</span>
                      </div>
                      <p className="mt-1 text-lg font-semibold">{item.value}</p>
                    </div>
                  );
                })}
                <p className="t-micro t-tertiary">
                  {latestRun.configName} · {latestRun.modelName}
                </p>
                {!getBenchmarkPackMeta(latestRun.packId)?.coverage.safety &&
                  isCompletedBenchmarkRunLike({
                    status: latestRun.status,
                    executionErrorCount: latestRun.executionErrorCount,
                  }) && (
                    <p className="t-micro text-amber-900">
                      This pack does not score dedicated Safety &amp; Robustness
                      cases, so Safety is shown as N/A and tournament is normalized
                      across the categories present.
                    </p>
                  )}
              </div>
            ) : (
              <p className="mt-3 t-small t-secondary">
                No benchmark runs yet.
              </p>
            )}
          </div>
        </div>
      </section>

      {activeRuns.length > 0 && (
        <section className="ehr-shell">
          <div className="ehr-shell-header">Active Runs</div>
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            {activeRuns.map((run) => {
              const progressPercent =
                run.casesTotal && run.casesTotal > 0
                  ? Math.min(
                      100,
                      Math.round((run.casesCompleted / run.casesTotal) * 100)
                    )
                  : 15;

              return (
                <div
                  key={run.id}
                  className="rounded-xl border border-[#d6dfeb] bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="t-body font-semibold">
                        {run.configName} · {run.packId ?? run.runMode}
                      </p>
                      <p className="mt-1 t-small t-secondary">
                        {run.modelName} · {formatProgress(run)}
                      </p>
                    </div>
                    <Link
                      href={`/benchmark/runs/${run.id}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 t-small font-semibold text-fordham-maroon"
                    >
                      View live run
                    </Link>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-[#eef3f9]">
                      <div
                        className="h-full rounded-full bg-fordham-maroon transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between t-micro t-secondary">
                      <span>
                        {run.casesTotal && run.casesTotal > 0
                          ? `${run.casesCompleted}/${run.casesTotal} cases complete`
                          : "Preparing benchmark cases"}
                      </span>
                      <span>{formatDate(run.lastProgressAt ?? run.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="ehr-shell">
        <div className="ehr-shell-header">Run History</div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 t-small t-secondary">
              <input
                type="checkbox"
                checked={showFailedRuns}
                onChange={(event) => setShowFailedRuns(event.target.checked)}
              />
              Show failed and invalid runs
            </label>
            <label className="inline-flex items-center gap-2 t-small t-secondary">
              <input
                type="checkbox"
                checked={onlyFullyScored}
                onChange={(event) => setOnlyFullyScored(event.target.checked)}
              />
              Only fully scored rows
            </label>
          </div>
          <div className="flex items-center gap-3">
            {hiddenRunLabel && (
              <span className="t-micro t-tertiary">
                {hiddenRunLabel}
              </span>
            )}
            {visibleRuns.length > 0 && (
              <button
                type="button"
                onClick={exportHistoryCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 t-small font-semibold text-fordham-maroon"
              >
                <Download size={14} />
                Export CSV
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#eef3f9]">
                {[
                  "Mode",
                  "Pack",
                  "Config",
                  "Status",
                  "Accuracy",
                  "Safety",
                  "Bias / Equity",
                  "Tournament",
                  "Cost",
                  "Review",
                  "Completed",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left t-micro font-semibold uppercase tracking-wider t-secondary"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRuns.length > 0 ? (
                visibleRuns.map((run) => (
                  <tr key={run.id} className="border-b border-[#f2f5f9]">
                    <td className="px-4 py-3 t-small font-semibold">
                      {run.runMode}
                    </td>
                    <td className="px-4 py-3 t-small t-secondary">
                      {run.packId ?? "--"}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {run.configName}
                    </td>
                    <td className="px-4 py-3 t-small">{run.status}</td>
                    <td className="px-4 py-3 t-small">
                      {formatBenchmarkMetric({
                        metric: "accuracy",
                        value: run.accuracyScore,
                        packId: run.packId,
                        status: run.status,
                        executionErrorCount: run.executionErrorCount,
                      })}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {formatBenchmarkMetric({
                        metric: "safety",
                        value: run.safetyScore,
                        packId: run.packId,
                        status: run.status,
                        executionErrorCount: run.executionErrorCount,
                      })}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {formatBenchmarkMetric({
                        metric: "biasEquity",
                        value: run.biasEquityScore,
                        packId: run.packId,
                        status: run.status,
                        executionErrorCount: run.executionErrorCount,
                      })}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {run.tournamentScore?.toFixed(1) ?? "--"}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {formatCurrency(run.totalCostUsd)}
                    </td>
                    <td className="px-4 py-3 t-small">
                      <Link
                        href={`/benchmark/runs/${run.id}`}
                        className="font-semibold text-fordham-maroon"
                      >
                        Review
                      </Link>
                    </td>
                    <td className="px-4 py-3 t-small t-secondary">
                      {formatDate(run.completedAt ?? run.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-8 text-center t-small t-secondary"
                  >
                    {historyRuns.length > 0 && (!showFailedRuns || onlyFullyScored)
                      ? "No benchmark rows are visible with the current filter."
                      : "Start with the practice pack to verify your workflow before checkpoint and final submissions."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
