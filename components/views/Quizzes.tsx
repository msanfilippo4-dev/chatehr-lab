"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog, InlineAlert, Panel, SimulationBadge, Status, type Tone } from "@/components/ui/primitives";
import { apiFetch, postJson } from "@/lib/api";
import { formatEt } from "@/lib/quiz-time";
import { QuestionList, ReviewList } from "./quiz/QuestionList";
import { QuizTaker } from "./quiz/QuizTaker";
import type { AttemptSummary, Feedback, QuizDetail, QuizList, QuizSummary, SubmitResult } from "./quiz/types";

/** Status chip text and tone for a week in the list. */
function windowChip(week: Pick<QuizSummary, "state" | "opensAt" | "closesAt" | "graded">): { label: string; tone: Tone } {
  if (week.state === "unavailable") return { label: "Not yet available", tone: "neutral" };
  if (week.state === "upcoming") return { label: `Opens ${formatEt(week.opensAt)}`, tone: "info" };
  if (week.state === "closed") return { label: "Closed", tone: "danger" };
  if (!week.graded) return { label: week.closesAt ? `Review, closes ${formatEt(week.closesAt)}` : "Review", tone: "info" };
  return { label: week.closesAt ? `Open, closes ${formatEt(week.closesAt)}` : "Open", tone: "good" };
}

function attemptsText(week: Pick<QuizSummary, "attemptsUsed" | "attemptsAllowed">) {
  return `${week.attemptsUsed} of ${week.attemptsAllowed ?? "unlimited"} attempt${week.attemptsAllowed === 1 ? "" : "s"}`;
}

function scoreTone(score: number | null): Tone {
  if (score == null) return "neutral";
  return score >= 70 ? "good" : "warn";
}

function lockedNote(feedback: Feedback) {
  if (feedback.unlocked) return "";
  if (feedback.rule === "after_submit") return "Correct answers and explanations appear after you submit.";
  if (feedback.unlocksAt) return `Correct answers and explanations appear after the quiz closes (${formatEt(feedback.unlocksAt, { zone: true })}).`;
  return "Correct answers and explanations appear after your final attempt.";
}

