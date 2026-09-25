/**
 * Weekly quiz policy: bank loading, effective settings, random draws, option
 * shuffling, scoring, feedback gating, and the quiz category score.
 *
 * Everything in this file is pure (no database access) so it can be unit tested.
 * Database reads and writes live in quiz-store.ts.
 */
import { randomInt } from "node:crypto";
import bankJson from "./quiz-bank.json";
import { ApiError } from "./errors";

// ---------------------------------------------------------------- types

export interface QuizItem {
  id: string;
  question: string;
  options: string[];
  correct: number;
  rationale: string;
  kind: string | null;
  objective: string | null;
  book?: string | null;
}

export interface QuizWeek {
  week: number;
  title: string;
  date: string;
  graded: boolean;
  /** Legacy weeks keep the original fixed six items, fixed order, no timer. */
  legacy: boolean;
  opensAt: string | null;
  dueAt: string | null;
  draw: number | null;
  timeLimitMin: number | null;
  items: QuizItem[];
}

export interface QuizPolicy {
  draw: number;
  timeLimitMin: number;
  gradedAttempts: number;
}

export type ShowAnswers = "after_close" | "after_submit";
export type QuizMode = "fixed" | "drawn";
export type AttemptStatus = "in_progress" | "submitted" | "auto_submitted";
export type WindowState = "unavailable" | "upcoming" | "open" | "closed";

