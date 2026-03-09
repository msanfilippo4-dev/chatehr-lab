"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  GraduationCap,
  Loader2,
  Lock,
  ScrollText,
  ShieldAlert,
  Unlock,
  Users,
} from "lucide-react";

interface InstructorOverview {
  teamCount: number;
  recentRuns: Array<{
    id: string;
    team_id: string;
    run_mode: string;
    status: string;
    tournament_score: number | null;
    safety_score: number | null;
    bias_equity_score: number | null;
    completed_at: string | null;
  }>;
  flags: Array<{
    id: string;
    team_id: string;
    flag_type: string;
    severity: string;
    summary: string;
    created_at: string;
  }>;
  reflections: Array<{
    id: string;
    team_id: string;
    title: string;
    updated_at: string;
  }>;
}

interface InstructorSettings {
  officialBenchmarkLocked: boolean;
  checkpointBenchmarkLocked: boolean;
  updatedAt: string;
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

export default function InstructorPage() {
  const [overview, setOverview] = useState<InstructorOverview | null>(null);
  const [settings, setSettings] = useState<InstructorSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const loadPage = async () => {
    setIsLoading(true);
    setAccessDenied(false);
    try {
      const [overviewRes, settingsRes] = await Promise.all([
        fetch("/api/instructor/overview"),
        fetch("/api/instructor/settings"),
      ]);

      if (overviewRes.status === 403 || settingsRes.status === 403) {
        setAccessDenied(true);
        return;
      }

      const overviewJson = await overviewRes.json();
      const settingsJson = await settingsRes.json();

      if (overviewRes.ok) setOverview(overviewJson);
      if (settingsRes.ok) setSettings(settingsJson);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, []);

  const saveSettings = async (next: Partial<InstructorSettings>) => {
    if (!settings) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/instructor/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officialBenchmarkLocked:
            next.officialBenchmarkLocked ?? settings.officialBenchmarkLocked,
          checkpointBenchmarkLocked:
            next.checkpointBenchmarkLocked ?? settings.checkpointBenchmarkLocked,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setSettings(json);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !overview && !accessDenied) {
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
            This dashboard is restricted to instructor accounts in the seeded
            user table.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <GraduationCap size={12} />
          <span>Instructor Dashboard</span>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-4">
          {[
            { label: "Teams", value: overview?.teamCount ?? 0, icon: Users },
            {
              label: "Recent benchmark runs",
              value: overview?.recentRuns.length ?? 0,
              icon: ScrollText,
            },
            {
              label: "Flagged runs",
              value: overview?.flags.length ?? 0,
              icon: AlertTriangle,
            },
            {
              label: "Reflection submissions",
              value: overview?.reflections.length ?? 0,
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

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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
                    disabled={isSaving}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 t-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                      item.locked
                        ? "bg-green-700"
                        : "bg-fordham-maroon"
                    }`}
                  >
                    {item.locked ? <Unlock size={14} /> : <Lock size={14} />}
                    {item.locked ? "Unlock" : "Lock"}
                  </button>
                </div>
              ))}
              <p className="t-micro t-tertiary">
                Last updated {formatDate(settings?.updatedAt ?? null)}
              </p>
            </div>
          </div>

          <div className="ehr-shell">
            <div className="ehr-shell-header">Flagged safety or equity cases</div>
            <div className="space-y-3 p-4">
              {overview?.flags.length ? (
                overview.flags.map((flag) => (
                  <div key={flag.id} className="rounded-xl border border-[#d6dfeb] bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="t-body font-semibold">{flag.summary}</p>
                      <span className="rounded-full bg-red-50 px-2 py-1 t-micro font-semibold text-red-700">
                        {flag.severity}
                      </span>
                    </div>
                    <p className="mt-1 t-small t-secondary">
                      {flag.flag_type} · team {flag.team_id}
                    </p>
                    <p className="mt-2 t-micro t-tertiary">
                      {formatDate(flag.created_at)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[#d6dfeb] p-6 text-center t-small t-secondary">
                  No flags recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="ehr-shell">
            <div className="ehr-shell-header">Recent benchmark runs</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#eef3f9]">
                    {[
                      "Run mode",
                      "Status",
                      "Tournament",
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
                          {run.run_mode}
                        </td>
                        <td className="px-4 py-3 t-small">{run.status}</td>
                        <td className="px-4 py-3 t-small">
                          {run.tournament_score?.toFixed(1) ?? "--"}
                        </td>
                        <td className="px-4 py-3 t-small">
                          {run.safety_score?.toFixed(1) ?? "--"}
                        </td>
                        <td className="px-4 py-3 t-small">
                          {run.bias_equity_score?.toFixed(1) ?? "--"}
                        </td>
                        <td className="px-4 py-3 t-small t-secondary">
                          {formatDate(run.completed_at)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center t-small t-secondary"
                      >
                        No benchmark runs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ehr-shell">
            <div className="ehr-shell-header">Recent reflection submissions</div>
            <div className="space-y-3 p-4">
              {overview?.reflections.length ? (
                overview.reflections.map((reflection) => (
                  <div
                    key={reflection.id}
                    className="rounded-xl border border-[#d6dfeb] bg-white p-4"
                  >
                    <p className="t-body font-semibold">{reflection.title}</p>
                    <p className="mt-1 t-small t-secondary">
                      Team {reflection.team_id}
                    </p>
                    <p className="mt-2 t-micro t-tertiary">
                      Updated {formatDate(reflection.updated_at)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[#d6dfeb] p-6 text-center t-small t-secondary">
                  No reflections submitted yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
