/**
 * Database access for weekly quizzes. Works against both schemas:
 *  - migration 011 only: fixed questions, no timer, no settings or extensions;
 *  - migration 012: random draws, shuffled options, timers, settings, extensions.
 * Expired in-progress attempts are finalized lazily whenever attempts are read.
 */
import type { AdminClient } from "./course-db";
import { ApiError } from "./errors";
import {
  COURSE_WEEKS,
  acceptsSubmit,
  attemptItems,
  autoSubmitPatch,
  bankWeek,
  bestScore,
  computeExpiresAt,
  cryptoRandomInt,
  drawItemIds,
  effectiveQuiz,
  feedbackState,
  finalizePatch,
  fixedItems,
  gradedWeekNumbers,
  isClosed,
  isExpired,
  isFinal,
  optionOrder,
  presentQuestions,
  quizCategoryScore,
  quizDefaults,
  quizWeek,
  remainingSeconds,
  reviewItems,
  studentQuiz,
  toDisplayedAnswers,
  toOriginalAnswers,
  windowState,
  type AttemptRow,
  type AttemptStatus,
  type EffectiveQuiz,
  type QuizExtensionRow,
  type QuizSettingsRow,
  type QuizWeek,
  type RandomInt,
  type StudentQuiz,
} from "./quizzes";

// ---------------------------------------------------------------- schema detection

export interface QuizSchema {
  /** Migration 012 (timers, draws, settings, extensions) is available. */
  windows: boolean;
  /** Human-readable reason when it is not. */
  detail: string | null;
}

interface DbError {
  code?: string;
  message?: string;
}

const MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205", "PGRST200"]);

/** A PostgREST error caused by a missing table or column (migration not applied). */
export function isMissingSchemaError(error: DbError | null | undefined) {
  if (!error) return false;
  if (error.code && MISSING_CODES.has(error.code)) return true;
  return /does not exist|schema cache|could not find/i.test(error.message ?? "");
}

function isMissingTable(error: DbError | null | undefined) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /could not find the table|relation .* does not exist/i.test(error.message ?? "");
}

const ATTEMPT_COLUMNS_V1 = "id,email,week,attempt,answers,correct_count,total,score,late,started_at,submitted_at";
const ATTEMPT_COLUMNS_V2 = `${ATTEMPT_COLUMNS_V1},status,drawn_item_ids,option_orders,saved_answers,expires_at`;
const SCHEMA_CACHE_MS = { present: 10 * 60_000, missing: 30_000 };
let schemaCache: { value: QuizSchema; at: number } | null = null;

export function resetQuizSchemaCache() {
  schemaCache = null;
}

/** Probe for migration 012; cached briefly so applying it takes effect without a redeploy. */
export async function detectQuizSchema(admin: AdminClient, now = Date.now()): Promise<QuizSchema> {
  if (schemaCache) {
    const ttl = schemaCache.value.windows ? SCHEMA_CACHE_MS.present : SCHEMA_CACHE_MS.missing;
    if (now - schemaCache.at < ttl) return schemaCache.value;
  }
  const [attempts, settings, extensions] = await Promise.all([
    admin.from("ehr_quiz_attempts").select("id,status,drawn_item_ids,option_orders,saved_answers,expires_at").limit(1),
    admin.from("ehr_quiz_settings").select("week").limit(1),
    admin.from("ehr_quiz_extensions").select("email").limit(1),
  ]);
  if (attempts.error && isMissingTable(attempts.error)) {
    throw new ApiError(503, "Quizzes are not enabled yet: the quiz table has not been created.", "NOT_MIGRATED");
  }
  const problems = [attempts.error, settings.error, extensions.error].filter(Boolean) as DbError[];
  for (const problem of problems) {
    if (!isMissingSchemaError(problem)) throw new Error(problem.message ?? "Quiz schema probe failed.");
  }
  const value: QuizSchema = problems.length
    ? { windows: false, detail: `Migration 012 (quiz windows) is not applied: ${problems[0].message ?? "missing columns"}` }
    : { windows: true, detail: null };
  schemaCache = { value, at: now };
  return value;
}

// ---------------------------------------------------------------- loading

type RawAttempt = Record<string, unknown>;

