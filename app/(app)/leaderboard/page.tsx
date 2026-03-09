"use client";

import { useEffect, useState } from "react";
import { Medal, Radio, ShieldCheck, Timer } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  teamName: string;
  modelName: string;
  compositeScore: number;
  accuracyScore: number;
  safetyScore: number;
  biasEquityScore?: number;
  totalCost: number;
  latencyP95Ms?: number | null;
  runCount?: number;
  submittedAt: string;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/leaderboard");
        const json = await res.json();
        if (res.ok) setEntries(json);
      } finally {
        setIsLoading(false);
      }
    };

    void loadLeaderboard();
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="ehr-shell">
        <div className="ehr-shell-header flex items-center gap-2">
          <Medal size={12} />
          <span>Official Rankings</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h1 className="t-heading text-lg">Leaderboard with safety and bias/equity visible</h1>
            <p className="mt-1 t-body t-secondary">
              Final official runs are ranked by balanced performance, not just
              speed or low cost.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5">
            <Radio size={12} className="animate-pulse text-green-600" />
            <span className="t-micro font-semibold text-green-700">Live</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="ehr-shell p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-fordham-maroon" />
            <span className="t-small font-semibold">Scoring weights</span>
          </div>
          <p className="mt-2 t-small t-secondary">
            Accuracy 55%, Safety 25%, Bias/Equity 20%
          </p>
        </div>
        <div className="ehr-shell p-4">
          <div className="flex items-center gap-2">
            <Timer size={14} className="text-fordham-maroon" />
            <span className="t-small font-semibold">Tiebreaker mindset</span>
          </div>
          <p className="mt-2 t-small t-secondary">
            Latency and cost matter, but only after quality, safety, and equity.
          </p>
        </div>
        <div className="ehr-shell p-4">
          <p className="t-small font-semibold">What to optimize</p>
          <p className="mt-2 t-small t-secondary">
            Use the benchmark as evidence for your demo and reflection, not as
            the only course outcome.
          </p>
        </div>
      </section>

      <section className="ehr-shell">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#eef3f9]">
                {[
                  "Rank",
                  "Team",
                  "Tournament",
                  "Accuracy",
                  "Safety",
                  "Bias / Equity",
                  "Cost",
                  "Latency",
                  "Model",
                  "Submitted",
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
              {!isLoading && entries.length > 0 ? (
                entries.map((entry) => (
                  <tr key={`${entry.teamName}-${entry.rank}`} className="border-b border-[#f2f5f9]">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full t-small font-semibold ${
                          entry.rank === 1
                            ? "bg-yellow-100 text-yellow-700"
                            : entry.rank === 2
                              ? "bg-slate-100 text-slate-700"
                              : entry.rank === 3
                                ? "bg-orange-100 text-orange-700"
                                : "bg-[#f7fafc] text-[#60768f]"
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 t-body font-semibold">
                      {entry.teamName}
                    </td>
                    <td className="px-4 py-3 t-body font-semibold text-fordham-maroon">
                      {entry.compositeScore.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {entry.accuracyScore.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 t-small">
                      {entry.safetyScore.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 t-small">
                      {(entry.biasEquityScore ?? 0).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 t-small">
                      ${entry.totalCost.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 t-small">
                      {entry.latencyP95Ms != null
                        ? `${entry.latencyP95Ms} ms`
                        : "--"}
                    </td>
                    <td className="px-4 py-3 t-small t-secondary">
                      {entry.modelName}
                    </td>
                    <td className="px-4 py-3 t-small t-secondary">
                      {formatDate(entry.submittedAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center t-small t-secondary"
                  >
                    {isLoading
                      ? "Loading leaderboard..."
                      : "No official final runs yet."}
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