/** A row of ehr_quiz_settings. Null columns mean "use the bank default". */
export interface QuizSettingsRow {
  week: number;
  opens_at: string | null;
  closes_at: string | null;
  /** 0 means untimed. */
  time_limit_min: number | null;
  draw_count: number | null;
  /** 0 means unlimited. */
  attempts_allowed: number | null;
  show_answers: ShowAnswers | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

/** A row of ehr_quiz_extensions (one per student per week). */
export interface QuizExtensionRow {
  email: string;
  week: number;
  extra_minutes: number;
  closes_at_override: string | null;
  reason: string | null;
  created_by?: string | null;
  created_at?: string | null;
}

export interface AttemptRow {
  id: string;
  week: number;
  attempt: number;
  /** Final answers, aligned to the attempt's items, in ORIGINAL option index order. */
  answers: (number | null)[];
  correct_count: number;
  total: number;
  score: number;
  late: boolean;
  started_at: string | null;
  submitted_at: string | null;
  status: AttemptStatus;
  drawn_item_ids: string[] | null;
  /** option_orders[i][displayed] = original option index for item i. */
  option_orders: number[][] | null;
  /** Autosaved answers in ORIGINAL option index order. */
  saved_answers: (number | null)[] | null;
  expires_at: string | null;
}

/** Effective quiz configuration for the whole class (bank defaults + settings row). */
export interface EffectiveQuiz {
  week: number;
  title: string;
  date: string;
  graded: boolean;
  available: boolean;
  legacy: boolean;
  mode: QuizMode;
  opensAt: string | null;
  closesAt: string | null;
  /** Null means untimed. */
  timeLimitMin: number | null;
  drawCount: number;
  poolSize: number;
  /** Null means unlimited. */
  attemptsAllowed: number | null;
  showAnswers: ShowAnswers;
  /** Setting names overridden by the instructor's settings row. */
  overridden: string[];
}

/** Effective configuration for one student (class settings + that student's extension). */
export interface StudentQuiz extends EffectiveQuiz {
  extraMinutes: number;
  closeOverridden: boolean;
}

// ---------------------------------------------------------------- constants

export const COURSE_WEEKS = 12;
/** Graded weeks per the syllabus. */
export const GRADED_WEEKS = [1, 3, 4, 6, 7, 9];
/** Review weeks allow unlimited attempts; this is only a safety cap per request burst. */
export const REVIEW_ATTEMPTS: number | null = null;
/** Seconds after expires_at during which a manual submit is still accepted. */
export const SUBMIT_GRACE_SECONDS = 30;
const FIRST_SESSION = "2026-09-21";

interface RawBank {
  generatedAt: string;
  source?: string;
  policy?: Partial<QuizPolicy>;
  weeks: (Partial<QuizWeek> & { week: number; title: string; date: string; graded: boolean; items: QuizItem[] })[];
}

const rawBank = bankJson as unknown as RawBank;

export const QUIZ_POLICY: QuizPolicy = {
  draw: rawBank.policy?.draw ?? 6,
  timeLimitMin: rawBank.policy?.timeLimitMin ?? 15,
  gradedAttempts: rawBank.policy?.gradedAttempts ?? 2,
};
export const GRADED_ATTEMPTS = QUIZ_POLICY.gradedAttempts;

function normalizeWeek(raw: RawBank["weeks"][number]): QuizWeek {
  return {
    week: raw.week,
    title: raw.title,
    date: raw.date,
    graded: raw.graded,
    legacy: Boolean(raw.legacy),
    opensAt: raw.opensAt ?? null,
    dueAt: raw.dueAt ?? null,
    draw: raw.draw ?? null,
    timeLimitMin: raw.timeLimitMin ?? null,
    items: raw.items.map((item) => ({ ...item, kind: item.kind ?? null, objective: item.objective ?? null, book: item.book ?? null })),
  };
}

const BANK_WEEKS: QuizWeek[] = rawBank.weeks.map(normalizeWeek).sort((a, b) => a.week - b.week);

// ---------------------------------------------------------------- bank access

/** Weeks present in the imported bank (others are "not yet available"). */
export function quizWeeks(): QuizWeek[] {
  return BANK_WEEKS;
}

export function bankWeek(week: number): QuizWeek | null {
  return BANK_WEEKS.find((item) => item.week === week) ?? null;
}

/** A week that exists in the bank; 404 otherwise. */
export function quizWeek(week: number): QuizWeek {
  const found = bankWeek(week);
  if (!found) throw new ApiError(404, "That quiz is not available yet.", "NOT_FOUND");
  return found;
}

export function parseWeekParam(value: string): number {
  const week = Number(value);
  if (!Number.isInteger(week) || week < 1 || week > COURSE_WEEKS) throw new ApiError(404, "That quiz does not exist.", "NOT_FOUND");
  return week;
}

export function isGradedWeek(week: number) {
  return bankWeek(week)?.graded ?? GRADED_WEEKS.includes(week);
}

/** Graded week numbers per the syllabus plus any graded week in the bank. */
export function gradedWeekNumbers(): number[] {
  const set = new Set(GRADED_WEEKS);
  for (const week of BANK_WEEKS) {
    if (week.graded) set.add(week.week);
    else set.delete(week.week);
  }
  return [...set].sort((a, b) => a - b);
}

// ---------------------------------------------------------------- calendar

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Eastern offset for a Fall 2026 calendar date (DST ends Sunday November 1, 2026). */
function etOffset(date: string) {
  return date < "2026-11-01" ? "-04:00" : "-05:00";
}

/** Monday class date for a course week. */
export function sessionDate(week: number) {
  return addDays(FIRST_SESSION, 7 * (week - 1));
}

/** Default window: opens Monday 9:00 pm ET after class, closes Sunday 11:59 pm ET. */
export function defaultWindow(week: number) {
  const monday = sessionDate(week);
  const sunday = addDays(monday, 6);
  return { opensAt: `${monday}T21:00:00${etOffset(monday)}`, closesAt: `${sunday}T23:59:00${etOffset(sunday)}` };
}

// ---------------------------------------------------------------- effective settings

/** Bank defaults for a week, before any instructor settings row. */
export function quizDefaults(weekNumber: number, windowsEnabled: boolean): EffectiveQuiz {
  const week = bankWeek(weekNumber);
  const graded = isGradedWeek(weekNumber);
  const fallbackWindow = defaultWindow(weekNumber);
  const showAnswers: ShowAnswers = graded ? "after_close" : "after_submit";
  const attemptsAllowed = graded ? QUIZ_POLICY.gradedAttempts : REVIEW_ATTEMPTS;
  if (!week) {
    return {
      week: weekNumber,
      title: `Week ${weekNumber} quiz`,
      date: sessionDate(weekNumber),
      graded,
      available: false,
      legacy: false,
      mode: windowsEnabled ? "drawn" : "fixed",
      opensAt: fallbackWindow.opensAt,
      closesAt: graded ? fallbackWindow.closesAt : null,
      timeLimitMin: windowsEnabled && graded ? QUIZ_POLICY.timeLimitMin : null,
      drawCount: QUIZ_POLICY.draw,
      poolSize: 0,
      attemptsAllowed,
      showAnswers,
      overridden: [],
    };
  }
  if (week.legacy) {
    return {
      week: week.week,
      title: week.title,
      date: week.date,
      graded,
      available: true,
      legacy: true,
      mode: "fixed",
      opensAt: week.opensAt,
      closesAt: graded ? week.dueAt : null,
      timeLimitMin: null,
      drawCount: week.items.length,
      poolSize: week.items.length,
      attemptsAllowed,
      showAnswers,
      overridden: [],
    };
  }
  const draw = Math.min(week.draw ?? QUIZ_POLICY.draw, week.items.length);
  return {
    week: week.week,
    title: week.title,
    date: week.date,
    graded,
    available: true,
    legacy: false,
    mode: windowsEnabled ? "drawn" : "fixed",
    opensAt: week.opensAt,
    // Review quizzes stay open for exam preparation; graded quizzes close at the due date.
    closesAt: graded ? week.dueAt : null,
    timeLimitMin: windowsEnabled ? (week.timeLimitMin ?? null) : null,
    drawCount: draw,
    poolSize: week.items.length,
    attemptsAllowed,
    showAnswers,
    overridden: [],
  };
}

/**
 * Bank defaults overridden by the instructor's settings row. Legacy weeks ignore
 * draw count and time limit so existing attempts stay aligned.
 */
export function effectiveQuiz(weekNumber: number, settings: QuizSettingsRow | null | undefined, windowsEnabled: boolean): EffectiveQuiz {
  const base = quizDefaults(weekNumber, windowsEnabled);
  if (!settings || !windowsEnabled) return base;
  const result: EffectiveQuiz = { ...base, overridden: [] };
  if (settings.opens_at) {
    result.opensAt = settings.opens_at;
    result.overridden.push("opensAt");
  }
  if (settings.closes_at) {
    result.closesAt = settings.closes_at;
    result.overridden.push("closesAt");
  }
  if (settings.attempts_allowed != null) {
    result.attemptsAllowed = settings.attempts_allowed === 0 ? null : settings.attempts_allowed;
    result.overridden.push("attemptsAllowed");
  }
  if (settings.show_answers) {
    result.showAnswers = settings.show_answers;
    result.overridden.push("showAnswers");
  }
  if (!base.legacy) {
    if (settings.time_limit_min != null) {
      result.timeLimitMin = settings.time_limit_min === 0 ? null : settings.time_limit_min;
      result.overridden.push("timeLimitMin");
    }
    if (settings.draw_count != null) {
      const pool = base.poolSize || settings.draw_count;
      result.drawCount = Math.max(1, Math.min(settings.draw_count, pool));
      result.overridden.push("drawCount");
    }
  }
  return result;
}

/** Apply one student's extension: extra minutes on the timer and/or a later close. */
export function studentQuiz(quiz: EffectiveQuiz, extension: QuizExtensionRow | null | undefined): StudentQuiz {
  const extraMinutes = Math.max(0, extension?.extra_minutes ?? 0);
  const closeOverride = extension?.closes_at_override ?? null;
  return {
    ...quiz,
    closesAt: closeOverride ?? quiz.closesAt,
    timeLimitMin: quiz.timeLimitMin == null ? null : quiz.timeLimitMin + extraMinutes,
    extraMinutes,
    closeOverridden: Boolean(closeOverride),
  };
}

export function windowState(quiz: EffectiveQuiz, now = Date.now()): WindowState {
  if (!quiz.available) return "unavailable";
  if (quiz.opensAt && now < Date.parse(quiz.opensAt)) return "upcoming";
  if (quiz.closesAt && now > Date.parse(quiz.closesAt)) return "closed";
  return "open";
}

export function isClosed(quiz: EffectiveQuiz, now = Date.now()) {
  return Boolean(quiz.closesAt) && now > Date.parse(quiz.closesAt!);
}

/** Legacy helper kept for callers that still think in bank weeks. */
export function attemptsAllowed(week: QuizWeek) {
  return week.graded ? GRADED_ATTEMPTS : REVIEW_ATTEMPTS;
}

// ---------------------------------------------------------------- draw and shuffle

export type RandomInt = (maxExclusive: number) => number;

/** Cryptographically strong uniform integer in [0, max). */
export const cryptoRandomInt: RandomInt = (maxExclusive) => randomInt(maxExclusive);

/** Fisher-Yates shuffle returning a new array. */
export function shuffle<T>(values: readonly T[], random: RandomInt = cryptoRandomInt): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = random(index + 1);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/** Draw `count` distinct item ids at random from the week's pool. */
export function drawItemIds(week: QuizWeek, count: number, random: RandomInt = cryptoRandomInt): string[] {
  const ids = week.items.map((item) => item.id);
  return shuffle(ids, random).slice(0, Math.min(count, ids.length));
}

/** A random permutation: order[displayed] = original option index. */
export function optionOrder(optionCount: number, random: RandomInt = cryptoRandomInt): number[] {
  return shuffle(Array.from({ length: optionCount }, (_, index) => index), random);
}

export function toOriginalAnswers(displayed: (number | null)[], orders: number[][] | null): (number | null)[] {
  return displayed.map((value, index) => {
    if (value == null) return null;
    if (!orders) return value;
    const original = orders[index]?.[value];
    return original == null ? null : original;
  });
}

export function toDisplayedAnswers(original: (number | null)[], orders: number[][] | null): (number | null)[] {
  return original.map((value, index) => {
    if (value == null) return null;
    if (!orders) return value;
    const displayed = orders[index]?.indexOf(value) ?? -1;
    return displayed < 0 ? null : displayed;
  });
}

// ---------------------------------------------------------------- items and scoring

/**
 * Items for an attempt. Rows without drawn_item_ids (legacy week 1, or attempts
 * made before migration 012) used the first `total` items in bank order.
 */
export function attemptItems(week: QuizWeek, row: Pick<AttemptRow, "drawn_item_ids" | "total">): QuizItem[] {
  if (row.drawn_item_ids && row.drawn_item_ids.length) {
    return row.drawn_item_ids.map((id) => week.items.find((item) => item.id === id) ?? {
      id,
      question: "This question has been removed from the bank.",
      options: ["", "", "", ""],
      correct: -1,
      rationale: "",
      kind: null,
      objective: null,
      book: null,
    });
  }
  return week.items.slice(0, row.total || week.items.length);
}

/** Items shown in fixed mode (legacy or migration 012 missing). */
export function fixedItems(week: QuizWeek, drawCount: number): QuizItem[] {
  return week.legacy ? week.items : week.items.slice(0, Math.min(drawCount, week.items.length));
}

export function scoreItems(items: QuizItem[], originalAnswers: (number | null)[]) {
  const detail = items.map((item, index) => {
    const selected = originalAnswers[index] ?? null;
    return { id: item.id, selected, correct: item.correct, isCorrect: selected != null && selected === item.correct };
  });
  const correctCount = detail.filter((row) => row.isCorrect).length;
  const total = items.length;
  const percent = total ? Math.round((correctCount / total) * 10000) / 100 : 0;
  return { detail, correctCount, total, percent };
}

/** Score a legacy/fixed attempt against every item of the week in bank order. */
export function score(week: QuizWeek, answers: (number | null)[]) {
  return scoreItems(week.items, answers);
}

/** Questions without answers or rationales, in displayed option order. */
export function presentQuestions(items: QuizItem[], orders: number[][] | null) {
  return items.map((item, index) => ({
    id: item.id,
    question: item.question,
    options: orders?.[index] ? orders[index].map((original) => item.options[original]) : item.options,
  }));
}

/** Questions for the whole fixed week (no answers). */
export function studentQuestions(week: QuizWeek) {
  return presentQuestions(week.items, null);
}

/** Per-question review in the order the student saw it (only when feedback is unlocked). */
export function reviewItems(items: QuizItem[], orders: number[][] | null, originalAnswers: (number | null)[]) {
  return items.map((item, index) => {
    const order = orders?.[index] ?? item.options.map((_, optionIndex) => optionIndex);
    const selected = originalAnswers[index] ?? null;
    return {
      id: item.id,
      question: item.question,
      options: order.map((original) => item.options[original]),
      selected: selected == null ? null : order.indexOf(selected),
      correct: order.indexOf(item.correct),
      isCorrect: selected != null && selected === item.correct,
      rationale: item.rationale,
      book: item.book ?? null,
    };
  });
}

// ---------------------------------------------------------------- attempt lifecycle

export function isFinal(row: Pick<AttemptRow, "status">) {
  return row.status !== "in_progress";
}

/** An in-progress attempt past expires_at plus the grace period. */
export function isExpired(row: Pick<AttemptRow, "status" | "expires_at">, now = Date.now()) {
  if (row.status !== "in_progress" || !row.expires_at) return false;
  return now > Date.parse(row.expires_at) + SUBMIT_GRACE_SECONDS * 1000;
}

/** Whether a manual submit is still accepted (before expiry plus grace). */
export function acceptsSubmit(row: Pick<AttemptRow, "status" | "expires_at">, now = Date.now()) {
  return row.status === "in_progress" && !isExpired(row, now);
}

export function remainingSeconds(row: Pick<AttemptRow, "expires_at">, now = Date.now()): number | null {
  if (!row.expires_at) return null;
  return Math.max(0, Math.floor((Date.parse(row.expires_at) - now) / 1000));
}

/** expires_at = min(start + limit + extra, close); null when untimed with no close. */
export function computeExpiresAt(quiz: StudentQuiz, startedAt: number): string | null {
  const candidates: number[] = [];
  if (quiz.timeLimitMin != null) candidates.push(startedAt + quiz.timeLimitMin * 60_000);
  if (quiz.closesAt) candidates.push(Date.parse(quiz.closesAt));
  if (!candidates.length) return null;
  return new Date(Math.min(...candidates)).toISOString();
}

export function isLate(quiz: StudentQuiz, submittedAt: number) {
  return Boolean(quiz.closesAt) && submittedAt > Date.parse(quiz.closesAt!);
}

/** Column values that finalize an attempt from the given original-order answers. */
export function finalizePatch(week: QuizWeek, row: AttemptRow, originalAnswers: (number | null)[], status: Exclude<AttemptStatus, "in_progress">, submittedAt: number, quiz: StudentQuiz) {
  const items = attemptItems(week, row);
  const answers = items.map((_, index) => originalAnswers[index] ?? null);
  const result = scoreItems(items, answers);
  return {
    status,
    answers,
    saved_answers: answers,
    correct_count: result.correctCount,
    total: result.total,
    score: result.percent,
    submitted_at: new Date(submittedAt).toISOString(),
    late: isLate(quiz, submittedAt),
  };
}

/** Finalize an expired in-progress attempt from its autosaved answers. */
export function autoSubmitPatch(week: QuizWeek, row: AttemptRow, quiz: StudentQuiz, now = Date.now()) {
  const submittedAt = row.expires_at ? Math.min(Date.parse(row.expires_at), now) : now;
  return finalizePatch(week, row, row.saved_answers ?? [], "auto_submitted", submittedAt, quiz);
}

// ---------------------------------------------------------------- feedback gating

export interface FeedbackState {
  unlocked: boolean;
  unlocksAt: string | null;
  rule: ShowAnswers;
}

/**
 * Graded weeks (after_close): correct answers and rationales appear only after
 * this student's effective close. Review weeks (after_submit): after each submit.
 */
export function feedbackState(quiz: StudentQuiz, finalizedCount: number, now = Date.now()): FeedbackState {
  if (quiz.showAnswers === "after_submit") {
    return { unlocked: finalizedCount > 0, unlocksAt: null, rule: quiz.showAnswers };
  }
  if (quiz.closesAt) {
    return { unlocked: finalizedCount > 0 && isClosed(quiz, now), unlocksAt: quiz.closesAt, rule: quiz.showAnswers };
  }
  const exhausted = quiz.attemptsAllowed != null && finalizedCount >= quiz.attemptsAllowed;
  return { unlocked: exhausted, unlocksAt: null, rule: quiz.showAnswers };
}

/** Back-compatible helper: feedback for a bank week with no settings or extension. */
export function feedbackUnlocked(week: QuizWeek, attemptsUsed: number, now = Date.now()) {
  return feedbackState(studentQuiz(quizDefaults(week.week, true), null), attemptsUsed, now).unlocked;
}

// ---------------------------------------------------------------- scores

/** Best finalized score, or null when nothing has been submitted. */
export function bestScore(attempts: AttemptRow[]) {
  const final = attempts.filter(isFinal);
  return final.length ? Math.max(...final.map((row) => row.score)) : null;
}

export interface CategoryScore {
  score: number | null;
  counted: number;
  /** The dropped score value. */
  dropped: number | null;
  droppedWeek: number | null;
  weeks: { week: number; best: number | null; included: boolean }[];
}

/**
 * Category score: best finalized attempt per graded week, lowest graded week
 * dropped, mean of the rest. When `closedWeeks` is given, only weeks that have
 * closed (a missing attempt then counts 0) or that have a finalized attempt are
 * included, so the running score is fair during the term. At least two weeks
 * must be included before one is dropped.
 */
export function quizCategoryScore(attemptsByWeek: Map<number, AttemptRow[]>, gradedWeeks: number[] = gradedWeekNumbers(), closedWeeks?: Set<number>): CategoryScore {
  const weeks = gradedWeeks.map((week) => {
    const best = bestScore(attemptsByWeek.get(week) ?? []);
    const included = closedWeeks ? closedWeeks.has(week) || best != null : true;
    return { week, best, included };
  });
  const scored = weeks.filter((row) => row.included).map((row) => ({ week: row.week, value: row.best ?? 0 }));
  if (!scored.length) return { score: null, counted: 0, dropped: null, droppedWeek: null, weeks };
  if (scored.length === 1) return { score: scored[0].value, counted: 1, dropped: null, droppedWeek: null, weeks };
  const sorted = [...scored].sort((a, b) => a.value - b.value || b.week - a.week);
  const [lowest, ...kept] = sorted;
  const mean = kept.reduce((sum, row) => sum + row.value, 0) / kept.length;
  return { score: Math.round(mean * 100) / 100, counted: kept.length, dropped: lowest.value, droppedWeek: lowest.week, weeks };
}

// ---------------------------------------------------------------- item analysis

export const ITEM_FLAG_MIN_RESPONSES = 5;

export interface ItemAnalysisRow {
  id: string;
  question: string;
  correct: number;
  drawn: number;
  correctCount: number;
  percentCorrect: number | null;
  /** Counts per ORIGINAL option index. */
  optionCounts: number[];
  blank: number;
  flag: "hard" | "easy" | null;
}

/** Per-item statistics over finalized attempts (options reported in original order). */
export function itemAnalysis(week: QuizWeek, rows: AttemptRow[]): ItemAnalysisRow[] {
  const stats = new Map(week.items.map((item) => [item.id, {
    id: item.id,
    question: item.question,
    correct: item.correct,
    drawn: 0,
    correctCount: 0,
    optionCounts: item.options.map(() => 0),
    blank: 0,
  }]));
  for (const row of rows.filter(isFinal)) {
    attemptItems(week, row).forEach((item, index) => {
      const entry = stats.get(item.id);
      if (!entry) return;
      entry.drawn += 1;
      const answer = row.answers[index];
      if (answer == null || answer < 0 || answer >= entry.optionCounts.length) entry.blank += 1;
      else entry.optionCounts[answer] += 1;
      if (answer != null && answer === item.correct) entry.correctCount += 1;
    });
  }
  return [...stats.values()].map((entry) => {
    const percentCorrect = entry.drawn ? Math.round((entry.correctCount / entry.drawn) * 1000) / 10 : null;
    let flag: ItemAnalysisRow["flag"] = null;
    if (percentCorrect != null && entry.drawn >= ITEM_FLAG_MIN_RESPONSES) {
      if (percentCorrect < 30) flag = "hard";
      else if (percentCorrect > 95) flag = "easy";
    }
    return { ...entry, percentCorrect, flag };
  });
}
