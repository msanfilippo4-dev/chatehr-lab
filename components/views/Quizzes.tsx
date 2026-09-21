"use client";

import { useCallback, useEffect, useState } from "react";
import { InlineAlert, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import { apiFetch, postJson } from "@/lib/api";
import { formatWhen } from "./shared";

interface QuizSummary { week: number; title: string; date: string; dueAt: string | null; graded: boolean; questionCount: number; attemptsUsed: number; attemptsAllowed: number; bestScore: number | null; closed: boolean; feedbackUnlocked: boolean; lastSubmittedAt: string | null }
interface QuizList { weeks: QuizSummary[]; category: { score: number | null; counted: number; dropped: number | null } }
interface QuizDetail {
  week: number; title: string; date: string; dueAt: string | null; graded: boolean;
  questions: { id: string; question: string; options: string[] }[];
  attempts: { attempt: number; score: number; correctCount: number; total: number; late: boolean; submittedAt: string; answers: (number | null)[] }[];
  attemptsAllowed: number; closed: boolean;
  feedback: { unlocked: boolean; items: { id: string; correct: number; rationale: string }[] };
}
const LETTERS = ["A", "B", "C", "D"];

export function Quizzes({ readOnly }: { readOnly: boolean }) {
  const [list, setList] = useState<QuizList | null>(null);
  const [error, setError] = useState("");
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null, null, null, null]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; correctCount: number; total: number; attemptsRemaining: number; bestScore: number; perQuestion?: { id: string; selected: number | null; correct: number; isCorrect: boolean }[] } | null>(null);
  const [message, setMessage] = useState("");

  const loadList = useCallback(async () => {
    try { setList(await apiFetch<QuizList>("/api/quizzes")); setError(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Quizzes could not be loaded."); }
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  async function open(week: number) {
    setActiveWeek(week); setResult(null); setMessage(""); setAnswers([null, null, null, null, null, null]);
    try { setDetail(await apiFetch<QuizDetail>(`/api/quizzes/${week}`)); } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Quiz could not be loaded."); }
  }

  async function submit() {
    if (!detail) return;
    if (answers.some((value) => value === null)) { setMessage("Answer every question before submitting."); return; }
    setSubmitting(true); setMessage("");
    try {
      const payload = await postJson<typeof result & { feedback: QuizDetail["feedback"] }>(`/api/quizzes/${detail.week}`, { answers });
      setResult(payload);
      const refreshed = await apiFetch<QuizDetail>(`/api/quizzes/${detail.week}`);
      setDetail(refreshed);
      await loadList();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Submission failed."); } finally { setSubmitting(false); }
  }

  if (error) return <Panel title="Quizzes" subtitle="Weekly knowledge checks"><InlineAlert tone="warn" title="Quizzes unavailable"><p>{error}</p></InlineAlert></Panel>;
  if (!list) return <Panel title="Quizzes" subtitle="Weekly knowledge checks"><p className="empty">Loading quizzes…</p></Panel>;

  const active = list.weeks.find((week) => week.week === activeWeek);
  const canAttempt = detail && !detail.closed && detail.attempts.length < detail.attemptsAllowed && !readOnly;
  const lastAttempt = detail?.attempts.at(-1);

  return <div className="grid assignment-layout">
    <Panel title="Weekly quizzes" subtitle="Six multiple-choice questions each · graded quizzes allow two attempts, the highest is kept, and the lowest graded quiz is dropped" actions={<SimulationBadge>Course assessment</SimulationBadge>}>
      <div className="assignment-list">{list.weeks.map((week) => <button className={week.week === activeWeek ? "selected" : ""} key={week.week} onClick={() => open(week.week)}><span className="assignment-number">W{week.week}</span><span><strong>{week.title}</strong><small>{week.graded ? "Graded" : "Review"} · {week.attemptsUsed}/{week.graded ? week.attemptsAllowed : "∞"} attempts{week.dueAt && week.graded ? ` · due ${new Date(week.dueAt).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "America/New_York" })}` : ""}</small></span><Status tone={week.bestScore == null ? (week.closed ? "danger" : "neutral") : week.bestScore >= 70 ? "good" : "warn"}>{week.bestScore == null ? (week.closed ? "Closed" : "Not taken") : `${week.bestScore}%`}</Status></button>)}</div>
      <div className="assignment-summary"><strong>Quiz category</strong><p>{list.category.score == null ? "No graded quiz has been taken yet." : `Best attempts of the six graded quizzes with the lowest dropped: ${list.category.score}% across ${list.category.counted} counted quiz(es).`} Quizzes are 10% of the course grade.</p></div>
    </Panel>
    <div className="stack">
      {!detail || !active ? <Panel title="Choose a quiz"><p className="empty">Select a week to see its questions. Review quizzes can be repeated; graded quizzes close at the Sunday deadline.</p></Panel> : <>
        <Panel title={`Week ${detail.week}: ${detail.title}`} subtitle={`${detail.graded ? "Graded quiz" : "Ungraded review quiz"} · ${detail.questions.length} questions · attempts used ${detail.attempts.length} of ${detail.graded ? detail.attemptsAllowed : "unlimited"}${detail.dueAt && detail.graded ? ` · due ${formatWhen(detail.dueAt)}` : ""}`}>
          {detail.closed && <InlineAlert tone="warn" title="This quiz is closed"><p>The due date has passed. Your best recorded score stands.</p></InlineAlert>}
          {detail.attempts.length > 0 && <div className="assignment-header">{detail.attempts.map((attempt) => <div key={attempt.attempt}><span>Attempt {attempt.attempt}</span><strong>{attempt.score}% · {attempt.correctCount}/{attempt.total}</strong><small>{formatWhen(attempt.submittedAt)}{attempt.late ? " · late" : ""}</small></div>)}</div>}
          {result && <InlineAlert tone={result.score >= 70 ? "success" : "warn"} title={`Attempt recorded: ${result.score}% (${result.correctCount} of ${result.total} correct)`}><p>{result.attemptsRemaining > 0 ? `${result.attemptsRemaining} attempt(s) remaining; your best score is ${result.bestScore}%.` : detail.graded ? `No attempts remain; your best score is ${result.bestScore}%.` : "Review quizzes can be repeated."}</p></InlineAlert>}
        </Panel>
        <Panel title={canAttempt ? `Attempt ${detail.attempts.length + 1}` : "Questions"} subtitle={detail.feedback.unlocked ? "Correct answers and explanations are shown below" : detail.graded ? "Explanations unlock after your final attempt or the due date" : "Explanations appear after each attempt"}>
          <ol className="quiz-list">{detail.questions.map((question, index) => {
            const fb = detail.feedback.items.find((item) => item.id === question.id);
            const chosen = canAttempt ? answers[index] : (lastAttempt?.answers[index] ?? null);
            return <li key={question.id} className="quiz-item"><p className="quiz-stem">{question.question}</p>
              <div className="quiz-options">{question.options.map((option, optionIndex) => {
                const isCorrect = fb ? fb.correct === optionIndex : null;
                const cls = ["quiz-option", chosen === optionIndex ? "chosen" : "", isCorrect === true ? "correct" : "", fb && chosen === optionIndex && isCorrect === false ? "wrong" : ""].join(" ");
                return <label key={optionIndex} className={cls}><input type="radio" name={question.id} disabled={!canAttempt} checked={chosen === optionIndex} onChange={() => setAnswers(answers.map((value, i) => (i === index ? optionIndex : value)))} /><span className="quiz-letter">{LETTERS[optionIndex]}</span><span>{option}</span></label>;
              })}</div>
              {fb && <p className="quiz-rationale"><strong>Answer {LETTERS[fb.correct]}.</strong> {fb.rationale}</p>}
            </li>;
          })}</ol>
          {canAttempt && <div className="button-row"><button className="primary" disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit attempt"}</button></div>}
          {message && <p className="form-message error" role="status">{message}</p>}
        </Panel>
      </>}
    </div>
  </div>;
}
