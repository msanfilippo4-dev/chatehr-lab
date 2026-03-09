"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Clock3,
  Coins,
  FlaskConical,
  Loader2,
  Play,
  RefreshCcw,
  Scale,
} from "lucide-react";
import { EXPERIMENT_RECIPES } from "@/lib/course";

interface ConfigSummary {
  id: string;
  name?: string;
  modelName: string;
  modelProvider: string;
  temperature: number;
  contextLevel: string;
  ragEnabled: boolean;
}

interface PatientSummary {
  id: string;
  name: string;
  age: number;
  gender: string;
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
  slots: Array<{
    configId: string;
    configName: string;
    modelName: string;
    modelProvider: string;
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

export default function ExperimentsPage() {
  const [configs, setConfigs] = useState<ConfigSummary[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [history, setHistory] = useState<ExperimentHistoryItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedConfigIds, setSelectedConfigIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [variableFocus, setVariableFocus] = useState("");
  const [activeResult, setActiveResult] = useState<ExperimentHistoryItem | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  const loadPage = async () => {
    setIsLoading(true);
    try {
      const [configRes, patientRes, historyRes] = await Promise.all([
        fetch("/api/configs"),
        fetch("/api/patients?limit=24"),
        fetch("/api/experiments"),
      ]);

      const configJson = await configRes.json();
      const patientJson = (await patientRes.json()) as PatientListResponse;
      const historyJson = await historyRes.json();

      if (configRes.ok) setConfigs(configJson);
      if (patientRes.ok) setPatients(patientJson.patients ?? []);
      if (historyRes.ok) {
        setHistory(historyJson);
        setActiveResult(historyJson[0] ?? null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, []);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId]
  );

  const selectedConfigs = useMemo(
    () => configs.filter((config) => selectedConfigIds.includes(config.id)),
    [configs, selectedConfigIds]
  );

  const toggleConfig = (configId: string) => {
    setSelectedConfigIds((current) => {
      if (current.includes(configId)) {
        return current.filter((id) => id !== configId);
      }
      if (current.length >= 3) return current;
      return [...current, configId];
    });
  };

  const runExperiment = async () => {
    if (!selectedPatientId || selectedConfigIds.length < 2 || !prompt.trim()) {
      return;
    }

    setIsRunning(true);
    try {
      const res = await fetch("/api/experiments/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatientId,
          prompt,
          configIds: selectedConfigIds,
          recipeId: recipeId || undefined,
          variableFocus: variableFocus || undefined,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setActiveResult(result);
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <FlaskConical size={12} />
          <span>Controlled Comparison Runner</span>
        </div>
        <div className="grid gap-5 p-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div>
              <h1 className="t-heading text-lg">Run the same task across 2-3 saved configs</h1>
              <p className="mt-1 t-body t-secondary">
                Keep the patient and prompt fixed. Change only the variable you
                are trying to learn from: model, temperature, context, or RAG.
              </p>
            </div>

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
                    {selectedPatient.age}y {selectedPatient.gender} · last visit{" "}
                    {selectedPatient.lastVisit}
                    {selectedPatient.isComplex ? " · complex case" : ""}
                  </p>
                )}
              </div>
              <div>
                <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Recipe
                </label>
                <select
                  value={recipeId}
                  onChange={(event) => {
                    const nextRecipeId = event.target.value;
                    setRecipeId(nextRecipeId);
                    const recipe = EXPERIMENT_RECIPES.find(
                      (item) => item.id === nextRecipeId
                    );
                    if (recipe) {
                      setPrompt(recipe.prompt);
                      setVariableFocus(recipe.variableFocus);
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                >
                  <option value="">Choose a guided recipe</option>
                  {EXPERIMENT_RECIPES.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.title}
                    </option>
                  ))}
                </select>
                <p className="mt-2 t-micro t-tertiary">
                  Guided recipes are designed to make model/config differences
                  visible without needing to invent a good prompt from scratch.
                </p>
              </div>
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
          </div>

          <div className="rounded-2xl border border-[#d6dfeb] bg-white p-4">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-fordham-maroon" />
              <p className="t-small font-semibold">Comparison slots</p>
            </div>
            <div className="mt-4 space-y-3">
              {configs.map((config) => {
                const selected = selectedConfigIds.includes(config.id);
                return (
                  <button
                    key={config.id}
                    type="button"
                    onClick={() => toggleConfig(config.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? "border-fordham-maroon bg-fordham-maroon/5"
                        : "border-[#d6dfeb] bg-white hover:bg-[#f8fbff]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="t-body font-semibold">
                          {config.name ?? "Saved Config"}
                        </p>
                        <p className="mt-1 t-micro t-tertiary">
                          {config.modelName} · temp {config.temperature} ·{" "}
                          {config.contextLevel}
                          {config.ragEnabled ? " · RAG" : " · no RAG"}
                        </p>
                      </div>
                      <div
                        className={`h-4 w-4 rounded-full border ${
                          selected
                            ? "border-fordham-maroon bg-fordham-maroon"
                            : "border-[#c5d2e2]"
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

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
              Run Experiment
            </button>
            <p className="mt-2 t-micro t-tertiary">
              Choose two or three configs. Keep everything else fixed.
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
                    <p className="t-body font-semibold">{slot.configName}</p>
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
                    <div className="rounded-lg bg-[#fbfcfe] p-3">
                      <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                        Output
                      </p>
                      <p className="mt-2 whitespace-pre-wrap t-small t-secondary">
                        {slot.output}
                      </p>
                    </div>
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
                  No experiment run yet. Choose a patient, a fixed prompt, and
                  2-3 saved configs.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ehr-shell">
          <div className="ehr-shell-header">Experiment History</div>
          <div className="space-y-3 p-4">
            {history.length > 0 ? (
              history.map((item) => (
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
                    {item.slots.length} configs · {formatDate(item.createdAt)}
                  </p>
                </button>
              ))
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