function normalizeAttempt(raw: RawAttempt): AttemptRow & { email: string } {
  return {
    id: String(raw.id ?? ""),
    email: String(raw.email ?? ""),
    week: Number(raw.week),
    attempt: Number(raw.attempt),
    answers: Array.isArray(raw.answers) ? (raw.answers as (number | null)[]) : [],
    correct_count: Number(raw.correct_count ?? 0),
    total: Number(raw.total ?? 0),
    score: Number(raw.score ?? 0),
    late: Boolean(raw.late),
    started_at: (raw.started_at as string | null) ?? null,
    submitted_at: (raw.submitted_at as string | null) ?? null,
    status: ((raw.status as AttemptStatus | undefined) ?? "submitted"),
    drawn_item_ids: (raw.drawn_item_ids as string[] | null | undefined) ?? null,
    option_orders: (raw.option_orders as number[][] | null | undefined) ?? null,
    saved_answers: (raw.saved_answers as (number | null)[] | null | undefined) ?? null,
    expires_at: (raw.expires_at as string | null | undefined) ?? null,
  };
}

export type StoredAttempt = ReturnType<typeof normalizeAttempt>;

export async function loadAttemptRows(admin: AdminClient, schema: QuizSchema, filter: { email?: string; week?: number } = {}): Promise<StoredAttempt[]> {
  let query = admin.from("ehr_quiz_attempts").select(schema.windows ? ATTEMPT_COLUMNS_V2 : ATTEMPT_COLUMNS_V1);
  if (filter.email) query = query.eq("email", filter.email);
  if (filter.week) query = query.eq("week", filter.week);
  const { data, error } = await query.order("week").order("attempt");
  if (error) {
    if (isMissingTable(error)) throw new ApiError(503, "Quizzes are not enabled yet: the quiz table has not been created.", "NOT_MIGRATED");
    throw error;
  }
  return ((data ?? []) as unknown as RawAttempt[]).map(normalizeAttempt);
}

export async function loadSettings(admin: AdminClient, schema: QuizSchema): Promise<Map<number, QuizSettingsRow>> {
  if (!schema.windows) return new Map();
  const { data, error } = await admin.from("ehr_quiz_settings").select("week,opens_at,closes_at,time_limit_min,draw_count,attempts_allowed,show_answers,updated_by,updated_at");
  if (error) {
    if (isMissingSchemaError(error)) return new Map();
    throw error;
  }
  return new Map(((data ?? []) as QuizSettingsRow[]).map((row) => [row.week, row]));
}

export async function loadExtensions(admin: AdminClient, schema: QuizSchema, email?: string): Promise<QuizExtensionRow[]> {
  if (!schema.windows) return [];
  let query = admin.from("ehr_quiz_extensions").select("email,week,extra_minutes,closes_at_override,reason,created_by,created_at");
  if (email) query = query.eq("email", email);
  const { data, error } = await query;
  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []) as QuizExtensionRow[];
}

export function effectiveQuizzes(settings: Map<number, QuizSettingsRow>, schema: QuizSchema): EffectiveQuiz[] {
  return Array.from({ length: COURSE_WEEKS }, (_, index) => effectiveQuiz(index + 1, settings.get(index + 1), schema.windows));
}

function extensionFor(extensions: QuizExtensionRow[], email: string, week: number) {
  return extensions.find((row) => row.email === email && row.week === week) ?? null;
}

/**
 * Finalize expired in-progress attempts as auto_submitted from their saved
 * answers. The update is conditional on status so concurrent requests are safe.
 */
export async function finalizeExpired(admin: AdminClient, rows: StoredAttempt[], quizzes: EffectiveQuiz[], extensions: QuizExtensionRow[], now = Date.now()): Promise<StoredAttempt[]> {
  const result: StoredAttempt[] = [];
  for (const row of rows) {
    const week = bankWeek(row.week);
    if (!week || !isExpired(row, now)) {
      result.push(row);
      continue;
    }
    const quiz = studentQuiz(quizzes[row.week - 1], extensionFor(extensions, row.email, row.week));
    const patch = autoSubmitPatch(week, row, quiz, now);
    const { data, error } = await admin.from("ehr_quiz_attempts").update(patch).eq("id", row.id).eq("status", "in_progress").select("id");
    if (error) throw error;
    if ((data ?? []).length) {
      result.push({ ...row, ...patch });
    } else {
      // Another request finalized it first; read the stored version.
      const fresh = await admin.from("ehr_quiz_attempts").select(ATTEMPT_COLUMNS_V2).eq("id", row.id).maybeSingle();
      result.push(fresh.data ? normalizeAttempt(fresh.data as unknown as RawAttempt) : { ...row, ...patch });
    }
  }
  return result;
}

