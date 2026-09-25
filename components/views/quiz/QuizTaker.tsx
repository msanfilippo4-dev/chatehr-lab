"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog, InlineAlert } from "@/components/ui/primitives";
import { apiFetch, postJson } from "@/lib/api";
import { formatCountdown, spokenDuration } from "@/lib/quiz-time";
import { QuestionList } from "./QuestionList";
import type { InProgress, SubmitResult } from "./types";

const WARNING_SECONDS = 120;
const ANNOUNCE_AT = [300, 60];
const AUTOSAVE_DELAY_MS = 600;

type SaveState = "idle" | "saving" | "saved" | "error";

interface AutosaveResponse {
  saved: boolean;
  finalized: boolean;
  savedAt?: string;
}

/**
 * A timed, drawn attempt. The countdown is anchored to the server's remaining
 * seconds (not the browser clock), answers autosave, and the attempt is
 * submitted automatically when time runs out.
 */
export function QuizTaker({ week, inProgress, readOnly, onFinished, onStale }: {
  week: number;
  inProgress: InProgress;
  readOnly: boolean;
  onFinished: (result: SubmitResult) => void;
  /** The attempt was finalized elsewhere (another tab, or expiry); reload the quiz. */
  onStale: () => void;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(inProgress.answers);
  const answersRef = useRef(answers);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [message, setMessage] = useState("");
  const autoSubmitted = useRef(false);
  // Keep the latest callbacks without re-creating the timer effect on every render.
  const onFinishedRef = useRef(onFinished);
  const onStaleRef = useRef(onStale);
  useEffect(() => {
    onFinishedRef.current = onFinished;
    onStaleRef.current = onStale;
  });

  const initialRemaining = inProgress.remainingSeconds;
  const deadline = useRef<number | null>(initialRemaining == null ? null : Date.now() + initialRemaining * 1000);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(initialRemaining);
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef(new Set(ANNOUNCE_AT.filter((threshold) => initialRemaining != null && initialRemaining <= threshold)));

  const save = useCallback(async () => {
    if (readOnly) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSaveState("saving");
    try {
      const response = await apiFetch<AutosaveResponse>(`/api/quizzes/${week}`, {
        method: "PATCH",
        body: JSON.stringify({ attempt: inProgress.attempt, answers: answersRef.current }),
      });
      if (response.finalized) {
        onStaleRef.current();
        return;
      }
      setSaveState("saved");
      setSavedAt(response.savedAt ?? new Date().toISOString());
    } catch {
      setSaveState("error");
    }
  }, [week, inProgress.attempt, readOnly]);

  const submit = useCallback(async (automatic: boolean) => {
    if (submittingRef.current || readOnly) return;
    submittingRef.current = true;
    setSubmitting(true);
    setConfirmOpen(false);
    setMessage(automatic ? "Time is up. Submitting your answers…" : "");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      const result = await postJson<SubmitResult>(`/api/quizzes/${week}`, { attempt: inProgress.attempt, answers: answersRef.current });
      onFinishedRef.current(result);
    } catch (caught) {
      submittingRef.current = false;
      setSubmitting(false);
      const detail = caught instanceof Error ? caught.message : "Submission failed.";
      setMessage(automatic
        ? `Time is up. ${detail} Your last saved answers will be submitted automatically; reload the quiz in a moment to see your score.`
        : `${detail} Your answers are saved; try again.`);
    }
  }, [week, inProgress.attempt, readOnly]);

  // Countdown, screen-reader announcements, and automatic submission.
  useEffect(() => {
    if (deadline.current == null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline.current! - Date.now()) / 1000));
      setSecondsLeft(left);
      for (const threshold of ANNOUNCE_AT) {
        if (left <= threshold && !announced.current.has(threshold)) {
          announced.current.add(threshold);
          setAnnouncement(`${spokenDuration(threshold)} remaining.`);
        }
      }
      if (left <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        void submit(true);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [submit]);

  // Flush a pending autosave when this view unmounts (another week is opened)
  // or the page is hidden/closed, so the last answer is not lost.
  useEffect(() => {
    const flush = () => {
      if (!saveTimer.current || readOnly) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      void fetch(`/api/quizzes/${week}`, {
        method: "PATCH",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt: inProgress.attempt, answers: answersRef.current }),
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [week, inProgress.attempt, readOnly]);

  function answer(index: number, option: number) {
    const next = answersRef.current.map((value, i) => (i === index ? option : value));
    answersRef.current = next;
    setAnswers(next);
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
  }

  const unanswered = answers.filter((value) => value == null).length;
  const warning = secondsLeft != null && secondsLeft <= WARNING_SECONDS;

  return (
    <div className="quiz-taking">
      <div className={`quiz-toolbar${warning ? " warning" : ""}`}>
        {secondsLeft == null ? (
          <span className="quiz-timer untimed">Untimed</span>
        ) : (
          <span className="quiz-timer" role="timer" aria-label={`Time remaining: ${spokenDuration(secondsLeft)}`}>
            <span aria-hidden="true">{formatCountdown(secondsLeft)}</span>
            <small aria-hidden="true">{warning ? "left — submit soon" : "left"}</small>
          </span>
        )}
        <span className="quiz-progress">{answers.length - unanswered} of {answers.length} answered</span>
        <span className={`quiz-autosave ${saveState}`}>
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && `Saved${savedAt ? ` ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : ""}`}
          {saveState === "error" && <span role="alert">Not saved — check your connection</span>}
          {saveState === "idle" && "Answers save automatically"}
        </span>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      <QuestionList name={`w${week}a${inProgress.attempt}`} questions={inProgress.questions} answers={answers} disabled={submitting || readOnly} onAnswer={answer} />

      {message && <InlineAlert tone="warn" title="Submission">{<p>{message}</p>}</InlineAlert>}
      <div className="button-row">
        <button className="primary" disabled={submitting || readOnly} onClick={() => setConfirmOpen(true)}>
          {submitting ? "Submitting…" : "Submit attempt"}
        </button>
        {saveState === "error" && <button onClick={() => void save()}>Retry save</button>}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Submit attempt ${inProgress.attempt}?`}
        body={
          <p>
            {unanswered
              ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered and will be marked incorrect. `
              : "All questions are answered. "}
            You cannot change your answers after submitting.
          </p>
        }
        confirmLabel="Submit attempt"
        onConfirm={() => void submit(false)}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
