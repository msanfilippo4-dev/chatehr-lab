"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  Clock3,
  Coins,
  Download,
  Loader2,
  Play,
  RefreshCcw,
  Scale,
  Users,
} from "lucide-react";
import { GUIDED_MISSIONS, getGuidedMissionById } from "@/lib/course";
import { TEACHING_PRESETS } from "@/lib/constants";
import StatusPanel from "@/components/feedback/StatusPanel";
import {
  ApiClientError,
  fetchApiJson,
  getApiErrorMessage,
} from "@/lib/client-api";
import { downloadCsv, toCsv } from "@/lib/csv";

interface ConfigSummary {
  id: string;
  name?: string;
  modelName: string;
  modelProvider: string;
  temperature: number;
  contextLevel: string;
  ragEnabled: boolean;
  presetId?: string | null;
  isBatchRunnable?: boolean;
  invalidCode?: string | null;
  invalidReason?: string | null;
  needsPresetRefresh?: boolean;
}

interface CohortSummary {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  snapshotMetrics: Array<{ label: string; value: string }>;
  disparityIndicators: string[];
  tasks: Array<{
    id: string;
    title: string;
    prompt: string;
    successCriteria: string;
    contextMode?: string;
    accuracyMeasurement?: string;
  }>;
  sampleMembers: Array<{
    id: string;
    name: string;
    language?: string;
    insuranceType?: string;
    conditions: string[];
  }>;
}

interface PopulationRunHistoryItem {
  id: string;
  cohortId: string;
  cohortName: string;
  taskId: string;
  taskTitle: string;
  prompt: string;
  partialFailure?: boolean;
  completedSlotCount?: number;
  failedSlotCount?: number;
  slots: Array<{
    configId: string;
    configName: string;
    modelName: string;
    modelProvider: string;
    status?: "completed" | "failed";
    error?: {
      code: string;
      message: string;
      transient: boolean;
    };
    output: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    latencyMs: number;
    ragChunks: Array<{
      id: string;
      title: string;
      source?: string;
      score?: number;
    }>;
    groundTruthCheck?: {
      label: string;
      expectedCount: number;
      extractedCount: number;
      countDelta: number;
      countSource: string;
      matchedPatientNames: string[];
      missedPatientNames: string[];
      unexpectedPatientNames: string[];
      precision: number | null;
      recall: number | null;
      summary: string;
      note?: string;
    };
  }>;
  createdAt: string;
  persisted?: boolean;
}