// ---------------------------------------------------------------- student state

export interface StudentContext {
  schema: QuizSchema;
  quizzes: StudentQuiz[];
  attempts: StoredAttempt[];
  now: number;
}

/** Everything a student request needs, with expired attempts finalized. */
export async function loadStudentContext(admin: AdminClient, email: string, now = Date.now()): Promise<StudentContext> {
  const schema = await detectQuizSchema(admin, now);
  const [settings, extensions, rows] = await Promise.all([
    loadSettings(admin, schema),
    loadExtensions(admin, schema, email),
    loadAttemptRows(admin, schema, { email }),
  ]);
  const classQuizzes = effectiveQuizzes(settings, schema);
  const attempts = await finalizeExpired(admin, rows, classQuizzes, extensions, now);
  const quizzes = classQuizzes.map((quiz) => studentQuiz(quiz, extensionFor(extensions, email, quiz.week)));
  return { schema, quizzes, attempts, now };
}

function weekAttempts(context: StudentContext, week: number) {
  return context.attempts.filter((row) => row.week === week).sort((a, b) => a.attempt - b.attempt);
}

function closedWeekSet(quizzes: StudentQuiz[], now: number) {
  return new Set(quizzes.filter((quiz) => quiz.graded && quiz.available && isClosed(quiz, now)).map((quiz) => quiz.week));
}

function attemptsByWeek(rows: AttemptRow[]) {
  const map = new Map<number, AttemptRow[]>();
  for (const row of rows) map.set(row.week, [...(map.get(row.week) ?? []), row]);
  return map;
}

function startBlock(quiz: StudentQuiz, rows: AttemptRow[], now: number): string | null {
  const state = windowState(quiz, now);
  if (state === "unavailable") return "This quiz is not available yet.";
  if (state === "upcoming") return "This quiz has not opened yet.";
  if (state === "closed") return "This quiz is closed.";
  if (quiz.attemptsAllowed != null && rows.length >= quiz.attemptsAllowed) {
    return `You have used all ${quiz.attemptsAllowed} attempts for this quiz.`;
  }
  return null;
}

export function summarize(quiz: StudentQuiz, rows: AttemptRow[], now: number) {
  const final = rows.filter(isFinal);
  const inProgress = rows.find((row) => row.status === "in_progress") ?? null;
  const block = startBlock(quiz, rows, now);
  return {
    week: quiz.week,
    title: quiz.title,
    date: quiz.date,
    graded: quiz.graded,
    available: quiz.available,
    legacy: quiz.legacy,
    mode: quiz.mode,
    state: windowState(quiz, now),
    opensAt: quiz.opensAt,
    closesAt: quiz.closesAt,
    timeLimitMin: quiz.timeLimitMin,
    extraMinutes: quiz.extraMinutes,
    closeOverridden: quiz.closeOverridden,
    questionCount: quiz.drawCount,
    attemptsUsed: rows.length,
    attemptsAllowed: quiz.attemptsAllowed,
    bestScore: bestScore(rows),
    inProgress: Boolean(inProgress),
    canStart: !inProgress && !block,
    blockedReason: inProgress ? null : block,
    feedbackUnlocked: feedbackState(quiz, final.length, now).unlocked,
    lastSubmittedAt: final.at(-1)?.submitted_at ?? null,
  };
}

export function studentList(context: StudentContext) {
  const weeks = context.quizzes.map((quiz) => summarize(quiz, weekAttempts(context, quiz.week), context.now));
  const category = quizCategoryScore(attemptsByWeek(context.attempts), gradedWeekNumbers(), closedWeekSet(context.quizzes, context.now));
  return {
    weeks,
    category,
    rules: { gradedAttempts: 2, highestKept: true, lowestDropped: true },
    windowsEnabled: context.schema.windows,
    serverNow: new Date(context.now).toISOString(),
  };
}

