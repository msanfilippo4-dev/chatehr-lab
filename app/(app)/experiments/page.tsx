"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  BookOpen,
  Clock3,
  Coins,
  FlaskConical,
  Loader2,
  Play,
  RefreshCcw,
  Scale,
  Sparkles,
} from "lucide-react";
import { GUIDED_MISSIONS } from "@/lib/course";
import { TEACHING_PRESETS } from "@/lib/constants";
import StatusPanel from "@/components/feedback/StatusPanel";
import {
  ApiClientError,
  fetchApiJson,
  getApiErrorMessage,
} from "@/lib/client-api";

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

interface PatientSummary {
  id: string;
  name: string;
  age: number;
  gender: string;
  language?: string;
  insuranceType?: string;
  lastVisit: string;
  isComplex?: boolean;
}

interface ExperimentHistoryItem {
  id: string;
  patientId: string;
  patientName: string;
  prompt: string;
  recipeId?: string | null;
  variableFocus?: string | null;
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
      rationale?: string;
    }>;
  }>;
  createdAt: string;
}

interface PatientListResponse {
  patients: PatientSummary[];
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

function summarizeSlotStatus(
  slots: ExperimentHistoryItem["slots"] | undefined
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

function ExperimentsPageContent() {
  const searchParams = useSearchParams();
  const [configs, setConfigs] = useState<ConfigSummary[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [history, setHistory] = useState<ExperimentHistoryItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedConfigIds, setSelectedConfigIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [missionId, setMissionId] = useState("");
  const [variableFocus, setVariableFocus] = useState("");
  const [activeResult, setActiveResult] = useState<ExperimentHistoryItem | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isCreatingPresets, setIsCreatingPresets] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const patientMissions = useMemo(
    () => GUIDED_MISSIONS.filter((mission) => mission.track === "patient"),
    []
  );

  const loadPage = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [configJson, patientJson, historyJson] = await Promise.all([
        fetchApiJson<ConfigSummary[]>("/api/configs"),
        fetchApiJson<PatientListResponse>("/api/patients?limit=24"),
        fetchApiJson<ExperimentHistoryItem[]>("/api/experiments"),
      ]);
      setConfigs(configJson);
      setPatients(patientJson.patients ?? []);
      setHistory(historyJson);
      setActiveResult(historyJson[0] ?? null);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Experiment data is unavailable right now. Check the backend connection and try again.",
          noTeam: "Join a team before running experiments.",
          default: "Failed to load experiment data.",
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, []);

  const applyMission = (nextMissionId: string, nextConfigs = configs) => {
    const mission = patientMissions.find((item) => item.id === nextMissionId);
    if (!mission) return;

    setMissionId(mission.id);
    setPrompt(mission.prompt);
    setVariableFocus(mission.variableFocus);
    setSelectedPatientId(mission.recommendedPatientId ?? "");

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
    if (!missionParam || configs.length === 0) return;
    applyMission(missionParam, configs);
  }, [configs, searchParams]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId]
  );

  const selectedMission = useMemo(
    () => patientMissions.find((mission) => mission.id === missionId) ?? null,
    [patientMissions, missionId]
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
  const activeResultStatus = useMemo(
    () => summarizeSlotStatus(activeResult?.slots),
    [activeResult]
  );
  const hasSavedConfigs = configs.length > 0;

  useEffect(() => {
    setSelectedConfigIds((current) =>
      current.filter((configId) => runnableConfigIds.has(configId))
    );
  }, [runnableConfigIds]);

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

  const runExperiment = async () => {
    if (!selectedPatientId || selectedConfigIds.length < 2 || !prompt.trim()) {
      return;
    }

    setIsRunning(true);
    setMessage(null);
    try {
      const result = await fetchApiJson<ExperimentHistoryItem>(
        "/api/experiments/run",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          prompt,
          configIds: selectedConfigIds,
          recipeId: missionId || undefined,
          variableFocus: variableFocus || undefined,
        }),
        }
      );
      setActiveResult(result);
      await loadPage();
    } catch (error) {
      setMessage(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Experiment runs are unavailable right now. Check the backend connection and try again.",
          noTeam: "Join a team before running experiments.",
          default: "Failed to run experiment.",
        })
      );
      if (error instanceof ApiClientError && error.status === 502) {
        await loadPage();
      }
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading && configs.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-fordham-maroon" />
      </div>
    );
  }

  if (loadError && configs.length === 0 && patients.length === 0) {
    return (
      <StatusPanel
        title="Experiments unavailable"
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
          title="Some experiment data could not be refreshed"
          message={loadError}
          tone="info"
          action={{ label: "Retry", onClick: () => void loadPage() }}
        />
      )}

      {activeResult && activeResultStatus.failed > 0 && (
        <StatusPanel
          title={
            activeResultStatus.completed > 0
              ? "Comparison completed with partial failures"
              : "Comparison failed"
          }
          message={
            activeResultStatus.completed > 0
              ? `${activeResultStatus.completed} of ${activeResultStatus.total} configs completed; ${activeResultStatus.failed} failed. Successful outputs are still available below.`
              : `All ${activeResultStatus.total} selected configs failed. Review the provider and model errors below before retrying.`
          }
          tone={activeResultStatus.completed > 0 ? "info" : "error"}
        />
      )}

      <section className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <Sparkles size={12} />
          <span>Guided Experiment Missions</span>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="t-heading text-lg">
                Instructor-authored missions for controlled comparisons
              </h1>
              <p className="mt-1 t-body t-secondary">
                Start from a mission instead of inventing your own setup. Each
                mission fixes the patient and task so your team can focus on one
                meaningful variable at a time.
              </p>
            </div>
            {hasSavedConfigs && (
              <button
                type="button"
                onClick={() => void syncStarterPresets()}
                disabled={isCreatingPresets}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-4 py-2 t-small font-semibold text-fordham-maroon disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreatingPresets ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : hasSavedConfigs ? (
                  <RefreshCcw size={14} />
                ) : (
                  <BookOpen size={14} />
                )}
                {hasSavedConfigs
                  ? "Refresh starter presets"
                  : "Create starter presets"}
              </button>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {patientMissions.map((mission) => (
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
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="t-body font-semibold">{mission.title}</p>
                    <p className="mt-1 t-small t-secondary">{mission.summary}</p>
                  </div>
                  <span className="rounded-full bg-[#f7fafc] px-2 py-1 t-micro font-semibold text-fordham-maroon">
                    {mission.variableFocus}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {mission.recommendedPresetIds.map((presetId) => {
                    const preset = TEACHING_PRESETS.find((item) => item.id === presetId);
                    return (
                      <span
                        key={presetId}
                        className="rounded-full border border-[#d6dfeb] bg-white px-2 py-1 t-micro t-secondary"
                      >
                        {preset?.title ?? presetId}
                      </span>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <FlaskConical size={12} />
          <span>Single-Patient Comparison Runner</span>
        </div>
        <div className="grid gap-5 p-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div>
              <h2 className="t-heading text-lg">
                Run the same single-patient task across 2-3 saved configs
              </h2>
              <p className="mt-1 t-body t-secondary">
                Keep the patient and prompt fixed. Change only the variable you
                are trying to learn from: model, temperature, context, or RAG.
              </p>
              <p className="mt-2 t-small t-secondary">
                If you want to compare behavior across a cohort or group of
                patients, use the{" "}
                <Link
                  href="/population-health"
                  className="font-semibold text-fordham-maroon underline decoration-fordham-maroon/40 underline-offset-2"
                >
                  Population Health
                </Link>{" "}
                workflow instead.
              </p>
            </div>

            {message && (
              <div className="rounded-xl border border-[#d6dfeb] bg-[#f8fbff] p-3 t-small text-[#506680]">
                {message}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Teaching patient
                </label>
                <select
                  value={selectedPatientId}
                  onChange={(event) => setSelectedPatientId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                >
                  <option value="">Select a patient</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} · {patient.id}
                    </option>
                  ))}
                </select>
                {selectedPatient && (
                  <p className="mt-2 t-micro t-tertiary">
                    {selectedPatient.age}y {selectedPatient.gender} ·{" "}
                    {selectedPatient.language ?? "English"} ·{" "}
                    {selectedPatient.insuranceType ?? "insurance n/a"}
                  </p>
                )}
              </div>
              <div>
                <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Variable focus
                </label>
                <input
                  value={variableFocus}
                  onChange={(event) => setVariableFocus(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                  placeholder="Model size and reasoning style"
                />
              </div>
            </div>

            <div>
              <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-1 min-h-[120px] w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                placeholder="Ask one chart-grounded question that you will keep fixed across all selected configs."
              />
            </div>

            {selectedMission && (
              <div className="rounded-xl border border-fordham-maroon/20 bg-fordham-maroon/5 p-4">
                <p className="t-small font-semibold text-fordham-maroon">
                  {selectedMission.title}
                </p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                      Expected observations
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {selectedMission.expectedObservations.map((item) => (
                        <li key={item} className="t-small t-secondary">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                      Notebook prompt
                    </p>
                    <p className="mt-2 t-small t-secondary">
                      {selectedMission.notebookPrompt}
                    </p>
                    <p className="mt-3 t-micro font-semibold uppercase tracking-wider t-secondary">
                      Success criteria
                    </p>
                    <p className="mt-2 t-small t-secondary">
                      {selectedMission.successCriteria}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#d6dfeb] bg-white p-4">
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
                        <div>
                          <p className="t-body font-semibold">
                            {config.name ?? "Saved Config"}
                          </p>
                          <p className="mt-1 t-micro t-tertiary">
                            {config.modelName} · temp {config.temperature} ·{" "}
                            {config.contextLevel}
                            {config.ragEnabled ? " · RAG" : " · no RAG"}
                          </p>
                          {config.presetId && (
                            <p className="mt-1 t-micro text-fordham-maroon">
                              Preset:{" "}
                              {TEACHING_PRESETS.find(
                                (item) => item.id === config.presetId
                              )?.title ?? config.presetId}
                            </p>
                          )}
                          {unavailable && (
                            <p className="mt-2 t-micro text-amber-900">
                              {config.invalidReason ??
                                "This config is not ready for comparison runs."}
                            </p>
                          )}
                          {config.needsPresetRefresh && (
                            <p className="mt-1 t-micro text-amber-900">
                              Refresh starter presets to repair this saved preset.
                            </p>
                          )}
                        </div>
                        {unavailable ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                            Unavailable
                          </span>
                        ) : (
                          <div
                            className={`h-4 w-4 rounded-full border ${
                              selected
                                ? "border-fordham-maroon bg-fordham-maroon"
                                : "border-[#c5d2e2]"
                            }`}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[#d6dfeb] bg-[#fbfcfe] p-4">
                <p className="t-body font-semibold">No saved configs yet</p>
                <p className="mt-1 t-small t-secondary">
                  Create starter presets first so you can compare the same
                  patient across multiple configurations.
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
                    href="/population-health"
                    className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-4 py-2 t-small font-semibold text-fordham-maroon"
                  >
                    Go to Population Health
                  </Link>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => void runExperiment()}
              disabled={
                isRunning ||
                !selectedPatientId ||
                selectedConfigIds.length < 2 ||
                !prompt.trim()
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2 t-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              Run Single-Patient Experiment
            </button>
            <p className="mt-2 t-micro t-tertiary">
              Choose two or three configs. Keep the patient, prompt, and chart
              context fixed.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="ehr-shell">
            <div className="ehr-shell-header flex items-center gap-2">
              <ArrowRightLeft size={12} />
              <span>Latest Comparison</span>
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-3">
              {(activeResult?.slots ?? []).map((slot) => (
                <div
                  key={slot.configId}
                  className="rounded-xl border border-[#d6dfeb] bg-white"
                >
                  <div className="border-b border-[#eef3f9] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="t-body font-semibold">{slot.configName}</p>
                      {(slot.status === "failed" || slot.error) && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                          Failed
                        </span>
                      )}
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
                          value:
                            slot.status === "failed" || slot.error
                              ? "--"
                              : `${slot.latencyMs} ms`,
                          icon: Clock3,
                        },
                        {
                          label: "Tokens",
                          value:
                            slot.status === "failed" || slot.error
                              ? "--"
                              : String(slot.totalTokens),
                          icon: RefreshCcw,
                        },
                        {
                          label: "Estimated cost",
                          value:
                            slot.status === "failed" || slot.error
                              ? "--"
                              : formatCurrency(slot.estimatedCost),
                          icon: Coins,
                        },
                        {
                          label: "RAG chunks",
                          value: String(slot.ragChunks.length),
                          icon: FlaskConical,
                        },
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
                    {slot.status === "failed" || slot.error ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="t-micro font-semibold uppercase tracking-wider text-amber-800">
                          Run failed
                        </p>
                        <p className="mt-2 whitespace-pre-wrap t-small text-amber-900">
                          {slot.error?.message ?? "This config did not complete."}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-[#fbfcfe] p-3">
                        <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                          Output
                        </p>
                        <p className="mt-2 whitespace-pre-wrap t-small t-secondary">
                          {slot.output}
                        </p>
                      </div>
                    )}
                    {slot.ragChunks.length > 0 && (
                      <div className="rounded-lg border border-[#e4ebf3] bg-[#f9fbfe] p-3">
                        <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                          Retrieved guideline context
                        </p>
                        <div className="mt-2 space-y-2">
                          {slot.ragChunks.slice(0, 3).map((chunk) => (
                            <div
                              key={chunk.id}
                              className="rounded-lg bg-white px-3 py-2"
                            >
                              <p className="t-small font-semibold">
                                {chunk.title}
                              </p>
                              <p className="mt-1 t-micro t-tertiary">
                                {chunk.source ?? "guideline"}
                                {typeof chunk.score === "number"
                                  ? ` · score ${chunk.score.toFixed(1)}`
                                  : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!activeResult && (
                <div className="rounded-xl border border-dashed border-[#d6dfeb] p-6 text-center t-small t-secondary lg:col-span-3">
                  No single-patient experiment run yet. Choose a mission, keep
                  the patient and prompt fixed, and compare 2-3 saved configs.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ehr-shell">
          <div className="ehr-shell-header">Experiment History</div>
          <div className="space-y-3 p-4">
            {history.length > 0 ? (
              history.map((item) => {
                const slotSummary = summarizeSlotStatus(item.slots);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveResult(item)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      activeResult?.id === item.id
                        ? "border-fordham-maroon bg-fordham-maroon/5"
                        : "border-[#d6dfeb] bg-white hover:bg-[#f8fbff]"
                    }`}
                  >
                    <p className="t-body font-semibold">{item.patientName}</p>
                    <p className="mt-1 t-small t-secondary">
                      {item.variableFocus || "Controlled comparison"}
                    </p>
                    <p className="mt-2 line-clamp-2 t-micro t-tertiary">
                      {item.prompt}
                    </p>
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
                Your saved experiment runs will appear here.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ExperimentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-fordham-maroon" />
        </div>
      }
    >
      <ExperimentsPageContent />
    </Suspense>
  );
}
