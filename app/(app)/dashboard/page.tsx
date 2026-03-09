"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  FlaskConical,
  GraduationCap,
  Loader2,
  NotebookTabs,
  ShieldCheck,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import {
  COURSE_DELIVERABLES,
  PROJECT_MILESTONES,
  TEAM_ROLES,
} from "@/lib/course";

interface OverviewResponse {
  team: {
    id: string;
    name: string;
    joinCode: string;
    role: "lead" | "member";
    memberCount: number;
  } | null;
  milestoneProgress: Array<{
    key: string;
    title: string;
    estimate: string;
    description: string;
    completed: boolean;
    completedAt: string | null;
    notes: string | null;
  }>;
  counts: {
    configs: number;
    experiments: number;
    notebookEntries: number;
    practiceRuns: number;
    checkpointRuns: number;
    officialRuns: number;
    reflections: number;
  };
  recentRuns: Array<{
    id: string;
    runMode: string;
    packId: string | null;
    status: string;
    tournamentScore: number | null;
    accuracyScore: number | null;
    safetyScore: number | null;
    biasEquityScore: number | null;
    completedAt: string | null;
    createdAt: string;
  }>;
}

interface NotebookEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

interface ReflectionSubmission {
  id: string;
  title: string;
  summary: string;
  updatedAt?: string;
  updated_at?: string;
  benchmark_evidence?: string;
  benchmarkEvidence?: string;
  cost_observability?: string;
  costObservability?: string;
  bias_equity_risk?: string;
  biasEquityRisk?: string;
  safety_control?: string;
  safetyControl?: string;
  deployment_recommendation?: string;
  deploymentRecommendation?: string;
}

const NOTE_CATEGORIES = [
  "hypothesis",
  "observation",
  "governance",
  "bias_equity",
  "cost",
  "reflection",
] as const;