interface StarterPresetSyncResponse {
  message?: string;
  createdCount?: number;
  repairedCount?: number;
  skippedCount?: number;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(4)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRate(value: number | null) {
  if (value === null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function summarizeSlotStatus(
  slots: PopulationRunHistoryItem["slots"] | undefined
) {
  const safeSlots = slots ?? [];
  const failed = safeSlots.filter(
    (slot) => slot.status === "failed" || Boolean(slot.error)
  ).length;
  return {
    total: safeSlots.length,
    failed,
    completed: safeSlots.length - failed,
  };
}

function isFailedSlot(
  slot: PopulationRunHistoryItem["slots"][number]
) {
  return slot.status === "failed" || Boolean(slot.error);
}

function PopulationHealthPageContent() {
  const searchParams = useSearchParams();
  const [configs, setConfigs] = useState<ConfigSummary[]>([]);
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [history, setHistory] = useState<PopulationRunHistoryItem[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedConfigIds, setSelectedConfigIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [missionId, setMissionId] = useState("");
  const [activeRun, setActiveRun] = useState<PopulationRunHistoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isCreatingPresets, setIsCreatingPresets] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const populationMissions = useMemo(
    () => GUIDED_MISSIONS.filter((mission) => mission.track === "population"),
    []
  );

  const loadPage = async (preferredRun: PopulationRunHistoryItem | null = null) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [configJson, cohortJson, historyJson] = await Promise.all([
        fetchApiJson<ConfigSummary[]>("/api/configs"),
        fetchApiJson<CohortSummary[]>("/api/population/cohorts"),
        fetchApiJson<PopulationRunHistoryItem[]>("/api/population/runs"),
      ]);
      setConfigs(configJson);
      setCohorts(cohortJson);
      setHistory(historyJson);
      setActiveRun(historyJson[0] ?? preferredRun ?? null);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Population-health data is unavailable right now. Check the backend connection and try again.",
          noTeam: "Join a team before using the population lab.",
          default: "Failed to load population-health data.",
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, []);

  const selectedCohort = useMemo(
    () => cohorts.find((cohort) => cohort.id === selectedCohortId) ?? null,
    [cohorts, selectedCohortId]
  );
  const selectedTask = useMemo(
    () => selectedCohort?.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedCohort, selectedTaskId]
  );
  const runnableConfigIds = useMemo(
    () =>
      new Set(
        configs
          .filter((config) => config.isBatchRunnable !== false)
          .map((config) => config.id)
      ),
    [configs]
  );
  const activeRunStatus = useMemo(
    () => summarizeSlotStatus(activeRun?.slots),
    [activeRun]
  );
  const activeCompletedSlots = useMemo(
    () => (activeRun?.slots ?? []).filter((slot) => !isFailedSlot(slot)),
    [activeRun]
  );
  const activeFailedSlots = useMemo(
    () => (activeRun?.slots ?? []).filter((slot) => isFailedSlot(slot)),
    [activeRun]
  );
  const hasSavedConfigs = configs.length > 0;

  useEffect(() => {
    setSelectedConfigIds((current) =>
      current.filter((configId) => runnableConfigIds.has(configId))
    );
  }, [runnableConfigIds]);

  const applyMission = (nextMissionId: string, nextConfigs = configs, nextCohorts = cohorts) => {
    const mission = getGuidedMissionById(nextMissionId);
    if (!mission || mission.track !== "population") return;
    const cohort = nextCohorts.find((item) => item.id === mission.recommendedCohortId);
    const task = cohort?.tasks[0] ?? null;

    setMissionId(mission.id);
    setSelectedCohortId(cohort?.id ?? "");
    setSelectedTaskId(task?.id ?? "");
    setPrompt(task?.prompt ?? mission.prompt);

    const recommendedConfigIds = nextConfigs
      .filter(
        (config) =>
          config.isBatchRunnable !== false &&
          config.presetId &&
          mission.recommendedPresetIds.some(
            (presetId) => presetId === config.presetId
          )
      )
      .slice(0, 3)
      .map((config) => config.id);

    if (recommendedConfigIds.length >= 2) {
      setSelectedConfigIds(recommendedConfigIds);
    }
  };

  useEffect(() => {
    const missionParam = searchParams.get("mission");
    if (!missionParam || configs.length === 0 || cohorts.length === 0) return;
    applyMission(missionParam, configs, cohorts);
  }, [cohorts, configs, searchParams]);

  const toggleConfig = (configId: string) => {
    if (!runnableConfigIds.has(configId)) {
      return;
    }

    setSelectedConfigIds((current) => {
      if (current.includes(configId)) {
        return current.filter((id) => id !== configId);
      }
      if (current.length >= 3) return current;
      return [...current, configId];
    });
  };

  const exportActiveRunCsv = () => {
    if (!activeRun || activeCompletedSlots.length === 0) {
      return;
    }

    const csv = toCsv(
      activeCompletedSlots.map((slot) => ({
        cohort: activeRun.cohortName,
        task: activeRun.taskTitle,
        config: slot.configName,
        model: slot.modelName,
        provider: slot.modelProvider,
        latencyMs: slot.latencyMs,
        totalTokens: slot.totalTokens,
        estimatedCost: slot.estimatedCost,
        ragChunks: slot.ragChunks.length,
        groundTruthLabel: slot.groundTruthCheck?.label ?? "",
        expectedCount: slot.groundTruthCheck?.expectedCount ?? "",
        extractedCount: slot.groundTruthCheck?.extractedCount ?? "",
        precision: slot.groundTruthCheck?.precision ?? "",
        recall: slot.groundTruthCheck?.recall ?? "",
        summary: slot.groundTruthCheck?.summary ?? "",
        output: slot.output,
      }))
    );

    downloadCsv(`population-run-${activeRun.id}.csv`, csv);
  };

  const syncStarterPresets = async () => {
    setIsCreatingPresets(true);
    setMessage(null);
    try {
      const json = await fetchApiJson<StarterPresetSyncResponse>(
        "/api/configs/presets",
        { method: "POST" }
      );
      setMessage(json.message ?? "Starter presets synced.");
      await loadPage();
    } catch (error) {
      setMessage(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Starter presets could not be created because the backend is unavailable.",
          noTeam: "Join a team before creating starter presets.",
          default: "Failed to create starter presets.",
        })
      );
    } finally {
      setIsCreatingPresets(false);
    }
  };

  const runPopulationComparison = async () => {
    if (!selectedCohortId || !selectedTaskId || selectedConfigIds.length < 2) {
      return;
    }

    setIsRunning(true);
    setMessage(null);
    try {
      const json = await fetchApiJson<PopulationRunHistoryItem>(
        "/api/population/run",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: selectedCohortId,
          taskId: selectedTaskId,
          configIds: selectedConfigIds,
          prompt,
        }),
        }
      );
      setActiveRun(json);
      await loadPage(json);
    } catch (error) {
      setMessage(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Population comparisons are unavailable right now. Check the backend connection and try again.",
          noTeam: "Join a team before running population comparisons.",
          default: "Failed to run population comparison.",
        })
      );
      if (error instanceof ApiClientError && error.status === 502) {
        await loadPage();
      }
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading && cohorts.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-fordham-maroon" />
      </div>
    );
  }

  if (loadError && configs.length === 0 && cohorts.length === 0) {
    return (
      <StatusPanel
        title="Population lab unavailable"
        message={loadError}
        action={{ label: "Retry", onClick: () => void loadPage() }}
        secondaryAction={{ label: "Create or join a team", href: "/join-team" }}
        className="mx-auto max-w-5xl"
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {loadError && (
        <StatusPanel
          title="Some population-health data could not be refreshed"
          message={loadError}
          tone="info"
          action={{ label: "Retry", onClick: () => void loadPage() }}
        />
      )}

      {activeRun && activeRunStatus.failed > 0 && (
        <StatusPanel
          title={
            activeRunStatus.completed > 0
              ? "Population comparison completed with partial failures"
              : "Population comparison failed"
          }
          message={
            activeRunStatus.completed > 0
              ? `${activeRunStatus.completed} of ${activeRunStatus.total} configs completed; ${activeRunStatus.failed} failed. Successful outputs are still available below.`
              : `All ${activeRunStatus.total} selected configs failed. Review the provider and model errors below before retrying.`
          }
          tone={activeRunStatus.completed > 0 ? "info" : "error"}
        />
      )}

      <section className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <Users size={12} />
          <span>Population Health Lab</span>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <h1 className="t-heading text-lg">
              Cohort-level tasks for outreach, care gaps, and risk stratification
            </h1>
            <p className="mt-1 t-body t-secondary">
              Use these cohorts to see what changes when AI moves from one chart
              to a population workflow where fairness and operational design
              matter.
            </p>
            <p className="mt-2 t-small t-secondary">
              If you want to compare behavior on a single chart instead, use{" "}
              <Link
                href="/experiments"
                className="font-semibold text-fordham-maroon underline decoration-fordham-maroon/40 underline-offset-2"
              >
                Experiments
              </Link>
              .
            </p>
          </div>
          {hasSavedConfigs && (
            <button
              type="button"
              onClick={() => void syncStarterPresets()}
              disabled={isCreatingPresets}
              className="inline-flex items-center gap-2 self-start rounded-lg border border-[#d6dfeb] bg-white px-4 py-2 t-small font-semibold text-fordham-maroon disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreatingPresets ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCcw size={14} />
              )}
              Refresh starter presets
            </button>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            {populationMissions.map((mission) => (
              <button
                key={mission.id}
                type="button"
                onClick={() => applyMission(mission.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  missionId === mission.id
                    ? "border-fordham-maroon bg-fordham-maroon/5"
                    : "border-[#d6dfeb] bg-white hover:bg-[#f8fbff]"
                }`}
              >
                <p className="t-body font-semibold">{mission.title}</p>
                <p className="mt-1 t-small t-secondary">{mission.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {mission.recommendedPresetIds.map((presetId) => (
                    <span
                      key={presetId}
                      className="rounded-full border border-[#d6dfeb] bg-white px-2 py-1 t-micro t-secondary"
                    >
                      {TEACHING_PRESETS.find((item) => item.id === presetId)?.title ??
                        presetId}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="ehr-shell p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Cohort
                </label>
                <select
                  value={selectedCohortId}
                  onChange={(event) => {
                    const nextCohortId = event.target.value;
                    const nextCohort = cohorts.find((cohort) => cohort.id === nextCohortId);
                    const nextTask = nextCohort?.tasks[0] ?? null;
                    setSelectedCohortId(nextCohortId);
                    setSelectedTaskId(nextTask?.id ?? "");
                    setPrompt(nextTask?.prompt ?? "");
                  }}
                  className="mt-1 w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                >
                  <option value="">Select a cohort</option>
                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Task
                </label>
                <select
                  value={selectedTaskId}
                  onChange={(event) => {
                    const nextTaskId = event.target.value;
                    const nextTask = selectedCohort?.tasks.find((task) => task.id === nextTaskId);
                    setSelectedTaskId(nextTaskId);
                    setPrompt(nextTask?.prompt ?? "");
                  }}
                  className="mt-1 w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                >
                  <option value="">Select a task</option>
                  {(selectedCohort?.tasks ?? []).map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-1 min-h-[120px] w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
              />
            </div>

            {message && (
              <div className="mt-4 rounded-xl border border-[#d6dfeb] bg-[#f8fbff] p-3 t-small text-[#506680]">
                {message}
              </div>
            )}

            {selectedCohort && (
              <div className="mt-4 rounded-xl border border-[#d6dfeb] bg-white p-4">
                <p className="t-body font-semibold">{selectedCohort.title}</p>
                <p className="mt-1 t-small t-secondary">{selectedCohort.summary}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                      Snapshot metrics
                    </p>
                    <div className="mt-2 space-y-2">
                      {selectedCohort.snapshotMetrics.map((metric) => (
                        <div key={metric.label} className="rounded-lg bg-[#f7fafc] p-2">
                          <p className="t-micro t-secondary">{metric.label}</p>
                          <p className="t-small font-semibold">{metric.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                      Disparity indicators
                    </p>
                    <ul className="mt-2 space-y-2">
                      {selectedCohort.disparityIndicators.map((item) => (
                        <li key={item} className="rounded-lg bg-[#f7fafc] p-2 t-small t-secondary">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {selectedTask && (
                  <div className="mt-4 rounded-xl border border-[#e4ebf3] bg-[#fbfcfe] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="t-body font-semibold">{selectedTask.title}</p>
                      {selectedTask.contextMode === "note-review" && (
                        <span className="rounded-full border border-[#d6dfeb] bg-white px-2 py-1 t-micro t-secondary">
                          Note-review task
                        </span>
                      )}
                    </div>
                    <p className="mt-2 t-small t-secondary">
                      {selectedTask.successCriteria}
                    </p>
                    {selectedTask.accuracyMeasurement && (
                      <div className="mt-3 rounded-lg border border-[#d6dfeb] bg-white p-3">
                        <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                          Accuracy measurement
                        </p>
                        <p className="mt-1 t-small t-secondary">
                          {selectedTask.accuracyMeasurement}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4">
                  <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                    Sample members
                  </p>
                  <div className="mt-2 space-y-2">
                    {selectedCohort.sampleMembers.map((member) => (
                      <div key={member.id} className="rounded-lg border border-[#e4ebf3] bg-[#fbfcfe] p-3">
                        <p className="t-small font-semibold">
                          {member.name} · {member.id}
                        </p>
                        <p className="mt-1 t-micro t-tertiary">
                          {member.language ?? "English"} · {member.insuranceType ?? "insurance n/a"}
                        </p>
                        <p className="mt-1 t-micro t-secondary">
                          {member.conditions.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="ehr-shell p-4">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-fordham-maroon" />
              <p className="t-small font-semibold">Comparison slots</p>
            </div>
            {hasSavedConfigs ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-[#d6dfeb] bg-[#fbfcfe] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="t-small font-semibold">Starter preset sync</p>
                      <p className="mt-1 t-micro t-secondary">
                        Refresh starter presets if older saved presets still point
                        to retired or unstable models. Custom configs stay as-is.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void syncStarterPresets()}
                      disabled={isCreatingPresets}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 t-small font-semibold text-fordham-maroon disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isCreatingPresets ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCcw size={14} />
                      )}
                      Refresh starter presets
                    </button>
                  </div>
                </div>
                {configs.map((config) => {
                  const selected = selectedConfigIds.includes(config.id);
                  const unavailable = config.isBatchRunnable === false;
                  return (
                    <button
                      key={config.id}
                      type="button"
                      onClick={() => toggleConfig(config.id)}
                      disabled={unavailable}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        unavailable
                          ? "cursor-not-allowed border-amber-200 bg-amber-50 opacity-80"
                          : selected
                          ? "border-fordham-maroon bg-fordham-maroon/5"
                          : "border-[#d6dfeb] bg-white hover:bg-[#f8fbff]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="t-body font-semibold">
                          {config.name ?? "Saved Config"}
                        </p>
                        {unavailable && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                            Unavailable
                          </span>
                        )}
                      </div>
                      <p className="mt-1 t-micro t-tertiary">
                        {config.modelName} · temp {config.temperature} ·{" "}
                        {config.contextLevel}
                        {config.ragEnabled ? " · RAG" : " · no RAG"}
                      </p>
                      {unavailable && (
                        <p className="mt-2 t-micro text-amber-900">
                          {config.invalidReason ??
                            "This config is not ready for population-health batch runs."}
                        </p>
                      )}
                      {config.needsPresetRefresh && (
                        <p className="mt-1 t-micro text-amber-900">
                          Refresh starter presets to repair this saved preset.
                        </p>
                      )}
                      {!unavailable && (
                        <p className="mt-2 t-micro text-fordham-maroon">
                          {selected ? "Included in this comparison." : "Click to add to the comparison."}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[#d6dfeb] bg-[#fbfcfe] p-4">
                <p className="t-body font-semibold">No saved configs yet</p>
                <p className="mt-1 t-small t-secondary">
                  Create starter presets first so you can compare the same
                  cohort task across multiple configurations.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void syncStarterPresets()}
                    disabled={isCreatingPresets}
                    className="inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2 t-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingPresets ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <BookOpen size={14} />
                    )}
                    Create starter presets
                  </button>
                  <Link
                    href="/experiments"
                    className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-4 py-2 t-small font-semibold text-fordham-maroon"
                  >
                    Go to Experiments
                  </Link>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => void runPopulationComparison()}
              disabled={
                isRunning ||
                !selectedCohortId ||
                !selectedTaskId ||
                selectedConfigIds.length < 2
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2 t-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              Run Population Comparison
            </button>
          </div>

          <div className="ehr-shell">
            <div className="ehr-shell-header">Population Run History</div>
            <div className="space-y-3 p-4">
              {history.length > 0 ? (
                history.map((item) => {
                  const slotSummary = summarizeSlotStatus(item.slots);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveRun(item)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        activeRun?.id === item.id
                          ? "border-fordham-maroon bg-fordham-maroon/5"
                          : "border-[#d6dfeb] bg-white hover:bg-[#f8fbff]"
                      }`}
                    >
                      <p className="t-body font-semibold">{item.cohortName}</p>
                      <p className="mt-1 t-small t-secondary">{item.taskTitle}</p>
                      <p className="mt-2 t-micro t-tertiary">
                        {slotSummary.failed > 0
                          ? `${slotSummary.completed}/${slotSummary.total} completed · ${slotSummary.failed} failed`
                          : `${item.slots.length} configs`}{" "}
                        · {formatDate(item.createdAt)}
                      </p>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-[#d6dfeb] p-6 text-center t-small t-secondary">
                  Saved population runs will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <ArrowRightLeft size={12} />
          <span>Latest Population Comparison</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="t-small t-secondary">
            Showing completed comparison rows by default. Failed slots are listed separately.
          </p>
          {activeCompletedSlots.length > 0 && (
            <button
              type="button"
              onClick={exportActiveRunCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 t-small font-semibold text-fordham-maroon"
            >
              <Download size={14} />
              Export CSV
            </button>
          )}
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-3">
          {activeCompletedSlots.map((slot) => (
            <div key={slot.configId} className="rounded-xl border border-[#d6dfeb] bg-white">
              <div className="border-b border-[#eef3f9] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="t-body font-semibold">{slot.configName}</p>
                </div>
                <p className="mt-1 t-micro t-tertiary">
                  {slot.modelName} · {slot.modelProvider}
                </p>
              </div>
              <div className="space-y-3 p-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: "Latency",
                      value: `${slot.latencyMs} ms`,
                      icon: Clock3,
                    },
                    {
                      label: "Tokens",
                      value: String(slot.totalTokens),
                      icon: RefreshCcw,
                    },
                    {
                      label: "Estimated cost",
                      value: formatCurrency(slot.estimatedCost),
                      icon: Coins,
                    },
                    { label: "RAG chunks", value: String(slot.ragChunks.length), icon: BarChart3 },
                  ].map((metric) => {
                    const Icon = metric.icon;
                    return (
                      <div key={metric.label} className="rounded-lg bg-[#f7fafc] p-2">
                        <div className="flex items-center gap-1.5">
                          <Icon size={12} className="text-fordham-maroon" />
                          <span className="t-micro t-secondary">{metric.label}</span>
                        </div>
                        <p className="mt-1 t-small font-semibold">{metric.value}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-lg bg-[#fbfcfe] p-3">
                  <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                    Output
                  </p>
                  <p className="mt-2 whitespace-pre-wrap t-small t-secondary">
                    {slot.output}
                  </p>
                </div>
                {slot.groundTruthCheck && (
                  <div className="rounded-lg border border-[#d6dfeb] bg-[#fbfcfe] p-3">
                    <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                      Accuracy Check
                    </p>
                    <p className="mt-1 t-small font-semibold">
                      {slot.groundTruthCheck.label}
                    </p>
                    <p className="mt-2 t-small t-secondary">
                      {slot.groundTruthCheck.summary}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                        {
                          label: "Ground truth",
                          value: String(slot.groundTruthCheck.expectedCount),
                        },
                        {
                          label: "Model tally",
                          value: `${slot.groundTruthCheck.extractedCount} (${slot.groundTruthCheck.countSource === "explicit-tally" ? "parsed" : "from listed charts"})`,
                        },
                        {
                          label: "Precision",
                          value: formatRate(slot.groundTruthCheck.precision),
                        },
                        {
                          label: "Recall",
                          value: formatRate(slot.groundTruthCheck.recall),
                        },
                      ].map((metric) => (
                        <div key={metric.label} className="rounded-lg bg-white p-2">
                          <p className="t-micro t-secondary">{metric.label}</p>
                          <p className="mt-1 t-small font-semibold">{metric.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      {[
                        {
                          label: "Correct charts",
                          value: slot.groundTruthCheck.matchedPatientNames,
                        },
                        {
                          label: "Missed charts",
                          value: slot.groundTruthCheck.missedPatientNames,
                        },
                        {
                          label: "Unexpected charts",
                          value: slot.groundTruthCheck.unexpectedPatientNames,
                        },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg bg-white p-2">
                          <p className="t-micro t-secondary">{item.label}</p>
                          <p className="mt-1 t-small font-semibold">
                            {item.value.length > 0 ? item.value.join(", ") : "None"}
                          </p>
                        </div>
                      ))}
                    </div>
                    {slot.groundTruthCheck.note && (
                      <p className="mt-3 t-micro t-tertiary">
                        {slot.groundTruthCheck.note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {!activeRun && (
            <div className="rounded-xl border border-dashed border-[#d6dfeb] p-6 text-center t-small t-secondary lg:col-span-3">
              No cohort comparison yet. Choose a mission or cohort task and run
              the same prompt across 2-3 configs.
            </div>
          )}
          {activeRun && activeCompletedSlots.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#d6dfeb] p-6 text-center t-small t-secondary lg:col-span-3">
              No completed comparison rows are available for this run. Review the
              failed slots below before retrying.
            </div>
          )}
        </div>
        {activeFailedSlots.length > 0 && (
          <div className="border-t border-[#eef3f9] p-4">
            <div className="mb-3">
              <h2 className="t-body font-semibold">Failed comparison slots</h2>
              <p className="mt-1 t-small t-secondary">
                These configs were excluded from the main grid because the
                provider or model did not finish the batch run.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {activeFailedSlots.map((slot) => (
                <div
                  key={slot.configId}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="t-body font-semibold text-amber-950">
                        {slot.configName}
                      </p>
                      <p className="mt-1 t-micro text-amber-900">
                        {slot.modelName} · {slot.modelProvider}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                      Failed
                    </span>
                  </div>
                  <p className="mt-3 t-small text-amber-950">
                    {slot.error?.message ?? "This config did not complete."}
                  </p>
                  {slot.error?.code && (
                    <p className="mt-2 t-micro uppercase tracking-wide text-amber-800">
                      Error code: {slot.error.code}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function PopulationHealthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-fordham-maroon" />
        </div>
      }
    >
      <PopulationHealthPageContent />
    </Suspense>
  );
}