export function Quizzes({ readOnly }: { readOnly: boolean }) {
  const [list, setList] = useState<QuizList | null>(null);
  const [error, setError] = useState("");
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);

  const loadList = useCallback(async () => {
    try {
      setList(await apiFetch<QuizList>("/api/quizzes"));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Quizzes could not be loaded.");
    }
  }, []);

  const loadDetail = useCallback(async (week: number) => {
    try {
      setDetail(await apiFetch<QuizDetail>(`/api/quizzes/${week}`));
      setMessage("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Quiz could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function open(week: number) {
    setActiveWeek(week);
    setDetail(null);
    setResult(null);
    setMessage("");
    void loadDetail(week);
  }

  const finished = useCallback(async (payload: SubmitResult) => {
    setResult(payload);
    if (activeWeek != null) await loadDetail(activeWeek);
    await loadList();
  }, [activeWeek, loadDetail, loadList]);

  const stale = useCallback(async () => {
    if (activeWeek != null) await loadDetail(activeWeek);
    await loadList();
  }, [activeWeek, loadDetail, loadList]);

  if (error) {
    return (
      <Panel title="Quizzes" subtitle="Weekly knowledge checks">
        <InlineAlert tone="warn" title="Quizzes unavailable"><p>{error}</p></InlineAlert>
      </Panel>
    );
  }
  if (!list) {
    return (
      <Panel title="Quizzes" subtitle="Weekly knowledge checks">
        <p className="empty">Loading quizzes…</p>
      </Panel>
    );
  }

  return (
    <div className="grid assignment-layout">
      <Panel
        title="Weekly quizzes"
        subtitle="Graded quizzes: two attempts, highest kept, lowest graded week dropped. Review quizzes: unlimited attempts."
        actions={<SimulationBadge>Course assessment</SimulationBadge>}
      >
        <div className="assignment-list quiz-week-list">
          {list.weeks.map((week) => {
            const chip = windowChip(week);
            return (
              <button
                key={week.week}
                className={week.week === activeWeek ? "selected" : ""}
                aria-current={week.week === activeWeek ? "true" : undefined}
                onClick={() => open(week.week)}
              >
                <span className="assignment-number">W{week.week}</span>
                <span>
                  <strong>{week.title}</strong>
                  <small>
                    {week.graded ? "Graded" : "Review"}
                    {week.available ? ` · ${attemptsText(week)}` : ""}
                    {week.bestScore != null ? ` · best ${week.bestScore}%` : ""}
                  </small>
                  <span className="quiz-chips">
                    <Status tone={chip.tone}>{chip.label}</Status>
                    {week.inProgress && <Status tone="warn">In progress</Status>}
                  </span>
                </span>
                <Status tone={scoreTone(week.bestScore)}>{week.bestScore == null ? "—" : `${week.bestScore}%`}</Status>
              </button>
            );
          })}
        </div>
        <div className="assignment-summary">
          <strong>Quiz category</strong>
          <p>
            {list.category.score == null
              ? "No graded quiz has closed or been taken yet."
              : `${list.category.score}% so far: best attempt per graded week (${list.category.counted} counted)${list.category.droppedWeek ? `, week ${list.category.droppedWeek} dropped as your lowest` : ""}.`}
            {" "}Missed graded quizzes count as 0 once they close. Quizzes are 10% of the course grade.
          </p>
        </div>
      </Panel>

      <div className="stack">
        {activeWeek == null && (
          <Panel title="Choose a quiz">
            <p className="empty">Select a week. Graded quizzes open Monday at 9:00 PM ET after class and close Sunday at 11:59 PM ET.</p>
          </Panel>
        )}
        {activeWeek != null && !detail && (
          <Panel title={`Week ${activeWeek}`}>
            {message ? <InlineAlert tone="warn" title="Quiz unavailable"><p>{message}</p></InlineAlert> : <p className="empty">Loading quiz…</p>}
          </Panel>
        )}
        {detail && detail.week === activeWeek && (
          <QuizPanel
            key={detail.week}
            detail={detail}
            readOnly={readOnly}
            result={result}
            onReload={() => void stale()}
            onFinished={(payload) => void finished(payload)}
            onDismissResult={() => setResult(null)}
          />
        )}
      </div>
    </div>
  );
}

function QuizPanel({ detail, readOnly, result, onReload, onFinished, onDismissResult }: {
  detail: QuizDetail;
  readOnly: boolean;
  result: SubmitResult | null;
  onReload: () => void;
  onFinished: (result: SubmitResult) => void;
  onDismissResult: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [message, setMessage] = useState("");

  async function start() {
    setConfirmStart(false);
    setStarting(true);
    setMessage("");
    try {
      await postJson(`/api/quizzes/${detail.week}/start`, {});
      onReload();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The quiz could not be started.");
    } finally {
      setStarting(false);
    }
  }

  const chip = windowChip(detail);
  const subtitle = [
    detail.graded ? "Graded quiz" : "Ungraded review quiz",
    `${detail.questionCount} questions`,
    detail.timeLimitMin ? `${detail.timeLimitMin} minutes` : "untimed",
    attemptsText(detail),
  ].join(" · ");

  return (
    <>
      <Panel title={`Week ${detail.week}: ${detail.title}`} subtitle={subtitle}>
        <dl className="kv quiz-facts">
          <dt>Status</dt>
          <dd><Status tone={chip.tone}>{chip.label}</Status></dd>
          {detail.opensAt && (<><dt>Opens</dt><dd>{formatEt(detail.opensAt, { zone: true })}</dd></>)}
          {detail.closesAt && (<><dt>Closes</dt><dd>{formatEt(detail.closesAt, { zone: true })}{detail.closeOverridden ? " (your extension)" : ""}</dd></>)}
          <dt>Time limit</dt>
          <dd>
            {detail.timeLimitMin ? `${detail.timeLimitMin} minutes per attempt` : "None"}
            {detail.extraMinutes ? ` (includes ${detail.extraMinutes} extra minutes)` : ""}
          </dd>
          <dt>Best score</dt>
          <dd>{detail.bestScore == null ? "—" : `${detail.bestScore}%`}</dd>
        </dl>
        {detail.state === "unavailable" && <p className="empty">This week&apos;s quiz has not been published yet.</p>}
      </Panel>

      {detail.inProgress && (
        <Panel
          className="quiz-attempt-panel"
          title={`Attempt ${detail.inProgress.attempt}`}
          subtitle={detail.inProgress.expiresAt
            ? `Must be submitted by ${formatEt(detail.inProgress.expiresAt, { zone: true })}. The timer keeps running if you leave this page.`
            : "Untimed. Your answers are saved as you go."}
        >
          <QuizTaker key={detail.inProgress.attempt} week={detail.week} inProgress={detail.inProgress} readOnly={readOnly} onFinished={onFinished} onStale={onReload} />
        </Panel>
      )}

      {!detail.inProgress && result && (
        <ResultPanel result={result} detail={detail} onDismiss={onDismissResult} />
      )}

      {!detail.inProgress && !result && detail.fixedQuestions && (
        <FixedQuiz detail={detail} readOnly={readOnly} onFinished={onFinished} />
      )}

      {!detail.inProgress && !result && detail.mode === "drawn" && detail.canStart && (
        <Panel title={`Attempt ${detail.attemptsUsed + 1}`} subtitle="Questions are drawn at random from this week's pool">
          <ul className="quiz-rules">
            <li>{detail.questionCount} multiple-choice questions, all on one page; answers save automatically.</li>
            <li>
              {detail.startMinutes != null
                ? `You will have ${detail.startMinutes} minutes once you start${detail.timeLimitMin && detail.startMinutes < detail.timeLimitMin ? " (less than the full limit because the quiz closes soon)" : ""}. The clock keeps running if you close the page; unsubmitted answers are submitted when time runs out.`
                : "There is no time limit."}
            </li>
            <li>{detail.attemptsAllowed == null ? "Starting uses one attempt; review quizzes can be repeated." : `Starting uses one of your ${detail.attemptsAllowed} attempts. Your highest attempt counts.`}</li>
          </ul>
          <div className="button-row">
            <button className="primary" disabled={starting || readOnly} onClick={() => setConfirmStart(true)}>
              {starting ? "Starting…" : `Start attempt ${detail.attemptsUsed + 1}`}
            </button>
          </div>
          {readOnly && <p className="help">Preview mode: attempts are disabled.</p>}
          <ConfirmDialog
            open={confirmStart}
            title={`Start week ${detail.week} quiz?`}
            body={<p>{detail.startMinutes != null ? `The ${detail.startMinutes}-minute timer starts now and cannot be paused.` : "This attempt is untimed."} {detail.attemptsAllowed == null ? "" : `This uses attempt ${detail.attemptsUsed + 1} of ${detail.attemptsAllowed}.`}</p>}
            confirmLabel="Start now"
            onConfirm={() => void start()}
            onCancel={() => setConfirmStart(false)}
          />
        </Panel>
      )}

      {!detail.inProgress && !detail.canStart && detail.blockedReason && detail.state !== "unavailable" && (
        <InlineAlert tone={detail.state === "closed" ? "warn" : "info"} title={detail.blockedReason}>
          {detail.state === "upcoming" && <p>It opens {formatEt(detail.opensAt, { zone: true })}.</p>}
          {detail.state === "closed" && detail.graded && <p>Your best recorded score stands. Contact the instructor if you need an extension.</p>}
        </InlineAlert>
      )}

      {message && <p className="form-message error" role="alert">{message}</p>}

      {detail.attempts.length > 0 && <AttemptHistory detail={detail} />}
    </>
  );
}

function ResultPanel({ result, detail, onDismiss }: { result: SubmitResult; detail: QuizDetail; onDismiss: () => void }) {
  const title = `${result.autoSubmitted || result.status === "auto_submitted" ? "Time expired — attempt submitted" : "Attempt recorded"}: ${result.score}% (${result.correctCount} of ${result.total} correct)`;
  let remaining = "Review quizzes can be repeated.";
  if (result.attemptsRemaining != null) {
    remaining = result.attemptsRemaining > 0
      ? `${result.attemptsRemaining} attempt(s) remaining; your best score is ${result.bestScore}%.`
      : `No attempts remain; your best score is ${result.bestScore}%.`;
  }
  return (
    <Panel title={`Attempt ${result.attempt} results`} actions={<button onClick={onDismiss}>Back to quiz</button>}>
      <InlineAlert tone={result.score >= 70 ? "success" : "warn"} title={title}>
        <p>{remaining}{result.late ? " Recorded after the close time." : ""}</p>
      </InlineAlert>
      {result.review ? <ReviewList items={result.review} /> : <p className="help quiz-locked">{lockedNote(result.feedback ?? detail.feedback)}</p>}
    </Panel>
  );
}

function AttemptHistory({ detail }: { detail: QuizDetail }) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = detail.attempts.find((attempt) => attempt.attempt === open) ?? null;
  return (
    <Panel title="Your attempts" subtitle={detail.feedback.unlocked ? "Select an attempt to review answers and explanations" : lockedNote(detail.feedback)}>
      <table className="quiz-attempts">
        <caption className="sr-only">Attempts for week {detail.week}</caption>
        <thead>
          <tr><th scope="col">Attempt</th><th scope="col">Score</th><th scope="col">Submitted</th><th scope="col"><span className="sr-only">Review</span></th></tr>
        </thead>
        <tbody>
          {detail.attempts.map((attempt: AttemptSummary) => (
            <tr key={attempt.attempt}>
              <td>{attempt.attempt}</td>
              <td><strong>{attempt.score}%</strong> <small>{attempt.correctCount}/{attempt.total}</small></td>
              <td>
                {attempt.submittedAt ? formatEt(attempt.submittedAt) : "—"}
                {attempt.status === "auto_submitted" && <small>time expired</small>}
                {attempt.late && <small>late</small>}
              </td>
              <td>
                {attempt.review && (
                  <button className="text-button" aria-expanded={open === attempt.attempt} onClick={() => setOpen(open === attempt.attempt ? null : attempt.attempt)}>
                    {open === attempt.attempt ? "Hide review" : "Review"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown?.review && (
        <div className="quiz-review">
          <h3>Attempt {shown.attempt} review</h3>
          <ReviewList items={shown.review} />
        </div>
      )}
    </Panel>
  );
}

/** One-step quiz for legacy week 1 (fixed questions, no timer) or when timed quizzes are not enabled. */
function FixedQuiz({ detail, readOnly, onFinished }: { detail: QuizDetail; readOnly: boolean; onFinished: (result: SubmitResult) => void }) {
  const questions = detail.fixedQuestions ?? [];
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const unanswered = answers.filter((value) => value == null).length;

  async function submit() {
    setConfirm(false);
    setSubmitting(true);
    setMessage("");
    try {
      onFinished(await postJson<SubmitResult>(`/api/quizzes/${detail.week}`, { answers }));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestSubmit() {
    if (unanswered) {
      setMessage("Answer every question before submitting.");
      return;
    }
    setConfirm(true);
  }

  return (
    <Panel title={`Attempt ${detail.attemptsUsed + 1}`} subtitle={detail.attemptsAllowed == null ? "Answer every question, then submit" : `Answer every question, then submit. Attempt ${detail.attemptsUsed + 1} of ${detail.attemptsAllowed}.`}>
      <QuestionList
        name={`w${detail.week}fixed${detail.attemptsUsed + 1}`}
        questions={questions}
        answers={answers}
        disabled={submitting || readOnly}
        onAnswer={(index, option) => setAnswers(answers.map((value, i) => (i === index ? option : value)))}
      />
      <div className="button-row">
        <button className="primary" disabled={submitting || readOnly} onClick={requestSubmit}>{submitting ? "Submitting…" : "Submit attempt"}</button>
        <span className="help">{questions.length - unanswered} of {questions.length} answered</span>
      </div>
      {message && <p className="form-message error" role="alert">{message}</p>}
      <ConfirmDialog
        open={confirm}
        title={`Submit attempt ${detail.attemptsUsed + 1}?`}
        body={<p>You cannot change your answers after submitting.</p>}
        confirmLabel="Submit attempt"
        onConfirm={() => void submit()}
        onCancel={() => setConfirm(false)}
      />
    </Panel>
  );
}
