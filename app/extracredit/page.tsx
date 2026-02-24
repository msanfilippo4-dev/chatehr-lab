"use client";
import React, { useEffect, useMemo, useState } from "react";

type Answers = {
  exam1Potassium: string;
  exam1ActiveMed: string;
  exam1DiscontinuedMed: string;
  exam2NoFluCount: string;
  exam2CkdCount: string;
  exam3BronxHighA1cCount: string;
  exam3BronxIds: string;
};

type ExamGrade = {
  examId: string;
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
  averageByExam: Array<{
    examId: string;
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
    exams: ExamGrade[];
  };
  analytics: Analytics;
  delivery: { forwarded: boolean; message: string };
  error?: string;
};

const EMPTY_ANSWERS: Answers = {
  exam1Potassium: "",
  exam1ActiveMed: "",
  exam1DiscontinuedMed: "",
  exam2NoFluCount: "",
  exam2CkdCount: "",
  exam3BronxHighA1cCount: "",
  exam3BronxIds: "",
};

export default function ExtraCreditPage() {
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const completion = useMemo(() => {
    const required = [
      answers.exam1Potassium,
      answers.exam1ActiveMed,
      answers.exam1DiscontinuedMed,
      answers.exam2NoFluCount,
      answers.exam2CkdCount,
      answers.exam3BronxHighA1cCount,
    ];
    const done = required.filter((v) => v.trim().length > 0).length;
    return `${done}/${required.length}`;
  }, [answers]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/extracredit/analytics");
        if (!res.ok) return;
        const data = (await res.json()) as { analytics?: Analytics };
        if (data.analytics) setAnalytics(data.analytics);
      } catch {
        // Non-fatal.
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
      const res = await fetch("/api/extracredit/submit", {
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
      setError("Network error while submitting extra credit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="ehr-shell p-5 md:p-6">
        <h1 className="text-2xl font-semibold text-[#122033]">
          Extra Credit: 3 Challenge Exams
        </h1>
        <p className="t-body t-secondary mt-2">
          These challenges test chart extraction, cohort analysis, and patient-level
          verification. Submit once you have chart-grounded answers.
        </p>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="t-heading t-primary">Challenge Form</h2>
          <span className="t-caption t-secondary">Completion: {completion}</span>
        </div>

        <form className="mt-3 space-y-4" onSubmit={submit}>
          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3 space-y-3">
            <p className="font-semibold text-[#122033]">
              Exam 1: LAB-001 high-risk reconciliation
            </p>
            <p className="t-caption t-secondary">
              Target: LAB-001 (Eleanor Vance). Extract note-vs-structured conflict and med status.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={answers.exam1Potassium}
                onChange={(e) => update("exam1Potassium", e.target.value)}
                placeholder="Latest potassium"
                className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
              />
              <input
                value={answers.exam1ActiveMed}
                onChange={(e) => update("exam1ActiveMed", e.target.value)}
                placeholder="Active risk medication"
                className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
              />
              <input
                value={answers.exam1DiscontinuedMed}
                onChange={(e) => update("exam1DiscontinuedMed", e.target.value)}
                placeholder="Discontinued medication"
                className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3 space-y-3">
            <p className="font-semibold text-[#122033]">
              Exam 2: All-patient operational metrics
            </p>
            <p className="t-caption t-secondary">
              Target: All Patients cohort. Compute tractable counts for quality operations.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={answers.exam2NoFluCount}
                onChange={(e) => update("exam2NoFluCount", e.target.value)}
                placeholder="No flu shot count"
                className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
              />
              <input
                value={answers.exam2CkdCount}
                onChange={(e) => update("exam2CkdCount", e.target.value)}
                placeholder="CKD diagnosis count"
                className="rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3 space-y-3">
            <p className="font-semibold text-[#122033]">
              Exam 3: Bronx 50 prevalence + patient IDs
            </p>
            <p className="t-caption t-secondary">
              Target: Bronx Hospital Cohort (50). Report A1c &gt;= 8 count and list corresponding IDs.
            </p>
            <input
              value={answers.exam3BronxHighA1cCount}
              onChange={(e) => update("exam3BronxHighA1cCount", e.target.value)}
              placeholder="Bronx A1c>=8 count"
              className="w-full rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm"
            />
            <textarea
              rows={2}
              value={answers.exam3BronxIds}
              onChange={(e) => update("exam3BronxIds", e.target.value)}
              placeholder="Comma-separated PT- IDs"
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
            {isSubmitting ? "Submitting + Grading..." : "Submit Extra Credit"}
          </button>
        </form>
      </section>

      {submitResult && (
        <section className="ehr-shell p-5 md:p-6 space-y-3">
          <h2 className="t-heading t-primary">Latest Extra Credit Result</h2>
          <p className="t-body t-secondary">
            Score: <strong>{submitResult.grade.overallScore}/100</strong> · Submission ID:{" "}
            <span className="font-mono">{submitResult.submission.id}</span>
          </p>
          <p className="t-caption t-secondary">
            Email forwarding: {submitResult.delivery.forwarded ? "sent" : "not sent"} ·{" "}
            {submitResult.delivery.message}
          </p>
          <div className="space-y-2">
            {submitResult.grade.exams.map((exam) => (
              <div
                key={exam.examId}
                className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[#122033]">{exam.title}</p>
                  <span className="text-sm font-semibold text-[#122033]">
                    {exam.score}/{exam.maxScore}
                  </span>
                </div>
                <p className="t-caption text-[#4c637f] mt-1">{exam.feedback}</p>
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
            <p className="t-caption font-semibold text-[#122033]">Average by Exam</p>
            {analytics.averageByExam.map((exam) => {
              const pct = exam.maxScore > 0 ? (exam.avgScore / exam.maxScore) * 100 : 0;
              return (
                <div key={exam.examId} className="rounded-lg border border-[#d6dfeb] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="t-caption font-semibold text-[#122033]">{exam.title}</p>
                    <p className="t-caption text-[#4c637f]">
                      {exam.avgScore.toFixed(1)}/{exam.maxScore}
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

          <div className="space-y-2">
            <p className="t-caption font-semibold text-[#122033]">Recent Submissions</p>
            {analytics.recent.length === 0 ? (
              <p className="t-caption t-secondary">No submissions yet.</p>
            ) : (
              <div className="space-y-1.5">
                {analytics.recent.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded border border-[#d6dfeb] bg-[#f8fbff] px-3 py-2"
                  >
                    <p className="t-caption text-[#122033]">
                      <span className="font-mono">{row.id}</span> · {row.student}
                    </p>
                    <p className="t-caption text-[#4c637f]">{row.overallScore}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] px-3 py-2.5">
      <p className="t-caption text-[#4c637f]">{label}</p>
      <p className="text-lg font-semibold text-[#122033]">{value}</p>
    </div>
  );
}