function formatDate(value?: string | null) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPercent(value?: number | null) {
  if (value == null) return "--";
  return `${value.toFixed(1)}%`;
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [notebookEntries, setNotebookEntries] = useState<NotebookEntry[]>([]);
  const [reflection, setReflection] = useState<ReflectionSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const [noteForm, setNoteForm] = useState({
    category: "hypothesis",
    title: "",
    content: "",
    tags: "",
  });
  const [reflectionForm, setReflectionForm] = useState({
    title: "Final Reflection",
    summary: "",
    benchmarkEvidence: "",
    costObservability: "",
    biasEquityRisk: "",
    safetyControl: "",
    deploymentRecommendation: "",
  });

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const [overviewRes, notebookRes, reflectionRes] = await Promise.all([
        fetch("/api/project/overview"),
        fetch("/api/notebook"),
        fetch("/api/reflections"),
      ]);

      const overviewJson = await overviewRes.json();
      const notebookJson = await notebookRes.json();
      const reflectionJson = await reflectionRes.json();

      if (overviewRes.ok) setOverview(overviewJson);
      if (notebookRes.ok) setNotebookEntries(notebookJson);
      if (reflectionRes.ok && Array.isArray(reflectionJson) && reflectionJson.length > 0) {
        const latest = reflectionJson[0];
        setReflection(latest);
        setReflectionForm({
          title: latest.title ?? "Final Reflection",
          summary: latest.summary ?? "",
          benchmarkEvidence:
            latest.benchmarkEvidence ?? latest.benchmark_evidence ?? "",
          costObservability:
            latest.costObservability ?? latest.cost_observability ?? "",
          biasEquityRisk:
            latest.biasEquityRisk ?? latest.bias_equity_risk ?? "",
          safetyControl: latest.safetyControl ?? latest.safety_control ?? "",
          deploymentRecommendation:
            latest.deploymentRecommendation ??
            latest.deployment_recommendation ??
            "",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const completedMilestones = useMemo(
    () =>
      overview?.milestoneProgress.filter((milestone) => milestone.completed)
        .length ?? 0,
    [overview]
  );

  const milestoneCompletionPct =
    overview?.milestoneProgress.length
      ? Math.round(
          (completedMilestones / overview.milestoneProgress.length) * 100
        )
      : 0;

  const toggleMilestone = async (milestoneKey: string, completed: boolean) => {
    await fetch("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        milestoneKey,
        completed: !completed,
      }),
    });
    await loadDashboard();
  };

  const saveNotebookEntry = async () => {
    setIsSavingNote(true);
    try {
      await fetch("/api/notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: noteForm.category,
          title: noteForm.title,
          content: noteForm.content,
          tags: noteForm.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      setNoteForm({ category: "hypothesis", title: "", content: "", tags: "" });
      await loadDashboard();
    } finally {
      setIsSavingNote(false);
    }
  };

  const saveReflection = async () => {
    setIsSavingReflection(true);
    try {
      const res = await fetch("/api/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reflectionForm),
      });
      if (res.ok) {
        await loadDashboard();
      }
    } finally {
      setIsSavingReflection(false);
    }
  };

  if (isLoading && !overview) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-fordham-maroon" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="ehr-shell overflow-hidden">
        <div className="ehr-shell-header flex items-center gap-2">
          <GraduationCap size={12} />
          <span>Mission Control</span>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="t-heading text-xl">
                  ChatEHR Main Project
                </h1>
                {overview?.team && (
                  <span className="rounded-full bg-fordham-maroon/10 px-2.5 py-1 t-micro font-semibold text-fordham-maroon">
                    {overview.team.name}
                  </span>
                )}
              </div>
              <p className="mt-2 max-w-3xl t-body t-secondary">
                Teams of 3-4 should compare models, context levels, RAG, and
                temperature in a realistic simulated EHR, then defend the best
                configuration using benchmark evidence, observability, and
                bias/equity analysis.
              </p>
              {!overview?.team && (
                <div className="mt-4 max-w-3xl rounded-2xl border border-[#d6dfeb] bg-[#f7fafc] p-4">
                  <p className="t-small font-semibold text-fordham-maroon">
                    Team setup is required before your work can persist.
                  </p>
                  <p className="mt-1 t-body t-secondary">
                    Create a team or join an existing one with an invite code.
                    Configs, chats, experiments, reflections, and benchmark
                    runs all save at the team level.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <a
                      href="/join-team"
                      className="inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2.5 t-body font-medium text-white transition hover:bg-fordham-dark"
                    >
                      <Users size={16} />
                      <span>Create or join a team</span>
                    </a>
                    <a
                      href="/leaderboard"
                      className="inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-4 py-2.5 t-body font-medium t-secondary transition hover:border-fordham-maroon/30 hover:text-fordham-maroon"
                    >
                      <Trophy size={16} />
                      <span>View leaderboard first</span>
                    </a>
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href="/course/fordham-chatehr-project-guide.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-fordham-maroon/20 bg-fordham-maroon/5 px-3 py-1.5 t-small font-semibold text-fordham-maroon transition hover:bg-fordham-maroon/10"
                >
                  <FileText size={14} />
                  Download project guide
                </a>
                <a
                  href="/course/fordham-chatehr-project-guide.html"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[#d6dfeb] bg-white px-3 py-1.5 t-small font-semibold t-secondary transition hover:border-fordham-maroon/30 hover:text-fordham-maroon"
                >
                  <BookOpen size={14} />
                  Open print view
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Configs Saved",
                  value: overview?.counts.configs ?? 0,
                  icon: ClipboardList,
                },
                {
                  label: "Experiments",
                  value: overview?.counts.experiments ?? 0,
                  icon: FlaskConical,
                },
                {
                  label: "Notebook Entries",
                  value: overview?.counts.notebookEntries ?? 0,
                  icon: NotebookTabs,
                },
                {
                  label: "Benchmark Runs",
                  value:
                    (overview?.counts.practiceRuns ?? 0) +
                    (overview?.counts.checkpointRuns ?? 0) +
                    (overview?.counts.officialRuns ?? 0),
                  icon: Trophy,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-[#d6dfeb] bg-white p-3">
                    <div className="flex items-center justify-between">
                      <span className="t-micro font-semibold uppercase tracking-wider t-secondary">
                        {item.label}
                      </span>
                      <Icon size={14} className="text-fordham-maroon" />
                    </div>
                    <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#d6dfeb] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="t-small font-semibold t-primary">
                Project Progress
              </span>
              <span className="t-small font-semibold text-fordham-maroon">
                {milestoneCompletionPct}%
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-[#e8eef6]">
              <div
                className="h-2 rounded-full bg-fordham-maroon transition-all"
                style={{ width: `${milestoneCompletionPct}%` }}
              />
            </div>
            <div className="mt-4 space-y-2">
              <div className="rounded-lg bg-[#f7fafc] p-3">
                <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Recommended Time
                </p>
                <p className="mt-1 t-body">
                  4-8 hours per student across 3-4 weeks
                </p>
              </div>
              <div className="rounded-lg bg-[#f7fafc] p-3">
                <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Checkpoint
                </p>
                <p className="mt-1 t-body">March 24, 2026</p>
              </div>
              <div className="rounded-lg bg-[#f7fafc] p-3">
                <p className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Final Presentation
                </p>
                <p className="mt-1 t-body">April 7, 2026</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <section className="ehr-shell">
          <div className="ehr-shell-header flex items-center gap-2">
            <CheckCircle2 size={12} />
            <span>Milestones</span>
          </div>
          <div className="space-y-3 p-4">
            {overview?.milestoneProgress.map((milestone) => (
              <button
                key={milestone.key}
                type="button"
                onClick={() =>
                  void toggleMilestone(milestone.key, milestone.completed)
                }
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  milestone.completed
                    ? "border-fordham-maroon/30 bg-fordham-maroon/5"
                    : "border-[#d6dfeb] bg-white hover:bg-[#f8fbff]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-4 w-4 rounded-full border ${
                      milestone.completed
                        ? "border-fordham-maroon bg-fordham-maroon"
                        : "border-[#c5d2e2]"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="t-body font-semibold">{milestone.title}</p>
                      <span className="rounded-full bg-white px-2 py-1 t-micro font-semibold text-fordham-maroon">
                        {milestone.estimate}
                      </span>
                    </div>
                    <p className="mt-1 t-small t-secondary">
                      {milestone.description}
                    </p>
                    <p className="mt-2 t-micro t-tertiary">
                      {milestone.completed
                        ? `Completed ${formatDate(milestone.completedAt)}`
                        : "Click to mark complete once your team has evidence saved in the app."}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="ehr-shell">
            <div className="ehr-shell-header flex items-center gap-2">
              <Target size={12} />
              <span>Deliverables</span>
            </div>
            <div className="space-y-3 p-4">
              {COURSE_DELIVERABLES.map((item) => (
                <div key={item} className="flex gap-2">
                  <CheckCircle2 size={14} className="mt-0.5 text-fordham-maroon" />
                  <p className="t-small t-secondary">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="ehr-shell">
            <div className="ehr-shell-header flex items-center gap-2">
              <Users size={12} />
              <span>Suggested Team Roles</span>
            </div>
            <div className="space-y-3 p-4">
              {TEAM_ROLES.map((role) => (
                <div key={role.id} className="rounded-lg bg-white p-3">
                  <p className="t-small font-semibold">{role.title}</p>
                  <p className="mt-1 t-small t-secondary">{role.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="ehr-shell">
          <div className="ehr-shell-header flex items-center gap-2">
            <BookOpen size={12} />
            <span>Team Notebook</span>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3 rounded-xl border border-[#d6dfeb] bg-white p-4">
              <div>
                <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Category
                </label>
                <select
                  value={noteForm.category}
                  onChange={(event) =>
                    setNoteForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                >
                  {NOTE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Title
                </label>
                <input
                  value={noteForm.title}
                  onChange={(event) =>
                    setNoteForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                  placeholder="Model tradeoff hypothesis"
                />
              </div>
              <div>
                <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Evidence
                </label>
                <textarea
                  value={noteForm.content}
                  onChange={(event) =>
                    setNoteForm((current) => ({
                      ...current,
                      content: event.target.value,
                    }))
                  }
                  className="mt-1 min-h-[140px] w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                  placeholder="What changed, what stayed fixed, and what did you observe about quality, cost, tokens, or equity?"
                />
              </div>
              <div>
                <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  Tags
                </label>
                <input
                  value={noteForm.tags}
                  onChange={(event) =>
                    setNoteForm((current) => ({
                      ...current,
                      tags: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                  placeholder="temperature, rag, cost"
                />
              </div>
              <button
                type="button"
                onClick={() => void saveNotebookEntry()}
                disabled={isSavingNote || !noteForm.title || !noteForm.content}
                className="inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2 t-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingNote && <Loader2 size={14} className="animate-spin" />}
                Save Notebook Entry
              </button>
            </div>

            <div className="space-y-3">
              {(notebookEntries ?? []).slice(0, 6).map((entry) => (
                <div key={entry.id} className="rounded-xl border border-[#d6dfeb] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-[#eef3f9] px-2 py-1 t-micro font-semibold uppercase tracking-wider text-fordham-maroon">
                      {entry.category.replace("_", " ")}
                    </span>
                    <span className="t-micro t-tertiary">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 t-body font-semibold">{entry.title}</p>
                  <p className="mt-1 whitespace-pre-wrap t-small t-secondary">
                    {entry.content}
                  </p>
                  {entry.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#f7fafc] px-2 py-1 t-micro text-[#617894]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {notebookEntries.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#d6dfeb] bg-white p-6 text-center t-small t-secondary">
                  Save your first controlled-comparison note here.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="ehr-shell">
          <div className="ehr-shell-header flex items-center gap-2">
            <ShieldCheck size={12} />
            <span>Final Reflection</span>
          </div>
          <div className="space-y-3 p-4">
            {[
              ["Title", "title"],
              ["Best configuration and why", "summary"],
              ["Benchmark evidence", "benchmarkEvidence"],
              ["Cost and observability", "costObservability"],
              ["Bias or equity risk", "biasEquityRisk"],
              ["Safety control", "safetyControl"],
              ["Deployment recommendation", "deploymentRecommendation"],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="t-micro font-semibold uppercase tracking-wider t-secondary">
                  {label}
                </label>
                {key === "title" ? (
                  <input
                    value={reflectionForm[key as keyof typeof reflectionForm]}
                    onChange={(event) =>
                      setReflectionForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                  />
                ) : (
                  <textarea
                    value={reflectionForm[key as keyof typeof reflectionForm]}
                    onChange={(event) =>
                      setReflectionForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-1 min-h-[88px] w-full rounded-lg border border-[#d6dfeb] px-3 py-2 t-small outline-none"
                  />
                )}
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl bg-[#f7fafc] p-3">
              <div>
                <p className="t-small font-semibold">Current status</p>
                <p className="t-micro t-secondary">
                  {reflection
                    ? `Last updated ${formatDate(
                        reflection.updatedAt ?? reflection.updated_at ?? null
                      )}`
                    : "No reflection saved yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void saveReflection()}
                disabled={isSavingReflection}
                className="inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2 t-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingReflection && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Save Reflection
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <Trophy size={12} />
          <span>Recent Benchmark Runs</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#eef3f9]">
                {[
                  "Mode",
                  "Pack",
                  "Status",
                  "Tournament",
                  "Accuracy",
                  "Safety",
                  "Bias / Equity",
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
              {overview?.recentRuns.length ? (
                overview.recentRuns.map((run) => (
                  <tr key={run.id} className="border-b border-[#f2f5f9]">
                    <td className="px-4 py-3 t-small font-semibold">
                      {run.runMode}
                    </td>
                    <td className="px-4 py-3 t-small t-secondary">
                      {run.packId ?? "--"}
                    </td>
                    <td className="px-4 py-3 t-small">{run.status}</td>
                    <td className="px-4 py-3 t-small">
                      {run.tournamentScore?.toFixed(1) ?? "--"}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {formatPercent(run.accuracyScore)}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {formatPercent(run.safetyScore)}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {formatPercent(run.biasEquityScore)}
                    </td>
                    <td className="px-4 py-3 t-small t-secondary">
                      {formatDate(run.completedAt ?? run.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center t-small t-secondary"
                  >
                    No benchmark runs yet. Start with the practice pack, then
                    move to checkpoint and final.
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
