"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  GraduationCap,
  Loader2,
  Lock,
  ScrollText,
  ShieldAlert,
  Unlock,
  Users,
} from "lucide-react";
import StatusPanel from "@/components/feedback/StatusPanel";
import {
  ApiClientError,
  fetchApiJson,
  getApiErrorMessage,
} from "@/lib/client-api";
import { formatBenchmarkMetric } from "@/lib/benchmark-run-display";

interface InstructorSettings {
  officialBenchmarkLocked: boolean;
  checkpointBenchmarkLocked: boolean;
  updatedAt: string;
}

interface TeamSummary {
  id: string;
  name: string;
  joinCode: string;
  createdAt: string;
  memberCount: number;
  notebookCount: number;
  reflectionUpdatedAt: string | null;
  gradeTotal: number | null;
  gradeUpdatedAt: string | null;
  latestRun: {
    id: string;
    runMode: string;
    packId: string | null;
    status: string;
    executionErrorCount: number;
    tournamentScore: number | null;
    safetyScore: number | null;
    biasEquityScore: number | null;
    completedAt: string | null;
  } | null;
}

interface TeamDetail {
  team: {
    id: string;
    name: string;
    join_code: string;
    created_at: string;
  };
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
    platformRole: string;
  }>;
  notebookEntries: Array<{
    id: string;
    category: string;
    title: string;
    content: string;
    created_at: string;
  }>;
  reflection: {
    id: string;
    title: string;
    summary: string;
    benchmark_evidence: string;
    cost_observability: string;
    bias_equity_risk: string;
    safety_control: string;
    deployment_recommendation: string;
    updated_at: string;
  } | null;
  runs: Array<{
    id: string;
    runMode: string;
    packId: string | null;
    status: string;
    executionErrorCount: number;
    accuracyScore: number | null;
    safetyScore: number | null;
    biasEquityScore: number | null;
    tournamentScore: number | null;
    evaluationCostUsd: number | null;
    evaluationTokens: number | null;
    completedAt: string | null;
    createdAt: string;
    configName: string;
    modelName: string;
    presetId: string | null;
  }>;
  flags: Array<{
    id: string;
    flag_type: string;
    severity: string;
    summary: string;
    created_at: string;
  }>;
  grade: {
    experimental_design: number;
    benchmark_evidence: number;
    cost_observability: number;
    safety_reasoning: number;
    bias_equity: number;
    final_recommendation: number;
    overall_comments: string;
  } | null;
  experiments: Array<{
    id: string;
    prompt: string;
    recipe_id: string | null;
    variable_focus: string | null;
    created_at: string;
  }>;
  populationRuns: Array<{
    id: string;
    cohort_name: string;
    task_title: string;
    created_at: string;
  }>;
}

