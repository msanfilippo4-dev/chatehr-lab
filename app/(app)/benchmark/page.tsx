"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Lock,
  Play,
  ShieldCheck,
  Target,
  Timer,
  Trophy,
} from "lucide-react";
import { BENCHMARK_PACKS } from "@/lib/course";

interface ConfigSummary {
  id: string;
  name?: string;
  modelName: string;
  isFrozen: boolean;
}

interface BenchmarkRunSummary {
  id: string;
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
  completedAt: string | null;
  createdAt: string;
  configName: string;
  modelName: string;
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

function formatPercent(value: number | null | undefined) {
  if (value == null) return "--";
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "--";
  return `$${value.toFixed(4)}`;
}

export default function BenchmarkPage() {
  const [configs, setConfigs] = useState<ConfigSummary[]>([]);
  const [runs, setRuns] = useState<BenchmarkRunSummary[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBenchmarkPage = async () => {
    setIsLoading(true);
    try {
      const [configRes, runsRes] = await Promise.all([
        fetch("/api/configs"),
        fetch("/api/benchmark/runs"),
      ]);
      const configJson = await configRes.json();
      const runsJson = await runsRes.json();

      if (configRes.ok) {
        setConfigs(configJson);
        if (!selectedConfigId && configJson.length > 0) {
          setSelectedConfigId(configJson[0].id);
        }
      }
      if (runsRes.ok) setRuns(runsJson);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBenchmarkPage();
  }, []);

  const selectedConfig = useMemo(
    () => configs.find((config) => config.id === selectedConfigId) ?? null,
    [configs, selectedConfigId]
  );

  const latestRun = runs[0] ?? null;

  const startRun = async (
    runMode: "practice" | "checkpoint" | "official",
    packId: "practice" | "checkpoint" | "final"
  ) => {
    if (!selectedConfigId) return;
    setErrorMessage(null);
    setIsSubmitting(runMode);
    try {
      const res = await fetch("/api/benchmark/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configId: selectedConfigId,
          runMode,
          packId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMessage(json.error ?? "Failed to start benchmark run.");
        return;
      }
      await loadBenchmarkPage();
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
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
                  </option>
                ))}
              </select>
              {selectedConfig && (
                <p className="mt-2 t-micro t-tertiary">
                  {selectedConfig.isFrozen
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
                    value: formatPercent(latestRun.safetyScore),
                    icon: ShieldCheck,
                  },
                  {
                    label: "Bias / Equity",
                    value: formatPercent(latestRun.biasEquityScore),
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
              </div>
            ) : (
              <p className="mt-3 t-small t-secondary">
                No benchmark runs yet.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="ehr-shell">
        <div className="ehr-shell-header">Run History</div>
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
              {runs.length > 0 ? (
                runs.map((run) => (
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
                      {formatPercent(run.accuracyScore)}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {formatPercent(run.safetyScore)}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {formatPercent(run.biasEquityScore)}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {run.tournamentScore?.toFixed(1) ?? "--"}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {formatCurrency(run.totalCostUsd)}
                    </td>
                    <td className="px-4 py-3 t-small t-secondary">
                      {formatDate(run.completedAt ?? run.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center t-small t-secondary"
                  >
                    Start with the practice pack to verify your workflow before
                    checkpoint and final submissions.
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
