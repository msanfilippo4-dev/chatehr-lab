import bankJson from "./quiz-bank.json";
import type { AdminClient } from "./course-db";
import { ApiError } from "./errors";

export interface QuizItem { id: string; question: string; options: string[]; correct: number; rationale: string; kind: string | null; objective: string | null }
export interface QuizWeek { week: number; title: string; date: string; dueAt: string | null; graded: boolean; items: QuizItem[] }

export const GRADED_ATTEMPTS = 2;
export const REVIEW_ATTEMPTS = 20;

const bank = bankJson as { generatedAt: string; weeks: QuizWeek[] };

export function quizWeeks(): QuizWeek[] {
  return bank.weeks;
}

export function quizWeek(week: number): QuizWeek {
  const found = bank.weeks.find((item) => item.week === week);
  if (!found) throw new ApiError(404, "That quiz does not exist.", "NOT_FOUND");
  return found;
}

export function attemptsAllowed(week: QuizWeek) {
  return week.graded ? GRADED_ATTEMPTS : REVIEW_ATTEMPTS;
}

export function isClosed(week: QuizWeek, now = Date.now()) {
  return week.graded && Boolean(week.dueAt) && Date.parse(week.dueAt!) < now;
}

/** Questions without answers or rationales, for the student view. */
export function studentQuestions(week: QuizWeek) {
  return week.items.map((item) => ({ id: item.id, question: item.question, options: item.options }));
}

export function score(week: QuizWeek, answers: (number | null)[]) {
  const detail = week.items.map((item, index) => ({ id: item.id, selected: answers[index] ?? null, correct: item.correct, isCorrect: answers[index] === item.correct }));
  const correctCount = detail.filter((row) => row.isCorrect).length;
  return { detail, correctCount, total: week.items.length, percent: Math.round((correctCount / week.items.length) * 10000) / 100 };
}

export interface AttemptRow { id: string; week: number; attempt: number; answers: (number | null)[]; correct_count: number; total: number; score: number; late: boolean; submitted_at: string }

export async function loadAttempts(admin: AdminClient, email: string, week?: number): Promise<AttemptRow[]> {
  let query = admin.from("ehr_quiz_attempts").select("id,week,attempt,answers,correct_count,total,score,late,submitted_at").eq("email", email).order("week").order("attempt");
  if (week) query = query.eq("week", week);
  const { data, error } = await query;
  if (error) {
    if (/ehr_quiz_attempts/.test(error.message)) throw new ApiError(503, "Quizzes are not enabled yet: the quiz table has not been created.", "NOT_MIGRATED");
    throw error;
  }
  return (data ?? []).map((row) => ({ ...row, score: Number(row.score) }));
}

/** Whether full feedback (correct answers and rationales) may be shown to the student. */
export function feedbackUnlocked(week: QuizWeek, attemptsUsed: number, now = Date.now()) {
  if (!week.graded) return attemptsUsed > 0;
  return attemptsUsed >= GRADED_ATTEMPTS || isClosed(week, now);
}

export function bestScore(attempts: AttemptRow[]) {
  return attempts.length ? Math.max(...attempts.map((row) => row.score)) : null;
}

/** Category score: best attempt per graded week, lowest graded week dropped, mean of the rest. */
export function quizCategoryScore(attemptsByWeek: Map<number, AttemptRow[]>, weeks: QuizWeek[]) {
  const graded = weeks.filter((week) => week.graded);
  const scores = graded.map((week) => bestScore(attemptsByWeek.get(week.week) ?? []) ?? 0);
  if (!scores.length) return { score: null, counted: 0, dropped: null as number | null };
  const sorted = [...scores].sort((a, b) => a - b);
  const dropped = sorted[0];
  const kept = sorted.slice(1);
  const mean = kept.length ? kept.reduce((sum, value) => sum + value, 0) / kept.length : sorted[0];
  return { score: Math.round(mean * 100) / 100, counted: kept.length, dropped };
}