interface GradeDraft {
  experimentalDesign: number;
  benchmarkEvidence: number;
  costObservability: number;
  safetyReasoning: number;
  biasEquity: number;
  finalRecommendation: number;
  overallComments: string;
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

function defaultGradeDraft(detail: TeamDetail | null): GradeDraft {
  return {
    experimentalDesign: detail?.grade?.experimental_design ?? 0,
    benchmarkEvidence: detail?.grade?.benchmark_evidence ?? 0,
    costObservability: detail?.grade?.cost_observability ?? 0,
    safetyReasoning: detail?.grade?.safety_reasoning ?? 0,
    biasEquity: detail?.grade?.bias_equity ?? 0,
    finalRecommendation: detail?.grade?.final_recommendation ?? 0,
    overallComments: detail?.grade?.overall_comments ?? "",
  };
}

export default function InstructorPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [settings, setSettings] = useState<InstructorSettings | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [gradeDraft, setGradeDraft] = useState<GradeDraft>(defaultGradeDraft(null));
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingGrade, setIsSavingGrade] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTeamsAndSettings = async () => {
    setIsLoading(true);
    setAccessDenied(false);
    setLoadError(null);
    try {
      const [teamsJson, settingsJson] = await Promise.all([
        fetchApiJson<TeamSummary[]>("/api/instructor/teams"),
        fetchApiJson<InstructorSettings>("/api/instructor/settings"),
      ]);
      setTeams(teamsJson);
      setSelectedTeamId((current) => current || teamsJson[0]?.id || "");
      setSettings(settingsJson);
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.code === "instructor_required"
      ) {
        setAccessDenied(true);
        return;
      }
      setLoadError(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Instructor data is unavailable right now. Check the backend connection and try again.",
          default: "Failed to load instructor data.",
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamDetail = async (teamId: string) => {
    if (!teamId) return;
    try {
      const json = await fetchApiJson<TeamDetail>(`/api/instructor/teams/${teamId}`);
      setDetail(json);
      setGradeDraft(defaultGradeDraft(json));
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, {
          backendUnavailable:
            "The selected team could not be loaded because the backend is unavailable.",
          default: "Failed to load team detail.",
        })
      );
    }
  };

  useEffect(() => {
    void loadTeamsAndSettings();
  }, []);

  useEffect(() => {
    if (!selectedTeamId) return;
    void loadTeamDetail(selectedTeamId);
  }, [selectedTeamId]);

  const saveSettings = async (next: Partial<InstructorSettings>) => {
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const json = await fetchApiJson<InstructorSettings>("/api/instructor/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officialBenchmarkLocked:
            next.officialBenchmarkLocked ?? settings.officialBenchmarkLocked,
          checkpointBenchmarkLocked:
            next.checkpointBenchmarkLocked ?? settings.checkpointBenchmarkLocked,
        }),
      });
      setSettings(json);
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Course settings could not be updated because the backend is unavailable.",
          default: "Failed to update course settings.",
        })
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const saveGrade = async () => {
    if (!selectedTeamId) return;
    setIsSavingGrade(true);
    try {
      await fetchApiJson("/api/instructor/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selectedTeamId,
          ...gradeDraft,
        }),
      });
      await loadTeamDetail(selectedTeamId);
      await loadTeamsAndSettings();
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, {
          backendUnavailable:
            "Grades could not be saved because the backend is unavailable.",
          default: "Failed to save grade.",
        })
      );
    } finally {
      setIsSavingGrade(false);
    }
  };

  const cohortActivityCount = useMemo(
    () => detail?.populationRuns.length ?? 0,
    [detail?.populationRuns.length]
  );

  if (isLoading && teams.length === 0 && !accessDenied) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-fordham-maroon" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="ehr-shell max-w-md p-8 text-center">
          <ShieldAlert size={30} className="mx-auto text-fordham-maroon" />
          <h1 className="mt-3 t-heading text-lg">Instructor access only</h1>
          <p className="mt-2 t-body t-secondary">
            This dashboard is restricted to instructor accounts.
          </p>
        </div>
      </div>
    );
  }

  if (loadError && teams.length === 0) {
    return (
      <StatusPanel
        title="Instructor dashboard unavailable"
        message={loadError}
        action={{ label: "Retry", onClick: () => void loadTeamsAndSettings() }}
        className="mx-auto max-w-5xl"
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {loadError && (
        <StatusPanel
          title="Some instructor data could not be refreshed"
          message={loadError}
          tone="info"
          action={{ label: "Retry", onClick: () => void loadTeamsAndSettings() }}
        />
      )}

      <section className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <GraduationCap size={12} />
          <span>Instructor Dashboard</span>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-4">
          {[
            { label: "Teams", value: teams.length, icon: Users },
            {
              label: "Notebook entries",
              value: detail?.notebookEntries.length ?? 0,
              icon: ScrollText,
            },
            {
              label: "Flags",
              value: detail?.flags.length ?? 0,
              icon: AlertTriangle,
            },
            {
              label: "Population runs",
              value: cohortActivityCount,
              icon: GraduationCap,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border border-[#d6dfeb] bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="t-micro font-semibold uppercase tracking-wider t-secondary">
                    {card.label}
                  </span>
                  <Icon size={14} className="text-fordham-maroon" />
                </div>
                <p className="mt-2 text-2xl font-semibold">{card.value}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <div className="ehr-shell">
            <div className="ehr-shell-header">Benchmark access control</div>
            <div className="space-y-4 p-4">
              {[
                {
                  key: "checkpointBenchmarkLocked" as const,
                  label: "Checkpoint benchmark",
                  locked: settings?.checkpointBenchmarkLocked ?? false,
                },
                {
                  key: "officialBenchmarkLocked" as const,
                  label: "Final official benchmark",
                  locked: settings?.officialBenchmarkLocked ?? false,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-xl border border-[#d6dfeb] bg-white p-4"
                >
                  <div>
                    <p className="t-body font-semibold">{item.label}</p>
                    <p className="mt-1 t-small t-secondary">
                      {item.locked
                        ? "Students cannot submit this benchmark right now."
                        : "Students can submit this benchmark."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void saveSettings({
                        [item.key]: !item.locked,
                      })
                    }
                    disabled={isSavingSettings}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 t-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                      item.locked ? "bg-green-700" : "bg-fordham-maroon"
                    }`}
                  >
                    {item.locked ? <Unlock size={14} /> : <Lock size={14} />}
                    {item.locked ? "Unlock" : "Lock"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="ehr-shell">
            <div className="ehr-shell-header">Teams</div>
            <div className="space-y-3 p-4">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selectedTeamId === team.id
                      ? "border-fordham-maroon bg-fordham-maroon/5"
                      : "border-[#d6dfeb] bg-white hover:bg-[#f8fbff]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="t-body font-semibold">{team.name}</p>
                      <p className="mt-1 t-micro t-tertiary">
                        {team.memberCount} members · {team.notebookCount} notebook
                        entries
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="t-micro t-secondary">Grade</p>
                      <p className="t-small font-semibold">
                        {team.gradeTotal ?? "--"}
                      </p>
                    </div>
                  </div>
                  {team.latestRun && (
                    <p className="mt-2 t-micro t-secondary">
                      Latest {team.latestRun.runMode} ·{" "}
                      {team.latestRun.tournamentScore?.toFixed(1) ?? "--"} ·{" "}
                      {formatDate(team.latestRun.completedAt)}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {detail ? (
            <>
              <div className="ehr-shell p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="t-heading text-xl">{detail.team.name}</h1>
                    <p className="mt-1 t-body t-secondary">
                      Join code {detail.team.join_code} · created{" "}
                      {formatDate(detail.team.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/api/instructor/teams/${detail.team.id}/export`}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-4 py-2 t-small font-semibold text-fordham-maroon"
                    >
                      <Download size={14} />
                      Export report
                    </a>
                    <a
                      href={`/api/instructor/teams/${detail.team.id}/export?format=csv`}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-4 py-2 t-small font-semibold text-fordham-maroon"
                    >
                      <Download size={14} />
                      Export CSV
                    </a>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {detail.members.map((member) => (
                    <div key={member.userId} className="rounded-xl border border-[#d6dfeb] bg-white p-3">
                      <p className="t-body font-semibold">{member.name}</p>
                      <p className="mt-1 t-micro t-tertiary">{member.email}</p>
                      <p className="mt-2 t-micro text-fordham-maroon">
                        {member.role} · {member.platformRole}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ehr-shell">
                <div className="ehr-shell-header">Benchmark runs</div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#eef3f9]">
                        {[
                          "Mode",
                          "Config",
                          "Tournament",
                          "Safety",
                          "Bias / Equity",
                          "Review",
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
                      {detail.runs.map((run) => (
                        <tr key={run.id} className="border-b border-[#f2f5f9]">
                          <td className="px-4 py-3 t-small">{run.runMode}</td>
                          <td className="px-4 py-3 t-small">
                            {run.configName}
                            <div className="t-micro t-tertiary">{run.modelName}</div>
                          </td>
                          <td className="px-4 py-3 t-small">
                            {run.tournamentScore?.toFixed(1) ?? "--"}
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
                            <a
                              href={`/benchmark/runs/${run.id}`}
                              className="font-semibold text-fordham-maroon"
                            >
                              Open review
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-6">
                  <div className="ehr-shell">
                    <div className="ehr-shell-header">Rubric grading</div>
                    <div className="space-y-4 p-4">
                      {[
                        ["experimentalDesign", "Experimental design", 25],
                        ["benchmarkEvidence", "Benchmark evidence", 20],
                        ["costObservability", "Cost / observability", 15],
                        ["safetyReasoning", "Safety reasoning", 15],
                        ["biasEquity", "Bias / equity", 15],
                        ["finalRecommendation", "Final recommendation", 10],
                      ].map(([key, label, max]) => (
                        <label key={key} className="block">
                          <span className="t-micro font-semibold uppercase tracking-wider t-secondary">
                            {label}
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={max}
                            value={gradeDraft[key as keyof GradeDraft] as number}
                            onChange={(event) =>
                              setGradeDraft((current) => ({
                                ...current,
                                [key]: Number(event.target.value),
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                          />
                        </label>
                      ))}
                      <label className="block">
                        <span className="t-micro font-semibold uppercase tracking-wider t-secondary">
                          Overall comments
                        </span>
                        <textarea
                          value={gradeDraft.overallComments}
                          onChange={(event) =>
                            setGradeDraft((current) => ({
                              ...current,
                              overallComments: event.target.value,
                            }))
                          }
                          className="mt-1 min-h-[140px] w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void saveGrade()}
                        disabled={isSavingGrade}
                        className="inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2 t-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSavingGrade ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : null}
                        Save rubric
                      </button>
                    </div>
                  </div>

                  <div className="ehr-shell">
                    <div className="ehr-shell-header">Flags and cohort work</div>
                    <div className="space-y-3 p-4">
                      {detail.flags.map((flag) => (
                        <div key={flag.id} className="rounded-xl border border-[#d6dfeb] bg-white p-4">
                          <p className="t-body font-semibold">{flag.summary}</p>
                          <p className="mt-1 t-small t-secondary">
                            {flag.flag_type} · {flag.severity} · {formatDate(flag.created_at)}
                          </p>
                        </div>
                      ))}
                      {detail.populationRuns.map((run) => (
                        <div key={run.id} className="rounded-xl border border-[#d6dfeb] bg-white p-4">
                          <p className="t-body font-semibold">{run.cohort_name}</p>
                          <p className="mt-1 t-small t-secondary">
                            {run.task_title} · {formatDate(run.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="ehr-shell">
                    <div className="ehr-shell-header">Notebook evidence</div>
                    <div className="space-y-3 p-4">
                      {detail.notebookEntries.length > 0 ? (
                        detail.notebookEntries.map((entry) => (
                          <div key={entry.id} className="rounded-xl border border-[#d6dfeb] bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="t-body font-semibold">{entry.title}</p>
                              <span className="rounded-full bg-[#f7fafc] px-2 py-1 t-micro t-secondary">
                                {entry.category}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap t-small t-secondary">
                              {entry.content}
                            </p>
                            <p className="mt-2 t-micro t-tertiary">
                              {formatDate(entry.created_at)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#d6dfeb] p-6 text-center t-small t-secondary">
                          No notebook evidence submitted yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ehr-shell">
                    <div className="ehr-shell-header">Reflection</div>
                    <div className="space-y-3 p-4">
                      {detail.reflection ? (
                        <div className="rounded-xl border border-[#d6dfeb] bg-white p-4">
                          <p className="t-body font-semibold">{detail.reflection.title}</p>
                          <p className="mt-2 whitespace-pre-wrap t-small t-secondary">
                            {detail.reflection.summary}
                          </p>
                          <div className="mt-4 space-y-2">
                            <p className="t-small">
                              <strong>Benchmark evidence:</strong>{" "}
                              {detail.reflection.benchmark_evidence}
                            </p>
                            <p className="t-small">
                              <strong>Cost / observability:</strong>{" "}
                              {detail.reflection.cost_observability}
                            </p>
                            <p className="t-small">
                              <strong>Bias / equity risk:</strong>{" "}
                              {detail.reflection.bias_equity_risk}
                            </p>
                            <p className="t-small">
                              <strong>Safety control:</strong>{" "}
                              {detail.reflection.safety_control}
                            </p>
                            <p className="t-small">
                              <strong>Deployment recommendation:</strong>{" "}
                              {detail.reflection.deployment_recommendation}
                            </p>
                          </div>
                          <p className="mt-3 t-micro t-tertiary">
                            Updated {formatDate(detail.reflection.updated_at)}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#d6dfeb] p-6 text-center t-small t-secondary">
                          No reflection submitted yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="ehr-shell p-8 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-fordham-maroon" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
