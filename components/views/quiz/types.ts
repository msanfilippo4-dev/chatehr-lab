/** Client-side shapes of the /api/quizzes responses. */

export type WindowState = "unavailable" | "upcoming" | "open" | "closed";
export type AttemptStatus = "in_progress" | "submitted" | "auto_submitted";

export interface QuizSummary {
  week: number;
  title: string;
  date: string;
  graded: boolean;
  available: boolean;
  legacy: boolean;
  mode: "fixed" | "drawn";
  state: WindowState;
  opensAt: string | null;
  closesAt: string | null;
  timeLimitMin: number | null;
  extraMinutes: number;
  closeOverridden: boolean;
  questionCount: number;
  attemptsUsed: number;
  attemptsAllowed: number | null;
  bestScore: number | null;
  inProgress: boolean;
  canStart: boolean;
  blockedReason: string | null;
  feedbackUnlocked: boolean;
  lastSubmittedAt: string | null;
}

export interface CategoryScore {
  score: number | null;
  counted: number;
  dropped: number | null;
  droppedWeek: number | null;
}

export interface QuizList {
  weeks: QuizSummary[];
  category: CategoryScore;
  windowsEnabled: boolean;
  serverNow: string;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
}

export interface ReviewItem extends Question {
  selected: number | null;
  correct: number;
  isCorrect: boolean;
  rationale: string;
  book: string | null;
}

export interface AttemptSummary {
  attempt: number;
  status: AttemptStatus;
  score: number;
  correctCount: number;
  total: number;
  late: boolean;
  startedAt: string | null;
  submittedAt: string | null;
  review: ReviewItem[] | null;
}

export interface InProgress {
  attempt: number;
  startedAt: string | null;
  expiresAt: string | null;
  remainingSeconds: number | null;
  timeLimitMin: number | null;
  questions: Question[];
  answers: (number | null)[];
}

export interface Feedback {
  unlocked: boolean;
  unlocksAt: string | null;
  rule: "after_close" | "after_submit";
}

export interface QuizDetail extends Omit<QuizSummary, "inProgress"> {
  feedback: Feedback;
  attempts: AttemptSummary[];
  inProgress: InProgress | null;
  fixedQuestions: Question[] | null;
  startMinutes: number | null;
  serverNow: string;
}

export interface SubmitResult {
  attempt: number;
  status: AttemptStatus;
  score: number;
  correctCount: number;
  total: number;
  late: boolean;
  attemptsRemaining: number | null;
  bestScore: number | null;
  feedback: Feedback;
  review: ReviewItem[] | null;
  alreadySubmitted?: boolean;
  autoSubmitted?: boolean;
}

export const LETTERS = ["A", "B", "C", "D", "E", "F"];