function inProgressPayload(week: QuizWeek, row: AttemptRow, quiz: StudentQuiz, now: number) {
  const items = attemptItems(week, row);
  return {
    attempt: row.attempt,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    remainingSeconds: remainingSeconds(row, now),
    timeLimitMin: quiz.timeLimitMin,
    questions: presentQuestions(items, row.option_orders),
    answers: toDisplayedAnswers(items.map((_, index) => row.saved_answers?.[index] ?? null), row.option_orders),
  };
}

function attemptPayload(week: QuizWeek, row: AttemptRow, unlocked: boolean) {
  const items = attemptItems(week, row);
  return {
    attempt: row.attempt,
    status: row.status,
    score: row.score,
    correctCount: row.correct_count,
    total: row.total,
    late: row.late,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    review: unlocked ? reviewItems(items, row.option_orders, row.answers) : null,
  };
}

/** Minutes the student would actually get if they started now. */
function startMinutes(quiz: StudentQuiz, now: number) {
  const expires = computeExpiresAt(quiz, now);
  if (!expires) return null;
  return Math.max(0, Math.floor((Date.parse(expires) - now) / 60_000));
}

export function studentDetail(context: StudentContext, weekNumber: number) {
  const quiz = context.quizzes[weekNumber - 1];
  const rows = weekAttempts(context, weekNumber);
  const summary = summarize(quiz, rows, context.now);
  const week = bankWeek(weekNumber);
  if (!week) {
    return { ...summary, feedback: { unlocked: false, unlocksAt: null, rule: quiz.showAnswers }, attempts: [], inProgress: null, fixedQuestions: null, startMinutes: null, serverNow: new Date(context.now).toISOString() };
  }
  const final = rows.filter(isFinal);
  const feedback = feedbackState(quiz, final.length, context.now);
  const current = rows.find((row) => row.status === "in_progress");
  const fixed = quiz.mode === "fixed" && summary.canStart ? presentQuestions(fixedItems(week, quiz.drawCount), null) : null;
  return {
    ...summary,
    feedback,
    attempts: final.map((row) => attemptPayload(week, row, feedback.unlocked)),
    inProgress: current ? inProgressPayload(week, current, quiz, context.now) : null,
    fixedQuestions: fixed,
    startMinutes: quiz.mode === "drawn" ? startMinutes(quiz, context.now) : null,
    serverNow: new Date(context.now).toISOString(),
  };
}

// ---------------------------------------------------------------- student actions

function assertAvailable(quiz: StudentQuiz) {
  if (!quiz.available) throw new ApiError(404, "That quiz is not available yet.", "NOT_FOUND");
}

function assertWindow(quiz: StudentQuiz, now: number) {
  const state = windowState(quiz, now);
  if (state === "upcoming") throw new ApiError(403, "This quiz has not opened yet.", "NOT_OPEN");
  if (state === "closed") throw new ApiError(403, "This quiz closed at its due date. Contact the instructor if you need an extension.", "CLOSED");
}

function validateAnswers(answers: (number | null)[], optionCounts: number[]) {
  if (answers.length !== optionCounts.length) throw new ApiError(400, `Expected ${optionCounts.length} answers.`, "VALIDATION");
  answers.forEach((value, index) => {
    if (value != null && (value < 0 || value >= optionCounts[index])) throw new ApiError(400, "An answer is out of range.", "VALIDATION");
  });
}

