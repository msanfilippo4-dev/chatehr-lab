"use client";
import React, { useEffect, useMemo, useState } from "react";

type Answers = {
  case1Potassium: string;
  case1Medication: string;
  case2A1c: string;
  case2Ldl: string;
  case3Medication: string;
  case3Hcg: string;
  case4FluCount: string;
  case5A1cCount: string;
  case5PatientIds: string;
};

type GradeCase = {
  caseId: string;
  title: string;
  score: number;
  maxScore: number;
  feedback: string;
};

type Analytics = {
  scope: "student" | "class";
  scopeLabel: string;
  submissionCount: number;
  averageOverall: number;
  averageByCase: Array<{
    caseId: string;
    title: string;
    avgScore: number;
    maxScore: number;
  }>;
  recent: Array<{
    id: string;
    createdAt: string;
    student: string;
    overallScore: number;
  }>;
};

type SubmitResponse = {
  submission: { id: string; createdAt: string };
  grade: {
    overallScore: number;
    maxScore: number;
    cases: GradeCase[];
  };
  analytics: Analytics;
  delivery: { forwarded: boolean; message: string };
  error?: string;
};

const EMPTY_ANSWERS: Answers = {
  case1Potassium: "",
  case1Medication: "",
  case2A1c: "",
  case2Ldl: "",
  case3Medication: "",
  case3Hcg: "",
  case4FluCount: "",
  case5A1cCount: "",
  case5PatientIds: "",
};

