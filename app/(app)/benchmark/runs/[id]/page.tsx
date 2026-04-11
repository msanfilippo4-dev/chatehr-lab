"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Coins,
  Download,
  ExternalLink,
  Loader2,
  ShieldAlert,
  Target,
} from "lucide-react";
import { getBenchmarkPackMeta } from "@/lib/course";
import {
  formatBenchmarkMetric,
  isActiveBenchmarkRunLike,
} from "@/lib/benchmark-run-display";
import { downloadCsv, toCsv } from "@/lib/csv";
import { fetchApiJson, getApiErrorMessage } from "@/lib/client-api";
import { BENCHMARK_POLL_INTERVAL_MS } from "@/lib/benchmark/run-lifecycle";

interface RunDetail {
  id: string;
  teamName: string;
  runMode: string;
  packId: string | null;
  status: string;
  executionErrorCount?: number;
  failureReason?: string | null;
  accuracyScore: number | null;
  safetyScore: number | null;
  biasEquityScore: number | null;
  tournamentScore: number | null;
  totalCostUsd: number | null;
  totalTokens: number | null;
  evaluationCostUsd: number | null;
  evaluationTokens: number | null;
  casesCompleted: number;
  casesTotal: number | null;
  lastProgressAt: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt: string | null;
  config: {
    id: string;
    name: string;
    modelName: string;
    modelProvider: string;
    presetId: string | null;
    temperature: number | null;
    contextLevel: string | null;
    ragEnabled: boolean | null;
    responseFormat: string | null;
  } | null;
  results: Array<{
    id: string;
    caseId: string;
    category: string;
    title: string;
    difficulty: string;
    caseSet: string;
    packId: string;
    phase: string;
    description?: string;
    deterministicScore: number | null;
    rubricScore: number | null;
    judgeScore: number | null;
    finalScore: number | null;
    maxScore: number;
    modelResponse?: string;
    prompt?: string;
    learningObjective?: string | null;
    evidenceChecklist?: string[];
    fairnessDimension?: string | null;
    recommendedComparison?: string | null;
    suggestedMissionId?: string | null;
    suggestedMissionTitle?: string | null;
    suggestedMissionPath?: string | null;
    studentFeedback?: string | null;
    strengths?: string[];
    missingEvidence?: string[];
    unsupportedClaims?: string[];
    safetyConcerns?: string[];
    biasEquityConcerns?: string[];
    likelyFailureCause?: string | null;
    recommendedSettingChange?: string | null;
    isHallucination: boolean;
    isFlagged: boolean;
    executionError?: {
      code?: string;
      message?: string;
      transient?: boolean;
      provider?: string;
      modelName?: string;
    } | null;
  }>;
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "--";
  return `$${value.toFixed(4)}`;
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

function categoryLabel(value: string) {
  return value.replace(/_/g, " ");
}

function executionFailureLabel(
  executionError: RunDetail["results"][number]["executionError"]
) {
  if (!executionError) {
    return "Execution failed";
  }

  const parts = [
    executionError.provider,
    executionError.modelName,
    executionError.code,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Execution failed";
}

function formatRunProgress(run: Pick<RunDetail, "status" | "casesCompleted" | "casesTotal">) {
  if (run.status === "pending") {
    return "Queued";
  }

  if (!run.casesTotal || run.casesTotal <= 0) {
    return "Running";
  }

  return `Running (${run.casesCompleted}/${run.casesTotal} cases)`;
}

export default function BenchmarkRunReviewPage() {
  const params = useParams<{ id: string }>();
  const runId = typeof params?.id === "string" ? params.id : "";
  const [run, setRun] = useState<RunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRun = async (options?: { background?: boolean }) => {
    if (!runId) {
      setIsLoading(false);
      setErrorMessage("Run id is missing.");
      return;
    }

    if (!options?.background) {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const json = await fetchApiJson<RunDetail>(`/api/benchmark/runs/${runId}`);
      setRun(json);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Benchmark run details are unavailable right now. Check the backend connection and try again.",
          default: "Failed to load benchmark run.",
        })
      );
    } finally {
      if (!options?.background) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!runId) {
      return;
    }
    void loadRun();
  }, [runId]);

  useEffect(() => {
    if (
      !run ||
      !isActiveBenchmarkRunLike({
        status: run.status,
      })
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadRun({ background: true });
    }, BENCHMARK_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [run?.id, run?.status]);

  const executionFailures = useMemo(
    () => (run?.results ?? []).filter((result) => Boolean(result.executionError)),
    [run?.results]
  );

  const sortedResults = useMemo(() => {
    return [...(run?.results ?? [])]
      .filter((result) => !result.executionError)
      .sort((a, b) => {
      const aRatio = (a.finalScore ?? 0) / Math.max(a.maxScore, 1);
      const bRatio = (b.finalScore ?? 0) / Math.max(b.maxScore, 1);
      return aRatio - bRatio;
      });
  }, [run?.results]);

  const exportVisibleCsv = () => {
    const csv = toCsv(
      sortedResults.map((result) => ({
        category: result.category,
        title: result.title,
        difficulty: result.difficulty,
        caseSet: result.caseSet,
        finalScore: result.finalScore,
        maxScore: result.maxScore,
        deterministicScore: result.deterministicScore,
        judgeScore: result.judgeScore,
        hallucination: result.isHallucination,
        flagged: result.isFlagged,
        likelyFailureCause: result.likelyFailureCause ?? "",
        recommendedSettingChange: result.recommendedSettingChange ?? "",
      }))
    );

    downloadCsv(`benchmark-run-${runId}.csv`, csv);
  };

  if (isLoading && !run) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-fordham-maroon" />
      </div>
    );
  }

  if (errorMessage || !run) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="ehr-shell p-6 text-center">
          <ShieldAlert size={28} className="mx-auto text-fordham-maroon" />
          <h1 className="mt-3 t-heading text-lg">Run review unavailable</h1>
          <p className="mt-2 t-body t-secondary">
            {errorMessage ?? "This run could not be loaded."}
          </p>
          <Link
            href="/benchmark"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2 t-small font-semibold text-white"
          >
            <ArrowLeft size={14} />
            Back to benchmark
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="ehr-shell p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/benchmark"
              className="inline-flex items-center gap-2 t-small font-semibold text-fordham-maroon"
            >
              <ArrowLeft size={14} />
              Back to benchmark
            </Link>
            <h1 className="mt-3 t-heading text-xl">
              Case-by-case review for {run.teamName}
            </h1>
            <p className="mt-2 t-body t-secondary">
              Use the weakest cases first. This is where you connect score
              differences to missing chart evidence, unsafe claims, and the next
              configuration change to try.
            </p>
          </div>

          <div className="rounded-xl border border-[#d6dfeb] bg-white p-4">
            <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
              Config under test
            </p>
            <p className="mt-2 t-body font-semibold">
              {run.config?.name ?? "Saved Config"}
            </p>
            <p className="mt-1 t-small t-secondary">
              {run.config?.modelName ?? "Unknown"} · temp{" "}
              {run.config?.temperature ?? "--"} · {run.config?.contextLevel ?? "--"}
              {run.config?.ragEnabled ? " · RAG" : " · no RAG"}
            </p>
            {run.config?.presetId && (
              <p className="mt-1 t-micro t-tertiary">
                Preset: {run.config.presetId}
              </p>
            )}
          </div>
        </div>
      </section>

      {isActiveBenchmarkRunLike({ status: run.status }) && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="t-small font-semibold text-blue-900">
                {formatRunProgress(run)}
              </p>
              <p className="mt-1 t-small text-blue-800">
                This page refreshes automatically while the benchmark is in progress.
                Partial case results will appear below as they are written.
              </p>
            </div>
            <div className="min-w-[220px] flex-1 max-w-sm space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-white/80">
                <div
                  className="h-full rounded-full bg-fordham-maroon transition-all"
                  style={{
                    width: `${
                      run.casesTotal && run.casesTotal > 0
                        ? Math.min(
                            100,
                            Math.round((run.casesCompleted / run.casesTotal) * 100)
                          )
                        : 15
                    }%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between t-micro text-blue-900">
                <span>
                  {run.casesTotal && run.casesTotal > 0
                    ? `${run.casesCompleted}/${run.casesTotal} cases complete`
                    : "Preparing benchmark cases"}
                </span>
                <span>{formatDate(run.lastProgressAt ?? run.startedAt ?? run.createdAt)}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-5">
        {[
          {
            label: "Tournament",
            value: run.tournamentScore?.toFixed(1) ?? "--",
            icon: Target,
          },
          {
            label: "Accuracy",
            value: formatBenchmarkMetric({
              metric: "accuracy",
              value: run.accuracyScore,
              packId: run.packId,
              status: run.status,
              executionErrorCount: run.executionErrorCount,
            }),
            icon: BookOpen,
          },
          {
            label: "Safety",
            value: formatBenchmarkMetric({
              metric: "safety",
              value: run.safetyScore,
              packId: run.packId,
              status: run.status,
              executionErrorCount: run.executionErrorCount,
            }),
            icon: ShieldAlert,
          },
          {
            label: "Bias / Equity",
            value: formatBenchmarkMetric({
              metric: "biasEquity",
              value: run.biasEquityScore,
              packId: run.packId,
              status: run.status,
              executionErrorCount: run.executionErrorCount,
            }),
            icon: AlertTriangle,
          },
          {
            label: "Eval cost",
            value: formatCurrency(run.evaluationCostUsd),
            icon: Coins,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="ehr-shell p-4">
              <div className="flex items-center justify-between">
                <span className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  {card.label}
                </span>
                <Icon size={14} className="text-fordham-maroon" />
              </div>
              <p className="mt-2 text-xl font-semibold">{card.value}</p>
            </div>
          );
        })}
      </section>

      {run.executionErrorCount && run.executionErrorCount > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="t-small font-semibold text-amber-900">
            This run was invalidated because {run.executionErrorCount} case
            {run.executionErrorCount === 1 ? "" : "s"} failed during model execution.
          </p>
          <p className="mt-1 t-small text-amber-800">
            Execution failures are separated below and this run should not be treated
            as a scored benchmark submission.
          </p>
        </section>
      )}

      <section className="ehr-shell p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                Run mode
              </p>
              <p className="mt-1 t-small">{run.runMode} · {run.packId ?? "--"}</p>
              {!getBenchmarkPackMeta(run.packId)?.coverage.safety &&
                run.status === "completed" &&
                (run.executionErrorCount ?? 0) === 0 && (
                  <p className="mt-1 t-micro text-amber-900">
                    Safety is N/A for this pack because it does not include dedicated
                    Safety &amp; Robustness cases.
                  </p>
                )}
            </div>
            <div>
              <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                Benchmark cost
              </p>
              <p className="mt-1 t-small">
                {formatCurrency(run.totalCostUsd)} · {run.totalTokens ?? 0} tokens
              </p>
            </div>
            <div>
              <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                Judge cost
              </p>
              <p className="mt-1 t-small">
                {formatCurrency(run.evaluationCostUsd)} · {run.evaluationTokens ?? 0} tokens
              </p>
            </div>
            <div>
              <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                {isActiveBenchmarkRunLike({ status: run.status })
                  ? "Last update"
                  : "Completed"}
              </p>
              <p className="mt-1 t-small">
                {formatDate(
                  isActiveBenchmarkRunLike({ status: run.status })
                    ? run.lastProgressAt ?? run.startedAt ?? run.createdAt
                    : run.completedAt ?? run.createdAt
                )}
              </p>
            </div>
          </div>
          {sortedResults.length > 0 && (
            <button
              type="button"
              onClick={exportVisibleCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 t-small font-semibold text-fordham-maroon"
            >
              <Download size={14} />
              Export CSV
            </button>
          )}
        </div>
      </section>

      <section className="space-y-4">
        {sortedResults.map((result) => (
          <article key={result.id} className="ehr-shell overflow-hidden">
            <div className="border-b border-[#eef3f9] bg-[#f8fbff] px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2 py-1 t-micro font-semibold text-fordham-maroon">
                      {categoryLabel(result.category)}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 t-micro t-secondary">
                      {result.difficulty}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 t-micro t-secondary">
                      {result.caseSet}
                    </span>
                  </div>
                  <h2 className="mt-3 t-heading text-lg">{result.title}</h2>
                  <p className="mt-1 t-small t-secondary">{result.description}</p>
                </div>
                <div className="rounded-xl border border-[#d6dfeb] bg-white px-4 py-3 text-right">
                  <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                    Final score
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {result.finalScore?.toFixed(1) ?? "0.0"} / {result.maxScore}
                  </p>
                  <p className="mt-1 t-micro t-tertiary">
                    Judge {result.judgeScore?.toFixed(1) ?? "--"} · Deterministic{" "}
                    {result.deterministicScore?.toFixed(1) ?? "--"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {result.prompt && (
                <div className="rounded-xl bg-[#fbfcfe] p-4">
                  <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                    Benchmark prompt
                  </p>
                  <p className="mt-2 whitespace-pre-wrap t-small t-secondary">
                    {result.prompt}
                  </p>
                </div>
              )}

              {result.modelResponse && (
                <div className="rounded-xl bg-[#fbfcfe] p-4">
                  <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                    Model response
                  </p>
                  <p className="mt-2 whitespace-pre-wrap t-small t-secondary">
                    {result.modelResponse}
                  </p>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  {result.learningObjective && (
                    <div className="rounded-xl border border-[#d6dfeb] bg-white p-4">
                      <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                        Learning objective
                      </p>
                      <p className="mt-2 t-small t-secondary">
                        {result.learningObjective}
                      </p>
                    </div>
                  )}

                  {result.studentFeedback && (
                    <div className="rounded-xl border border-[#d6dfeb] bg-white p-4">
                      <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                        Student feedback
                      </p>
                      <p className="mt-2 t-small t-secondary">
                        {result.studentFeedback}
                      </p>
                    </div>
                  )}

                  {result.likelyFailureCause && (
                    <div className="rounded-xl border border-[#d6dfeb] bg-white p-4">
                      <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                        Likely failure cause
                      </p>
                      <p className="mt-2 t-small t-secondary">
                        {result.likelyFailureCause}
                      </p>
                    </div>
                  )}

                  {result.recommendedSettingChange && (
                    <div className="rounded-xl border border-[#d6dfeb] bg-white p-4">
                      <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                        Recommended next config change
                      </p>
                      <p className="mt-2 t-small t-secondary">
                        {result.recommendedSettingChange}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {[
                    { label: "Evidence checklist", items: result.evidenceChecklist ?? [] },
                    { label: "Missing evidence", items: result.missingEvidence ?? [] },
                    { label: "Unsupported claims", items: result.unsupportedClaims ?? [] },
                    { label: "Safety concerns", items: result.safetyConcerns ?? [] },
                    { label: "Bias / equity concerns", items: result.biasEquityConcerns ?? [] },
                  ]
                    .filter((group) => group.items.length > 0)
                    .map((group) => (
                      <div
                        key={group.label}
                        className="rounded-xl border border-[#d6dfeb] bg-white p-4"
                      >
                        <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                          {group.label}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {group.items.map((item) => (
                            <li key={item} className="t-small t-secondary">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              </div>

              {(result.recommendedComparison || result.suggestedMissionPath) && (
                <div className="rounded-xl border border-fordham-maroon/20 bg-fordham-maroon/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="t-micro font-semibold uppercase tracking-wider text-fordham-maroon">
                        Suggested next experiment
                      </p>
                      {result.recommendedComparison && (
                        <p className="mt-2 t-small text-[#5b6676]">
                          {result.recommendedComparison}
                        </p>
                      )}
                    </div>
                    {result.suggestedMissionPath && result.suggestedMissionTitle && (
                      <Link
                        href={result.suggestedMissionPath}
                        className="inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-3 py-2 t-small font-semibold text-white"
                      >
                        Open {result.suggestedMissionTitle}
                        <ExternalLink size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}

        {executionFailures.length > 0 && (
          <div className="ehr-shell overflow-hidden">
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
              <h2 className="t-heading text-lg text-amber-950">
                Execution failures
              </h2>
              <p className="mt-1 t-small text-amber-900">
                These cases never produced a valid model output. They are listed
                separately so provider outages and unavailable models do not read
                as genuine zero scores.
              </p>
            </div>
            <div className="space-y-3 p-5">
              {executionFailures.map((result) => (
                <div
                  key={result.id}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-1 t-micro font-semibold text-amber-900">
                          {categoryLabel(result.category)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 t-micro text-amber-900">
                          {result.difficulty}
                        </span>
                      </div>
                      <p className="mt-3 t-body font-semibold text-amber-950">
                        {result.title}
                      </p>
                      <p className="mt-1 t-small text-amber-900">
                        {executionFailureLabel(result.executionError)}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 t-micro font-semibold uppercase tracking-wide text-amber-800">
                      Invalid run row
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap t-small text-amber-950">
                    {result.executionError?.message ??
                      "The provider did not return a usable result for this case."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {sortedResults.length === 0 && executionFailures.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#d6dfeb] p-6 text-center t-small t-secondary">
            No case-level benchmark results are available for this run yet.
          </div>
        )}
      </section>
    </div>
  );
}