/** Start (or resume) a timed, randomly drawn attempt. */
export async function startAttempt(admin: AdminClient, email: string, weekNumber: number, options: { now?: number; random?: RandomInt } = {}) {
  const now = options.now ?? Date.now();
  const random = options.random ?? cryptoRandomInt;
  const context = await loadStudentContext(admin, email, now);
  const quiz = context.quizzes[weekNumber - 1];
  assertAvailable(quiz);
  const week = quizWeek(weekNumber);
  if (quiz.mode !== "drawn") throw new ApiError(409, "This quiz is submitted in one step; answer the questions and submit.", "FIXED_MODE");
  const rows = weekAttempts(context, weekNumber);
  const current = rows.find((row) => row.status === "in_progress");
  if (current) return { resumed: true, ...inProgressPayload(week, current, quiz, now) };
  assertWindow(quiz, now);
  if (quiz.attemptsAllowed != null && rows.length >= quiz.attemptsAllowed) {
    throw new ApiError(409, `You have used all ${quiz.attemptsAllowed} attempts for this quiz.`, "NO_ATTEMPTS_LEFT");
  }
  const drawn = drawItemIds(week, quiz.drawCount, random);
  const items = drawn.map((id) => week.items.find((item) => item.id === id)!);
  const orders = items.map((item) => optionOrder(item.options.length, random));
  const attempt = Math.max(0, ...rows.map((row) => row.attempt)) + 1;
  const row = {
    email,
    week: weekNumber,
    attempt,
    answers: [],
    correct_count: 0,
    total: items.length,
    score: 0,
    late: false,
    status: "in_progress" as const,
    started_at: new Date(now).toISOString(),
    submitted_at: null,
    expires_at: computeExpiresAt(quiz, now),
    drawn_item_ids: drawn,
    option_orders: orders,
    saved_answers: items.map(() => null),
  };
  const { error } = await admin.from("ehr_quiz_attempts").insert(row);
  if (error) {
    if (error.code === "23505") {
      // A concurrent start won the race; resume whatever it created.
      const retry = await loadStudentContext(admin, email, now);
      const existing = weekAttempts(retry, weekNumber).find((item) => item.status === "in_progress");
      if (existing) return { resumed: true, ...inProgressPayload(week, existing, quiz, now) };
      throw new ApiError(409, "Another attempt was started at the same time. Reload the quiz.", "CONFLICT");
    }
    throw error;
  }
  const stored: AttemptRow = { id: "", ...row };
  return { resumed: false, ...inProgressPayload(week, stored, quiz, now) };
}

async function loadInProgress(admin: AdminClient, email: string, weekNumber: number, attempt: number, now: number) {
  const context = await loadStudentContext(admin, email, now);
  const quiz = context.quizzes[weekNumber - 1];
  assertAvailable(quiz);
  const week = quizWeek(weekNumber);
  const rows = weekAttempts(context, weekNumber);
  const row = rows.find((item) => item.attempt === attempt) ?? null;
  return { context, quiz, week, rows, row };
}

/** Autosave displayed-order answers for an in-progress attempt. */
export async function autosaveAttempt(admin: AdminClient, email: string, weekNumber: number, attempt: number, displayed: (number | null)[], now = Date.now()) {
  const { week, row } = await loadInProgress(admin, email, weekNumber, attempt, now);
  if (!row) throw new ApiError(404, "That attempt does not exist.", "NOT_FOUND");
  if (row.status !== "in_progress") {
    return { saved: false, finalized: true, status: row.status, remainingSeconds: 0 };
  }
  const items = attemptItems(week, row);
  validateAnswers(displayed, items.map((item) => item.options.length));
  const original = toOriginalAnswers(displayed, row.option_orders);
  const { data, error } = await admin.from("ehr_quiz_attempts").update({ saved_answers: original }).eq("id", row.id).eq("status", "in_progress").select("id");
  if (error) throw error;
  if (!(data ?? []).length) return { saved: false, finalized: true, status: "submitted" as AttemptStatus, remainingSeconds: 0 };
  return { saved: true, finalized: false, status: row.status, savedAt: new Date(now).toISOString(), remainingSeconds: remainingSeconds(row, now) };
}

function resultPayload(context: StudentContext, weekNumber: number, attempt: number, extra: Record<string, unknown> = {}) {
  const detail = studentDetail(context, weekNumber);
  const row = detail.attempts.find((item) => item.attempt === attempt);
  const remaining = detail.attemptsAllowed == null ? null : Math.max(0, detail.attemptsAllowed - detail.attemptsUsed);
  return {
    attempt,
    status: row?.status ?? "submitted",
    score: row?.score ?? 0,
    correctCount: row?.correctCount ?? 0,
    total: row?.total ?? 0,
    late: row?.late ?? false,
    attemptsRemaining: remaining,
    bestScore: detail.bestScore,
    feedback: detail.feedback,
    review: row?.review ?? null,
    ...extra,
  };
}

