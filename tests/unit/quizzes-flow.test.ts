/**
 * Attempt lifecycle against an in-memory database: start, resume, autosave,
 * submit, auto-submit on expiry, feedback gating, extensions, legacy week 1,
 * and graceful fallback when migration 012 is missing.
 * Uses a fixture bank: week 1 (legacy, graded), week 2 (review), week 3 (graded, drawn, timed).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "./fake-supabase";

vi.mock("@/lib/server/quiz-bank.json", async () => ({ default: (await import("./fixtures/quiz-bank.fixture.json")).default }));

const {
  autosaveAttempt, classResults, detectQuizSchema, loadClassContext, loadStudentContext, resetQuizSchemaCache,
  saveExtension, saveSettings, startAttempt, studentDetail, studentList, submitDrawnAttempt, submitFixedAttempt,
} = await import("@/lib/server/quiz-store");
const { itemAnalysis, quizWeek } = await import("@/lib/server/quizzes");

const EMAIL = "student@fordham.edu";
const W3_OPEN = Date.parse("2026-10-07T12:00:00Z");
const W3_CLOSE = Date.parse("2026-10-12T03:59:00Z");
const MIN = 60_000;

let db: FakeDb;
let admin: ReturnType<FakeDb["client"]>;

function setup(schema: "011" | "012" = "012") {
  resetQuizSchemaCache();
  db = new FakeDb(schema);
  admin = db.client();
  db.rows("ehr_course_users").push(
    { email: EMAIL, name: "Stu Dent", first_name: "Stu", last_name: "Dent", role: "student", enrollment_status: "active", blackboard_username: "sdent" },
    { email: "other@fordham.edu", name: "Oth Er", first_name: "Oth", last_name: "Er", role: "student", enrollment_status: "active", blackboard_username: "oer" },
  );
}

function storedAttempt(week: number, attempt: number) {
  return db.rows("ehr_quiz_attempts").find((row) => row.email === EMAIL && row.week === week && row.attempt === attempt)!;
}

/** Displayed indices of the correct answers for a stored drawn attempt. */
function correctDisplayed(week: number, attempt: number) {
  const row = storedAttempt(week, attempt);
  const bank = quizWeek(week);
  return (row.drawn_item_ids as string[]).map((id, index) => {
    const item = bank.items.find((entry) => entry.id === id)!;
    return (row.option_orders as number[][])[index].indexOf(item.correct);
  });
}

beforeEach(() => setup());