export default function FordhamHealthBenchPage() {
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const completion = useMemo(() => {
    const required = [
      answers.case1Potassium,
      answers.case1Medication,
      answers.case2A1c,
      answers.case2Ldl,
      answers.case3Medication,
      answers.case3Hcg,
      answers.case4FluCount,
      answers.case5A1cCount,
    ];
    const done = required.filter((v) => v.trim().length > 0).length;
    return `${done}/${required.length}`;
  }, [answers]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/fordham-health-bench/analytics");
        if (!res.ok) return;
        const data = (await res.json()) as { analytics?: Analytics };
        if (data.analytics) setAnalytics(data.analytics);
      } catch {
        // Non-fatal
      }
    };
    load();
  }, []);

  const update = (key: keyof Answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitResult(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/fordham-health-bench/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = (await res.json()) as SubmitResponse;
      if (!res.ok) {
        setError(data.error || "Submission failed.");
      } else {
        setSubmitResult(data);
        setAnalytics(data.analytics);
      }
    } catch {
      setError("Network error while submitting benchmark.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="ehr-shell p-5 md:p-6">
        <h1 className="text-2xl font-semibold text-[#122033]">
          Fordham Health Bench (Mini, 5 Cases)
        </h1>
        <p className="t-body t-secondary mt-2">
          Goal: evaluate your ability to extract concrete clinical information.
          Follow the patient/cohort targets and prompt paths below, then submit
          your extracted answers.
        </p>
        <p className="t-caption mt-2">
          Want harder prompts after this?{" "}
          <a
            href="/extracredit"
            className="font-semibold text-[#8C1515] underline underline-offset-2 hover:text-[#6B1010]"
          >
            Open /extracredit
          </a>
          .
        </p>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <h2 className="t-heading t-primary">Query Targets + Prompt Paths</h2>
        <ul className="list-disc pl-5 mt-2 space-y-1 t-body t-secondary">
          <li>Cases 1-3: use patient IDs `LAB-001`, `LAB-002`, `LAB-003` (Eleanor, Marcus, Chloe).</li>
          <li>Cases 4-5: use `Bronx Hospital Cohort (50)` from the selector.</li>
          <li>Prompt pattern: ask for specific values first, then ask model to cite chart evidence.</li>
          <li>If unsure, verify directly in chart tabs and lab panels before submitting.</li>
        </ul>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="t-heading t-primary">Bench Form</h2>
          <span className="t-caption t-secondary">Completion: {completion}</span>
        </div>

        <form className="mt-3 space-y-4" onSubmit={submit}>
          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3 space-y-3">
            <p className="font-semibold text-[#122033]">
              Case 1 (LAB-001): potassium risk extraction
            </p>
            <p className="t-caption t-secondary">
              Prompt idea: &quot;What is the latest potassium and which active med increases
              hyperkalemia risk?&quot; Hint: The absolute latest lab value might be buried in the clinical notes, not just the structured Labs tab. Pay attention to active vs discontinued medications.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={answers.case1Potassium}
                onChange={(e) => update("case1Potassium", e.target.value)}
                placeholder="Latest potassium value (e.g., 5.8)"
                className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
              />
              <input
                value={answers.case1Medication}
                onChange={(e) => update("case1Medication", e.target.value)}
                placeholder="One active risk medication"
                className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3 space-y-3">
            <p className="font-semibold text-[#122033]">
              Case 2 (LAB-002): cardiometabolic value extraction
            </p>
            <p className="t-caption t-secondary">
              Prompt idea: &quot;Give me latest A1c and LDL for this patient.&quot; Hint: Similar to Case 1, point-of-care lab results are sometimes documented in free-text clinical notes rather than structured lab interfaces.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={answers.case2A1c}
                onChange={(e) => update("case2A1c", e.target.value)}
                placeholder="Latest A1c value"
                className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
              />
              <input
                value={answers.case2Ldl}
                onChange={(e) => update("case2Ldl", e.target.value)}
                placeholder="Latest LDL value"
                className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3 space-y-3">
            <p className="font-semibold text-[#122033]">
              Case 3 (LAB-003): pregnancy safety extraction
            </p>
            <p className="t-caption t-secondary">
              Prompt idea: &quot;Which medication is most relevant for pregnancy safety and
              what is the latest hCG result?&quot;
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={answers.case3Medication}
                onChange={(e) => update("case3Medication", e.target.value)}
                placeholder="Medication name"
                className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
              />
              <input
                value={answers.case3Hcg}
                onChange={(e) => update("case3Hcg", e.target.value)}
                placeholder="Latest hCG value"
                className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3 space-y-3">
            <p className="font-semibold text-[#122033]">
              Case 4 (Bronx 50): influenza coverage count
            </p>
            <p className="t-caption t-secondary">
              Prompt idea: &quot;How many patients in this cohort have documented influenza immunization?&quot;
            </p>
            <input
              value={answers.case4FluCount}
              onChange={(e) => update("case4FluCount", e.target.value)}
              placeholder="Flu-shot count"
              className="w-full rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3 space-y-3">
            <p className="font-semibold text-[#122033]">
              Case 5 (Bronx 50): A1c &gt;= 8.0 prevalence
            </p>
            <p className="t-caption t-secondary">
              Prompt idea: &quot;How many patients in this cohort have A1c &gt;= 8.0? List IDs.&quot;
            </p>
            <input
              value={answers.case5A1cCount}
              onChange={(e) => update("case5A1cCount", e.target.value)}
              placeholder="A1c>=8 count"
              className="w-full rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
            />
            <textarea
              rows={2}
              value={answers.case5PatientIds}
              onChange={(e) => update("case5PatientIds", e.target.value)}
              placeholder="Optional: comma-separated patient IDs"
              className="w-full rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm resize-y"
            />
          </div>

          {error && (
            <p className="t-caption text-[#8C1515] border border-[#f0c4c4] bg-[#fff6f6] rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-[#8C1515] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#6B1010] disabled:opacity-50"
          >
            {isSubmitting ? "Submitting + Grading..." : "Submit Fordham Health Bench"}
          </button>
        </form>
      </section>

      {submitResult && (
        <section className="ehr-shell p-5 md:p-6 space-y-3">
          <h2 className="t-heading t-primary">Latest Submission Result</h2>
          <p className="t-body t-secondary">
            Score: <strong>{submitResult.grade.overallScore}/100</strong> · Submission ID:{" "}
            <span className="font-mono">{submitResult.submission.id}</span>
          </p>
          <p className="t-caption t-secondary">
            Email forwarding: {submitResult.delivery.forwarded ? "sent" : "not sent"} ·{" "}
            {submitResult.delivery.message}
          </p>
          <div className="space-y-2">
            {submitResult.grade.cases.map((c) => (
              <div
                key={c.caseId}
                className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[#122033]">{c.title}</p>
                  <span className="text-sm font-semibold text-[#122033]">
                    {c.score}/{c.maxScore}
                  </span>
                </div>
                <p className="t-caption text-[#4c637f] mt-1">{c.feedback}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {analytics && (
        <section className="ehr-shell p-5 md:p-6 space-y-4">
          <h2 className="t-heading t-primary">Analytics</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Stat label={analytics.scopeLabel} value={analytics.submissionCount.toString()} />
            <Stat label="Average Overall" value={`${analytics.averageOverall}%`} />
            <Stat label="Most Recent Rows" value={analytics.recent.length.toString()} />
          </div>

          <div className="space-y-2">
            <p className="t-caption font-semibold text-[#122033]">Average by Case</p>
            {analytics.averageByCase.map((c) => {
              const pct = c.maxScore > 0 ? (c.avgScore / c.maxScore) * 100 : 0;
              return (
                <div key={c.caseId} className="rounded-lg border border-[#d6dfeb] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="t-caption font-semibold text-[#122033]">{c.title}</p>
                    <p className="t-caption text-[#4c637f]">
                      {c.avgScore.toFixed(1)}/{c.maxScore}
                    </p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#e6eef8]">
                    <div
                      className="h-2 rounded-full bg-[#8C1515]"
                      style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-[#d6dfeb] p-3">
            <p className="t-caption font-semibold text-[#122033] mb-2">Recent Submissions</p>
            <div className="space-y-1">
              {analytics.recent.length === 0 && (
                <p className="t-caption t-secondary">No submissions yet.</p>
              )}
              {analytics.recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 t-caption">
                  <span className="text-[#4c637f]">
                    {new Date(r.createdAt).toLocaleString()} · {r.student}
                  </span>
                  <span className="font-semibold text-[#122033]">{r.overallScore}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
      <p className="t-caption text-[#4c637f]">{label}</p>
      <p className="text-lg font-semibold text-[#122033] mt-1">{value}</p>
    </div>
  );
}