/** Submit a drawn attempt: map displayed answers back to original option indices and score. */
export async function submitDrawnAttempt(admin: AdminClient, email: string, weekNumber: number, attempt: number, displayed: (number | null)[], now = Date.now()) {
  const { quiz, week, row } = await loadInProgress(admin, email, weekNumber, attempt, now);
  if (!row) throw new ApiError(404, "That attempt does not exist.", "NOT_FOUND");
  if (row.status !== "in_progress") {
    // Already finalized (double submit, or the timer expired and it was auto-submitted).
    const context = await loadStudentContext(admin, email, now);
    return resultPayload(context, weekNumber, attempt, { alreadySubmitted: true });
  }
  const items = attemptItems(week, row);
  validateAnswers(displayed, items.map((item) => item.options.length));
  if (!acceptsSubmit(row, now)) {
    // Past the grace period: finalizeExpired should have handled it; do it now to be safe.
    const patch = autoSubmitPatch(week, row, quiz, now);
    await admin.from("ehr_quiz_attempts").update(patch).eq("id", row.id).eq("status", "in_progress");
    const context = await loadStudentContext(admin, email, now);
    return resultPayload(context, weekNumber, attempt, { autoSubmitted: true });
  }
  const original = toOriginalAnswers(displayed, row.option_orders);
  const patch = finalizePatch(week, row, original, "submitted", now, quiz);
  const { error } = await admin.from("ehr_quiz_attempts").update(patch).eq("id", row.id).eq("status", "in_progress");
  if (error) throw error;
  const context = await loadStudentContext(admin, email, now);
  return resultPayload(context, weekNumber, attempt);
}

/**
 * Submit a fixed attempt in one step (legacy week 1 always; every week when
 * migration 012 is missing). Answers are index-aligned to the fixed items.
 */
export async function submitFixedAttempt(admin: AdminClient, email: string, weekNumber: number, answers: (number | null)[], now = Date.now()) {
  const context = await loadStudentContext(admin, email, now);
  const quiz = context.quizzes[weekNumber - 1];
  assertAvailable(quiz);
  const week = quizWeek(weekNumber);
  if (quiz.mode !== "fixed") throw new ApiError(409, "Start the quiz first; this quiz is timed and uses a random draw.", "DRAWN_MODE");
  const items = fixedItems(week, quiz.drawCount);
  validateAnswers(answers, items.map((item) => item.options.length));
  const rows = weekAttempts(context, weekNumber);
  assertWindow(quiz, now);
  if (quiz.attemptsAllowed != null && rows.length >= quiz.attemptsAllowed) {
    throw new ApiError(409, `You have used all ${quiz.attemptsAllowed} attempts for this quiz.`, "NO_ATTEMPTS_LEFT");
  }
  if (answers.some((value) => value === null)) throw new ApiError(400, "Answer every question before submitting.", "INCOMPLETE");
  const attempt = Math.max(0, ...rows.map((row) => row.attempt)) + 1;
  const pseudo: AttemptRow = {
    id: "", week: weekNumber, attempt, answers: [], correct_count: 0, total: items.length, score: 0, late: false,
    started_at: null, submitted_at: null, status: "in_progress", drawn_item_ids: null, option_orders: null, saved_answers: null, expires_at: null,
  };
  const patch = finalizePatch(week, pseudo, answers, "submitted", now, quiz);
  // Only migration-011 columns, so this works with or without migration 012.
  const { error } = await admin.from("ehr_quiz_attempts").insert({
    email,
    week: weekNumber,
    attempt,
    answers: patch.answers,
    correct_count: patch.correct_count,
    total: patch.total,
    score: patch.score,
    late: patch.late,
  });
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "That attempt was already recorded. Reload the quiz.", "CONFLICT");
    throw error;
  }
  const fresh = await loadStudentContext(admin, email, now);
  return resultPayload(fresh, weekNumber, attempt);
}

// ---------------------------------------------------------------- instructor

interface CourseStudent {
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  enrollment_status: string;
  blackboard_username: string | null;
}

export async function loadQuizStudents(admin: AdminClient, includeTest: boolean): Promise<CourseStudent[]> {
  const { data, error } = await admin
    .from("ehr_course_users")
    .select("email,name,first_name,last_name,role,enrollment_status,blackboard_username")
    .eq("role", "student")
    .order("last_name", { nullsFirst: false });
  if (error) throw error;
  return ((data ?? []) as (CourseStudent & { role: string })[]).filter((user) => includeTest || user.enrollment_status !== "test");
}

export interface ClassContext {
  schema: QuizSchema;
  settings: Map<number, QuizSettingsRow>;
  quizzes: EffectiveQuiz[];
  extensions: QuizExtensionRow[];
  attempts: StoredAttempt[];
  students: CourseStudent[];
  now: number;
}