describe("drawn, timed attempts", () => {
  it("starts with a random draw and shuffled options but no answers", async () => {
    const started = await startAttempt(admin, EMAIL, 3, { now: W3_OPEN });
    expect(started.resumed).toBe(false);
    expect(started.questions).toHaveLength(6);
    expect(started.remainingSeconds).toBe(15 * 60);
    expect(JSON.stringify(started)).not.toMatch(/"correct"|rationale/);
    const row = storedAttempt(3, 1);
    expect(row.status).toBe("in_progress");
    expect(row.submitted_at).toBeNull();
    expect(new Set(row.drawn_item_ids as string[]).size).toBe(6);
    expect((row.option_orders as number[][]).every((order) => [...order].sort().join() === "0,1,2,3")).toBe(true);
    expect(row.expires_at).toBe(new Date(W3_OPEN + 15 * MIN).toISOString());
    // Displayed options are the bank options permuted by option_orders.
    const bank = quizWeek(3);
    const first = bank.items.find((item) => item.id === (row.drawn_item_ids as string[])[0])!;
    expect(started.questions[0].options).toEqual((row.option_orders as number[][])[0].map((index) => first.options[index]));
  });

  it("resumes the same attempt without redrawing or restarting the timer", async () => {
    const first = await startAttempt(admin, EMAIL, 3, { now: W3_OPEN });
    await autosaveAttempt(admin, EMAIL, 3, 1, [1, null, null, null, null, null], W3_OPEN + 30_000);
    const again = await startAttempt(admin, EMAIL, 3, { now: W3_OPEN + 4 * MIN });
    expect(again.resumed).toBe(true);
    expect(again.attempt).toBe(1);
    expect(again.questions).toEqual(first.questions);
    expect(again.remainingSeconds).toBe(11 * 60);
    expect(again.answers[0]).toBe(1);
    const context = await loadStudentContext(admin, EMAIL, W3_OPEN + 5 * MIN);
    const detail = studentDetail(context, 3);
    expect(detail.inProgress?.remainingSeconds).toBe(10 * 60);
    expect(detail.inProgress?.answers).toEqual([1, null, null, null, null, null]);
    expect(db.rows("ehr_quiz_attempts")).toHaveLength(1);
  });

  it("unshuffles on submit and stores answers in original option order", async () => {
    await startAttempt(admin, EMAIL, 3, { now: W3_OPEN });
    const displayed = correctDisplayed(3, 1);
    const result = await submitDrawnAttempt(admin, EMAIL, 3, 1, displayed, W3_OPEN + 5 * MIN);
    expect(result).toMatchObject({ score: 100, correctCount: 6, total: 6, status: "submitted", attemptsRemaining: 1 });
    const row = storedAttempt(3, 1);
    const bank = quizWeek(3);
    expect(row.answers).toEqual((row.drawn_item_ids as string[]).map((id) => bank.items.find((item) => item.id === id)!.correct));
    expect(row.status).toBe("submitted");
    expect(row.late).toBe(false);
  });

  it("auto-submits an expired attempt from its saved answers on the next read", async () => {
    await startAttempt(admin, EMAIL, 3, { now: W3_OPEN });
    const correct = correctDisplayed(3, 1);
    const partial = correct.map((value, index) => (index < 3 ? value : null));
    await autosaveAttempt(admin, EMAIL, 3, 1, partial, W3_OPEN + 2 * MIN);
    // Within the grace period nothing changes.
    let context = await loadStudentContext(admin, EMAIL, W3_OPEN + 15 * MIN + 20_000);
    expect(context.attempts[0].status).toBe("in_progress");
    context = await loadStudentContext(admin, EMAIL, W3_OPEN + 15 * MIN + 31_000);
    expect(context.attempts[0]).toMatchObject({ status: "auto_submitted", score: 50, correct_count: 3 });
    expect(storedAttempt(3, 1).submitted_at).toBe(new Date(W3_OPEN + 15 * MIN).toISOString());
    expect(studentList(context).weeks[2].bestScore).toBe(50);
  });

  it("accepts a manual submit inside the grace period", async () => {
    await startAttempt(admin, EMAIL, 3, { now: W3_OPEN });
    const result = await submitDrawnAttempt(admin, EMAIL, 3, 1, correctDisplayed(3, 1), W3_OPEN + 15 * MIN + 15_000);
    expect(result).toMatchObject({ status: "submitted", score: 100 });
  });

  it("treats a submit after expiry as the auto-submitted saved answers", async () => {
    await startAttempt(admin, EMAIL, 3, { now: W3_OPEN });
    const result = await submitDrawnAttempt(admin, EMAIL, 3, 1, correctDisplayed(3, 1), W3_OPEN + 20 * MIN);
    expect(result).toMatchObject({ status: "auto_submitted", score: 0, alreadySubmitted: true });
  });

  it("enforces the window and the two graded attempts (starting uses one)", async () => {
    await expect(startAttempt(admin, EMAIL, 3, { now: W3_OPEN - 3 * 86_400_000 })).rejects.toMatchObject({ code: "NOT_OPEN" });
    await expect(startAttempt(admin, EMAIL, 3, { now: W3_CLOSE + MIN })).rejects.toMatchObject({ code: "CLOSED" });
    await startAttempt(admin, EMAIL, 3, { now: W3_OPEN });
    await submitDrawnAttempt(admin, EMAIL, 3, 1, [0, 0, 0, 0, 0, 0], W3_OPEN + MIN);
    await startAttempt(admin, EMAIL, 3, { now: W3_OPEN + 2 * MIN });
    await expect(startAttempt(admin, EMAIL, 3, { now: W3_OPEN + 60 * MIN })).rejects.toMatchObject({ code: "NO_ATTEMPTS_LEFT" });
  });

  it("caps the timer at the close and rejects out-of-range answers", async () => {
    const started = await startAttempt(admin, EMAIL, 3, { now: W3_CLOSE - 5 * MIN });
    expect(started.expiresAt).toBe(new Date(W3_CLOSE).toISOString());
    await expect(submitDrawnAttempt(admin, EMAIL, 3, 1, [0, 0, 0], W3_CLOSE - MIN)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(submitDrawnAttempt(admin, EMAIL, 3, 1, [0, 0, 0, 0, 0, 7], W3_CLOSE - MIN)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("refuses the drawn flow for the fixed legacy week", async () => {
    await expect(startAttempt(admin, EMAIL, 1, { now: Date.parse("2026-09-24T12:00:00Z") })).rejects.toMatchObject({ code: "FIXED_MODE" });
    await expect(submitFixedAttempt(admin, EMAIL, 3, [0, 0, 0, 0, 0, 0], W3_OPEN)).rejects.toMatchObject({ code: "DRAWN_MODE" });
  });
});

describe("feedback gating", () => {
  it("hides graded answers until the close, then shows the drawn questions with answers and rationales", async () => {
    await startAttempt(admin, EMAIL, 3, { now: W3_OPEN });
    const result = await submitDrawnAttempt(admin, EMAIL, 3, 1, [0, 1, 2, 3, 0, 1], W3_OPEN + MIN);
    expect(result.review).toBeNull();
    expect(result.feedback.unlocked).toBe(false);
    let detail = studentDetail(await loadStudentContext(admin, EMAIL, W3_OPEN + 2 * MIN), 3);
    expect(detail.attempts[0].review).toBeNull();
    detail = studentDetail(await loadStudentContext(admin, EMAIL, W3_CLOSE + MIN), 3);
    const review = detail.attempts[0].review!;
    expect(review).toHaveLength(6);
    expect(review.map((item) => item.selected)).toEqual([0, 1, 2, 3, 0, 1]);
    const row = storedAttempt(3, 1);
    expect(review[0].id).toBe((row.drawn_item_ids as string[])[0]);
    expect(review[0].options[review[0].correct]).toBe(quizWeek(3).items.find((item) => item.id === review[0].id)!.options[quizWeek(3).items.find((item) => item.id === review[0].id)!.correct]);
    expect(review[0].rationale).toMatch(/fixture/);
  });

  it("shows review-week feedback immediately after submit", async () => {
    const now = Date.parse("2026-09-30T12:00:00Z");
    const started = await startAttempt(admin, EMAIL, 2, { now });
    expect(started.expiresAt).toBeNull();
    expect(started.remainingSeconds).toBeNull();
    const result = await submitDrawnAttempt(admin, EMAIL, 2, 1, [0, 0, 0, 0, 0, 0], now + 20 * MIN);
    expect(result.review).toHaveLength(6);
    expect(result.attemptsRemaining).toBeNull();
  });
});

describe("settings and extensions", () => {
  it("applies the settings row (time, draw, attempts) to new attempts", async () => {
    await saveSettings(admin, "prof@fordham.edu", { week: 3, opens_at: null, closes_at: null, time_limit_min: 30, draw_count: 8, attempts_allowed: 0, show_answers: null });
    const started = await startAttempt(admin, EMAIL, 3, { now: W3_OPEN });
    expect(started.questions).toHaveLength(8);
    expect(started.remainingSeconds).toBe(30 * 60);
    const detail = studentDetail(await loadStudentContext(admin, EMAIL, W3_OPEN), 3);
    expect(detail.attemptsAllowed).toBeNull();
  });

  it("gives one student extra minutes and a later close without changing others", async () => {
    await saveExtension(admin, "prof@fordham.edu", { email: EMAIL, week: 3, extra_minutes: 10, closes_at_override: new Date(W3_CLOSE + 2 * 86_400_000).toISOString(), reason: "accommodation" });
    const started = await startAttempt(admin, EMAIL, 3, { now: W3_OPEN });
    expect(started.remainingSeconds).toBe(25 * 60);
    await expect(startAttempt(admin, "other@fordham.edu", 3, { now: W3_CLOSE + MIN })).rejects.toMatchObject({ code: "CLOSED" });
    await submitDrawnAttempt(admin, EMAIL, 3, 1, [0, 0, 0, 0, 0, 0], W3_OPEN + MIN);
    const late = await startAttempt(admin, EMAIL, 3, { now: W3_CLOSE + MIN });
    expect(late.attempt).toBe(2);
    // Feedback follows the student's own (extended) close.
    const detail = studentDetail(await loadStudentContext(admin, EMAIL, W3_CLOSE + 2 * MIN), 3);
    expect(detail.feedback.unlocked).toBe(false);
  });
});

describe("legacy week 1", () => {
  const NOW = Date.parse("2026-09-24T12:00:00Z");

  it("records one-step attempts index-aligned to the legacy items, untimed", async () => {
    const detail = studentDetail(await loadStudentContext(admin, EMAIL, NOW), 1);
    expect(detail.mode).toBe("fixed");
    expect(detail.timeLimitMin).toBeNull();
    expect(detail.fixedQuestions?.map((question) => question.id)).toEqual(quizWeek(1).items.map((item) => item.id));
    const answers = quizWeek(1).items.map((item) => item.correct);
    const result = await submitFixedAttempt(admin, EMAIL, 1, answers, NOW);
    expect(result).toMatchObject({ score: 100, attemptsRemaining: 1, review: null });
    const row = storedAttempt(1, 1);
    expect(row.answers).toEqual(answers);
    expect(row.drawn_item_ids).toBeUndefined();
    await expect(submitFixedAttempt(admin, EMAIL, 1, [0, 0, 0, 0, 0, null], NOW)).rejects.toMatchObject({ code: "INCOMPLETE" });
  });

  it("reviews pre-existing rows (no draw columns) against the legacy order after the close", async () => {
    db.rows("ehr_quiz_attempts").push({ id: "old", email: EMAIL, week: 1, attempt: 1, answers: [0, 1, 2, 3, 0, 1], correct_count: 2, total: 6, score: 33.33, late: false, started_at: null, submitted_at: "2026-09-22T12:00:00Z", status: "submitted", drawn_item_ids: null, option_orders: null, saved_answers: null, expires_at: null });
    const detail = studentDetail(await loadStudentContext(admin, EMAIL, Date.parse("2026-09-28T05:00:00Z")), 1);
    const review = detail.attempts[0].review!;
    expect(review.map((item) => item.id)).toEqual(quizWeek(1).items.map((item) => item.id));
    expect(review.map((item) => item.selected)).toEqual([0, 1, 2, 3, 0, 1]);
    expect(review.map((item) => item.correct)).toEqual(quizWeek(1).items.map((item) => item.correct));
    expect(detail.attempts[0].score).toBe(33.33);
  });
});

describe("without migration 012", () => {
  beforeEach(() => setup("011"));

  it("detects the missing migration and falls back to fixed, untimed quizzes", async () => {
    const schema = await detectQuizSchema(admin);
    expect(schema.windows).toBe(false);
    expect(schema.detail).toMatch(/Migration 012/);
    const context = await loadStudentContext(admin, EMAIL, W3_OPEN);
    const detail = studentDetail(context, 3);
    expect(detail).toMatchObject({ mode: "fixed", timeLimitMin: null, canStart: true });
    expect(detail.fixedQuestions?.map((question) => question.id)).toEqual(quizWeek(3).items.slice(0, 6).map((item) => item.id));
    await expect(startAttempt(admin, EMAIL, 3, { now: W3_OPEN })).rejects.toMatchObject({ code: "FIXED_MODE" });
    const result = await submitFixedAttempt(admin, EMAIL, 3, quizWeek(3).items.slice(0, 6).map((item) => item.correct), W3_OPEN);
    expect(result.score).toBe(100);
    await expect(saveSettings(admin, "prof@fordham.edu", { week: 3, opens_at: null, closes_at: null, time_limit_min: 5, draw_count: null, attempts_allowed: null, show_answers: null })).rejects.toMatchObject({ code: "NOT_MIGRATED" });
    const list = studentList(await loadStudentContext(admin, EMAIL, W3_OPEN));
    expect(list.windowsEnabled).toBe(false);
    expect(list.weeks.map((week) => week.state)).toEqual(["closed", "open", "open", ...Array(9).fill("unavailable")]);
  });
});

describe("instructor views", () => {
  it("finalizes expired attempts, builds the results grid and item analysis", async () => {
    db.rows("ehr_quiz_attempts").push({ id: "w1", email: EMAIL, week: 1, attempt: 1, answers: quizWeek(1).items.map((item) => item.correct), correct_count: 6, total: 6, score: 100, late: false, started_at: null, submitted_at: "2026-09-22T12:00:00Z", status: "submitted", drawn_item_ids: null, option_orders: null, saved_answers: null, expires_at: null });
    await startAttempt(admin, EMAIL, 3, { now: W3_OPEN });
    await autosaveAttempt(admin, EMAIL, 3, 1, correctDisplayed(3, 1).map((value, index) => (index < 3 ? value : null)), W3_OPEN + MIN);
    const context = await loadClassContext(admin, { now: W3_CLOSE + MIN });
    expect(storedAttempt(3, 1).status).toBe("auto_submitted");
    const results = classResults(context);
    const student = results.students.find((row) => row.email === EMAIL)!;
    expect(student.weeks[2]).toMatchObject({ best: 50, attempts: 1, autoSubmitted: true, dropped: true });
    expect(student.category).toMatchObject({ score: 100, droppedWeek: 3 });
    const other = results.students.find((row) => row.email === "other@fordham.edu")!;
    expect(other.category).toMatchObject({ score: 0, counted: 1 });
    const analysis = itemAnalysis(quizWeek(3), context.attempts.filter((row) => row.week === 3));
    expect(analysis.reduce((sum, item) => sum + item.drawn, 0)).toBe(6);
    expect(analysis.reduce((sum, item) => sum + item.blank, 0)).toBe(3);
    expect(analysis.every((item) => item.flag === null)).toBe(true);
  });

  it("flags items that are too hard or too easy once enough responses exist", () => {
    const bank = quizWeek(1);
    const rows = Array.from({ length: 6 }, (_, index) => ({
      id: `r${index}`, week: 1, attempt: 1, answers: bank.items.map((item, itemIndex) => (itemIndex === 0 ? (item.correct + 1) % 4 : item.correct)),
      correct_count: 5, total: 6, score: 83.33, late: false, started_at: null, submitted_at: "x", status: "submitted" as const,
      drawn_item_ids: null, option_orders: null, saved_answers: null, expires_at: null,
    }));
    const analysis = itemAnalysis(bank, rows);
    expect(analysis[0]).toMatchObject({ drawn: 6, percentCorrect: 0, flag: "hard" });
    expect(analysis[1]).toMatchObject({ percentCorrect: 100, flag: "easy" });
    expect(analysis[0].optionCounts[(bank.items[0].correct + 1) % 4]).toBe(6);
  });
});
