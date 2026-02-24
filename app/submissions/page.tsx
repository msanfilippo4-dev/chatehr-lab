"use client";
import React, { useMemo, useState } from "react";

type Answers = {
  q1: string;
  q2: string;
  q3: string;
};

type EvaluationResponse = {
  submittedAt: string;
  benchmark: {
    overallScore: number;
    perQuestion: Array<{
      id: keyof Answers;
      title: string;
      score: number;
      matchedConcepts: string[];
      missingConcepts: string[];
    }>;
  };
  judge: {
    overallFeedback: string;
    strengths: string[];
    improvements: string[];
    perQuestion: Array<{ id: keyof Answers; feedback: string }>;
    model: string | null;
  };
};

const INITIAL_ANSWERS: Answers = {
  q1: "",
  q2: "",
  q3: "",
};

const QUESTIONS: Array<{ id: keyof Answers; title: string; prompt: string }> = [
  {
    id: "q1",
    title: "Q1. Medication Safety + Evidence",
    prompt:
      "From one directed case, identify one unsafe recommendation risk and propose one mitigation. Cite chart evidence (labs, meds, or history).",
  },
  {
    id: "q2",
    title: "Q2. RAG Impact",
    prompt:
      "Compare the same clinical question with RAG OFF vs RAG ON. What changed in specificity, grounding, and uncertainty language?",
  },
  {
    id: "q3",
    title: "Q3. Minimum Necessary Privacy Decision",
    prompt:
      "For your use case, choose LIMITED, STANDARD, or FULL context. Explain your tradeoff between privacy and clinical usefulness.",
  },
];

export default function SubmissionsPage() {
  const [teamName, setTeamName] = useState("");
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResponse | null>(null);

  const completeness = useMemo(() => {
    const filled = QUESTIONS.filter((q) => answers[q.id].trim().length > 0).length;
    return `${filled}/${QUESTIONS.length}`;
  }, [answers]);

  const onAnswerChange = (id: keyof Answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!answers.q1.trim() || !answers.q2.trim() || !answers.q3.trim()) {
      setError("Please answer all three benchmark questions.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/submissions/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: teamName.trim(),
          answers,
        }),
      });
      const data = (await res.json()) as EvaluationResponse & { error?: string };
      if (!res.ok) {
        setError(data.error || "Unable to evaluate submission right now.");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error while evaluating submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="ehr-shell p-5 md:p-6">
        <h1 className="text-2xl font-semibold text-[#122033]">
          Student Submission + Benchmark
        </h1>
        <p className="t-body t-secondary mt-2">
          Submit concise answers to standard lab prompts. You will receive:
          1) benchmark coverage score against hidden ground-truth concepts and 2)
          LLM-as-a-judge formative feedback.
        </p>
        <p className="t-caption t-secondary mt-2">
          This is a learning aid, not a clinical decision system and not a
          grading replacement.
        </p>
      </section>

      <section className="ehr-shell p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="t-heading t-primary">Submission Form</h2>
          <span className="t-caption t-secondary">Completion: {completeness}</span>
        </div>

        <form className="mt-3 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="block t-caption font-semibold text-[#122033] mb-1.5">
              Team / Group Name (optional)
            </span>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Example: Group A"
              className="w-full rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm text-[#122033] focus:outline-none focus:ring-2 focus:ring-[#8C1515]/60"
            />
          </label>

          {QUESTIONS.map((q) => (
            <label className="block" key={q.id}>
              <span className="block t-caption font-semibold text-[#122033] mb-1.5">
                {q.title}
              </span>
              <p className="t-caption text-[#4c637f] mb-2">{q.prompt}</p>
              <textarea
                value={answers[q.id]}
                onChange={(e) => onAnswerChange(q.id, e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-[#d6dfeb] bg-white px-3 py-2 text-sm text-[#122033] focus:outline-none focus:ring-2 focus:ring-[#8C1515]/60 resize-y"
                placeholder="Write a concise, evidence-based response..."
              />
            </label>
          ))}

          {error && (
            <p className="t-caption text-[#8C1515] border border-[#f0c4c4] bg-[#fff6f6] rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-[#8C1515] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#6B1010] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Evaluating Submission..." : "Submit for Benchmark + Judge Feedback"}
          </button>
        </form>
      </section>

      {result && (
        <section className="ehr-shell p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="t-heading t-primary">Evaluation Results</h2>
            <span className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] px-3 py-1.5 text-sm font-semibold text-[#122033]">
              Benchmark Score: {result.benchmark.overallScore}%
            </span>
          </div>
          <p className="t-caption t-secondary">
            Submitted: {new Date(result.submittedAt).toLocaleString()}
            {result.judge.model ? ` · Judge Model: ${result.judge.model}` : ""}
          </p>

          <div className="space-y-3">
            {result.benchmark.perQuestion.map((q) => {
              const judgeText =
                result.judge.perQuestion.find((p) => p.id === q.id)?.feedback || "";
              return (
                <div
                  key={q.id}
                  className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#122033]">{q.title}</p>
                    <span className="text-sm font-semibold text-[#122033]">{q.score}%</span>
                  </div>
                  <p className="t-caption text-[#4c637f] mt-1">{judgeText}</p>
                  <p className="t-micro text-[#546a88] mt-2">
                    Matched concepts: {q.matchedConcepts.length} · Missing concepts:{" "}
                    {q.missingConcepts.length}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
              <p className="font-semibold text-[#122033]">Strengths</p>
              <ul className="list-disc pl-5 mt-1.5 t-caption text-[#4c637f] space-y-1">
                {result.judge.strengths.length > 0 ? (
                  result.judge.strengths.map((item, idx) => <li key={idx}>{item}</li>)
                ) : (
                  <li>No major strengths detected yet. Add more chart-grounded detail.</li>
                )}
              </ul>
            </div>
            <div className="rounded-lg border border-[#d6dfeb] bg-[#f8fbff] p-3">
              <p className="font-semibold text-[#122033]">Improvements</p>
              <ul className="list-disc pl-5 mt-1.5 t-caption text-[#4c637f] space-y-1">
                {result.judge.improvements.length > 0 ? (
                  result.judge.improvements.map((item, idx) => <li key={idx}>{item}</li>)
                ) : (
                  <li>No specific improvements detected.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-[#d6dfeb] bg-white p-3">
            <p className="font-semibold text-[#122033]">Overall Judge Feedback</p>
            <p className="t-caption text-[#4c637f] mt-1.5">{result.judge.overallFeedback}</p>
          </div>
        </section>
      )}
    </div>
  );
}