/** Whole-class state for instructor views and exports (finalizes expired attempts). */
export async function loadClassContext(admin: AdminClient, options: { includeTest?: boolean; week?: number; now?: number } = {}): Promise<ClassContext> {
  const now = options.now ?? Date.now();
  const schema = await detectQuizSchema(admin, now);
  const [settings, extensions, rows, students] = await Promise.all([
    loadSettings(admin, schema),
    loadExtensions(admin, schema),
    loadAttemptRows(admin, schema, { week: options.week }),
    loadQuizStudents(admin, Boolean(options.includeTest)),
  ]);
  const quizzes = effectiveQuizzes(settings, schema);
  const attempts = await finalizeExpired(admin, rows, quizzes, extensions, now);
  return { schema, settings, quizzes, extensions, attempts, students, now };
}

export function studentQuizzesFor(context: ClassContext, email: string): StudentQuiz[] {
  return context.quizzes.map((quiz) => studentQuiz(quiz, extensionFor(context.extensions, email, quiz.week)));
}

/** Results grid: students x graded weeks with best score, attempts, dropped week, category. */
export function classResults(context: ClassContext) {
  const graded = gradedWeekNumbers();
  const emails = new Set(context.students.map((student) => student.email));
  const students = context.students.map((student) => {
    const rows = context.attempts.filter((row) => row.email === student.email);
    const quizzes = studentQuizzesFor(context, student.email);
    const category = quizCategoryScore(attemptsByWeek(rows), graded, closedWeekSet(quizzes, context.now));
    return {
      email: student.email,
      name: student.name,
      first_name: student.first_name,
      last_name: student.last_name,
      blackboard_username: student.blackboard_username,
      enrollment_status: student.enrollment_status,
      weeks: context.quizzes.map((quiz) => {
        const weekRows = rows.filter((row) => row.week === quiz.week);
        return {
          week: quiz.week,
          graded: quiz.graded,
          attempts: weekRows.filter(isFinal).length,
          inProgress: weekRows.some((row) => row.status === "in_progress"),
          best: bestScore(weekRows),
          late: weekRows.some((row) => row.late),
          autoSubmitted: weekRows.some((row) => row.status === "auto_submitted"),
          dropped: category.droppedWeek === quiz.week,
        };
      }),
      category,
    };
  });
  return { students, gradedWeeks: graded, unlistedAttempts: context.attempts.filter((row) => !emails.has(row.email)).length };
}

export function settingsOverview(context: ClassContext) {
  return context.quizzes.map((quiz) => ({
    week: quiz.week,
    title: quiz.title,
    date: quiz.date,
    graded: quiz.graded,
    available: quiz.available,
    legacy: quiz.legacy,
    mode: quiz.mode,
    poolSize: quiz.poolSize,
    defaults: quizDefaults(quiz.week, context.schema.windows),
    settings: context.settings.get(quiz.week) ?? null,
    effective: quiz,
  }));
}

export async function saveSettings(admin: AdminClient, actor: string, row: Omit<QuizSettingsRow, "updated_by" | "updated_at">) {
  const schema = await detectQuizSchema(admin);
  if (!schema.windows) throw new ApiError(409, "Apply migration 012 before changing quiz settings.", "NOT_MIGRATED");
  const { error } = await admin.from("ehr_quiz_settings").upsert({ ...row, updated_by: actor, updated_at: new Date().toISOString() }, { onConflict: "week" });
  if (error) throw error;
}

export async function saveExtension(admin: AdminClient, actor: string, row: Omit<QuizExtensionRow, "created_by" | "created_at">) {
  const schema = await detectQuizSchema(admin);
  if (!schema.windows) throw new ApiError(409, "Apply migration 012 before granting extensions.", "NOT_MIGRATED");
  const { error } = await admin.from("ehr_quiz_extensions").upsert({ ...row, created_by: actor, created_at: new Date().toISOString() }, { onConflict: "email,week" });
  if (error) {
    if (error.code === "23503") throw new ApiError(404, "That student is not on the course roster.", "NOT_FOUND");
    throw error;
  }
}

export async function deleteExtension(admin: AdminClient, email: string, week: number) {
  const schema = await detectQuizSchema(admin);
  if (!schema.windows) throw new ApiError(409, "Apply migration 012 before changing extensions.", "NOT_MIGRATED");
  const { error } = await admin.from("ehr_quiz_extensions").delete().eq("email", email).eq("week", week);
  if (error) throw error;
}
