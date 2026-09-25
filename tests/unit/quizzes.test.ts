import { describe, expect, it } from "vitest";
import legacyW1 from "@/lib/server/quiz-bank.legacy-w01.json";
import installedBank from "@/lib/server/quiz-bank.json";
import {
  bankWeek,
  computeExpiresAt,
  defaultWindow,
  drawItemIds,
  effectiveQuiz,
  feedbackState,
  isExpired,
  optionOrder,
  presentQuestions,
  quizCategoryScore,
  quizDefaults,
  quizWeek,
  quizWeeks,
  score,
  scoreItems,
  shuffle,
  studentQuestions,
  studentQuiz,
  toDisplayedAnswers,
  toOriginalAnswers,
  type AttemptRow,
  type QuizSettingsRow,
} from "@/lib/server/quizzes";
import { formatCountdown, formatEt, fromEtInput, toEtInput } from "@/lib/quiz-time";
import { validateQuizBank } from "../../scripts/quiz_bank_validate.mjs";

const row = (week: number, attempt: number, value: number, extra: Partial<AttemptRow> = {}): AttemptRow => ({
  id: `${week}-${attempt}`, week, attempt, answers: [], correct_count: 0, total: 6, score: value, late: false,
  started_at: null, submitted_at: "2026-10-01T00:00:00Z", status: "submitted", drawn_item_ids: null, option_orders: null,
  saved_answers: null, expires_at: null, ...extra,
});

/** Deterministic pseudo-random source for reproducible draws. */
function seeded(seed = 7) {
  let state = seed;
  return (max: number) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % max;
  };
}

describe("installed quiz bank", () => {
  it("passes the import validator, including the legacy week-1 check", () => {
    expect(validateQuizBank(installedBank, { legacy: legacyW1 })).toEqual([]);
  });
  it("keeps week 1 as the legacy six items in their original order", () => {
    const week1 = quizWeek(1);
    expect(week1.legacy).toBe(true);
    expect(week1.graded).toBe(true);
    expect(week1.items.map((item) => [item.id, item.correct])).toEqual(legacyW1.items.map((item: { id: string; correct: number }) => [item.id, item.correct]));
  });
  it("lists all twelve authored weeks, with graded weeks timed and drawn from the pool", () => {
    expect(quizWeeks().map((week) => week.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const week3 = quizDefaults(3, true);
    expect(week3.available).toBe(true);
    expect(week3).toMatchObject({ graded: true, mode: "drawn", drawCount: 6, timeLimitMin: 15, showAnswers: "after_close" });
    expect(week3.poolSize).toBeGreaterThanOrEqual(15);
    expect(week3.opensAt).toBe(defaultWindow(3).opensAt);
  });
  it("gives week 2 a sixteen-item pool drawn six at a time, untimed, as a review quiz", () => {
    const week2 = quizDefaults(2, true);
    expect(week2).toMatchObject({ graded: false, mode: "drawn", drawCount: 6, poolSize: 16, timeLimitMin: null, attemptsAllowed: null, showAnswers: "after_submit", closesAt: null });
  });
  it("never sends answers or rationales to students", () => {
    expect(Object.keys(studentQuestions(quizWeek(2))[0])).toEqual(["id", "question", "options"]);
    const shown = presentQuestions(quizWeek(2).items.slice(0, 2), [[3, 2, 1, 0], [1, 0, 3, 2]]);
    expect(Object.keys(shown[0])).toEqual(["id", "question", "options"]);
  });
});

describe("bank validator", () => {
  const base = () => JSON.parse(JSON.stringify(installedBank));
  it("rejects bad answer keys and short pools", () => {
    const bank = base();
    bank.weeks[1].items[0].correct = 4;
    bank.weeks[1].items = bank.weeks[1].items.slice(0, 3);
    const errors = validateQuizBank(bank, { legacy: legacyW1 });
    expect(errors.some((error: string) => /correct must be 0-3/.test(error))).toBe(true);
    expect(errors.some((error: string) => /pool has 3 items but draws 6/.test(error))).toBe(true);
  });
  it("refuses a legacy week whose items were reordered", () => {
    const bank = base();
    bank.weeks[0].items.reverse();
    expect(validateQuizBank(bank, { legacy: legacyW1 }).join(" ")).toMatch(/legacy items differ/);
  });
});

describe("draw and shuffle", () => {
  it("draws distinct items from the pool", () => {
    const week = quizWeek(2);
    for (let run = 0; run < 50; run += 1) {
      const ids = drawItemIds(week, 6);
      expect(new Set(ids).size).toBe(6);
      expect(ids.every((id) => week.items.some((item) => item.id === id))).toBe(true);
    }
  });
  it("eventually draws every item (crypto randomness covers the pool)", () => {
    const seen = new Set<string>();
    for (let run = 0; run < 200; run += 1) drawItemIds(quizWeek(2), 6).forEach((id) => seen.add(id));
    expect(seen.size).toBe(16);
  });
  it("produces permutations", () => {
    const random = seeded();
    for (let run = 0; run < 20; run += 1) expect([...optionOrder(4, random)].sort()).toEqual([0, 1, 2, 3]);
    expect(shuffle([1, 2, 3], () => 0)).toHaveLength(3);
  });
  it("round-trips displayed and original answers and scores through the shuffle", () => {
    const random = seeded(11);
    const items = quizWeek(2).items.slice(0, 6);
    const orders = items.map(() => optionOrder(4, random));
    // The student picks the displayed position of each correct answer.
    const displayed = items.map((item, index) => orders[index].indexOf(item.correct));
    const original = toOriginalAnswers(displayed, orders);
    expect(original).toEqual(items.map((item) => item.correct));
    expect(toDisplayedAnswers(original, orders)).toEqual(displayed);
    expect(scoreItems(items, original).percent).toBe(100);
    // Picking displayed option 0 everywhere scores the items whose correct answer was shown first.
    const zeros = toOriginalAnswers(items.map(() => 0), orders);
    const expected = items.filter((item, index) => orders[index][0] === item.correct).length;
    expect(scoreItems(items, zeros).correctCount).toBe(expected);
    expect(toOriginalAnswers([null, 2], orders.slice(0, 2))[0]).toBeNull();
  });
  it("scores legacy attempts against items in bank order", () => {
    const week = quizWeek(1);
    expect(score(week, week.items.map((item) => item.correct)).percent).toBe(100);
    expect(score(week, week.items.map((item) => (item.correct + 1) % 4)).correctCount).toBe(0);
  });
});

describe("effective settings and extensions", () => {
  const settings = (patch: Partial<QuizSettingsRow>): QuizSettingsRow => ({
    week: 2, opens_at: null, closes_at: null, time_limit_min: null, draw_count: null, attempts_allowed: null, show_answers: null, ...patch,
  });
  it("lets the settings row override bank defaults", () => {
    const quiz = effectiveQuiz(2, settings({ time_limit_min: 20, draw_count: 8, attempts_allowed: 3, closes_at: "2026-10-04T23:59:00-04:00", show_answers: "after_close" }), true);
    expect(quiz).toMatchObject({ timeLimitMin: 20, drawCount: 8, attemptsAllowed: 3, showAnswers: "after_close", closesAt: "2026-10-04T23:59:00-04:00" });
    expect(quiz.overridden.sort()).toEqual(["attemptsAllowed", "closesAt", "drawCount", "showAnswers", "timeLimitMin"]);
  });
  it("treats 0 as untimed / unlimited and clamps the draw to the pool", () => {
    const quiz = effectiveQuiz(2, settings({ time_limit_min: 0, attempts_allowed: 0, draw_count: 99 }), true);
    expect(quiz.timeLimitMin).toBeNull();
    expect(quiz.attemptsAllowed).toBeNull();
    expect(quiz.drawCount).toBe(16);
  });
  it("ignores settings when migration 012 is missing", () => {
    expect(effectiveQuiz(2, settings({ time_limit_min: 20 }), false)).toMatchObject({ mode: "fixed", timeLimitMin: null });
  });
  it("keeps legacy week 1 fixed and untimed whatever the settings say", () => {
    const quiz = effectiveQuiz(1, settings({ week: 1, time_limit_min: 15, draw_count: 3, closes_at: "2026-09-30T23:59:00-04:00" }), true);
    expect(quiz).toMatchObject({ mode: "fixed", timeLimitMin: null, drawCount: 6, closesAt: "2026-09-30T23:59:00-04:00" });
  });
  it("adds extension minutes to the limit and applies the close override", () => {
    const base = effectiveQuiz(2, settings({ time_limit_min: 15, closes_at: "2026-10-04T23:59:00-04:00" }), true);
    const quiz = studentQuiz(base, { email: "s@fordham.edu", week: 2, extra_minutes: 10, closes_at_override: "2026-10-06T23:59:00-04:00", reason: null });
    expect(quiz.timeLimitMin).toBe(25);
    expect(quiz.closesAt).toBe("2026-10-06T23:59:00-04:00");
    expect(quiz.closeOverridden).toBe(true);
  });
  it("caps the attempt at the close time", () => {
    const quiz = studentQuiz(effectiveQuiz(2, settings({ time_limit_min: 15, closes_at: "2026-10-05T04:00:00Z" }), true), null);
    expect(computeExpiresAt(quiz, Date.parse("2026-10-05T03:55:00Z"))).toBe("2026-10-05T04:00:00.000Z");
    expect(computeExpiresAt(quiz, Date.parse("2026-10-05T03:00:00Z"))).toBe("2026-10-05T03:15:00.000Z");
    expect(computeExpiresAt(studentQuiz(quizDefaults(2, true), null), 0)).toBeNull();
  });
  it("expires attempts only after the 30-second grace period", () => {
    const open = { status: "in_progress" as const, expires_at: "2026-10-05T03:15:00Z" };
    expect(isExpired(open, Date.parse("2026-10-05T03:15:20Z"))).toBe(false);
    expect(isExpired(open, Date.parse("2026-10-05T03:15:31Z"))).toBe(true);
    expect(isExpired({ ...open, status: "submitted" }, Date.parse("2026-10-06T00:00:00Z"))).toBe(false);
  });
});

describe("feedback gating", () => {
  it("shows graded feedback only after the student's effective close", () => {
    const graded = studentQuiz(quizDefaults(1, true), null);
    expect(feedbackState(graded, 2, Date.parse("2026-09-25T00:00:00Z")).unlocked).toBe(false);
    expect(feedbackState(graded, 1, Date.parse("2026-09-28T04:00:00Z")).unlocked).toBe(true);
    const extended = studentQuiz(quizDefaults(1, true), { email: "s@fordham.edu", week: 1, extra_minutes: 0, closes_at_override: "2026-09-30T23:59:00-04:00", reason: null });
    expect(feedbackState(extended, 1, Date.parse("2026-09-28T04:00:00Z")).unlocked).toBe(false);
  });
  it("shows review-week feedback right after each submit", () => {
    const review = studentQuiz(quizDefaults(2, true), null);
    expect(feedbackState(review, 0).unlocked).toBe(false);
    expect(feedbackState(review, 1).unlocked).toBe(true);
  });
});

describe("quiz category score", () => {
  it("keeps the best attempt per graded week and drops the lowest week", () => {
    const byWeek = new Map<number, AttemptRow[]>([
      [1, [row(1, 1, 50), row(1, 2, 100)]], [3, [row(3, 1, 80)]], [4, [row(4, 1, 90)]], [6, [row(6, 1, 70)]],
      [7, [row(7, 1, 60)]], [9, [row(9, 1, 100)]], [2, [row(2, 1, 10)]],
    ]);
    const result = quizCategoryScore(byWeek, [1, 3, 4, 6, 7, 9]);
    expect(result).toMatchObject({ dropped: 60, droppedWeek: 7, counted: 5, score: 88 });
  });
  it("ignores in-progress attempts and counts drawn attempts", () => {
    const byWeek = new Map<number, AttemptRow[]>([
      [1, [row(1, 1, 80)]],
      [3, [row(3, 1, 100, { drawn_item_ids: ["x"] }), row(3, 2, 0, { status: "in_progress", submitted_at: null })]],
    ]);
    const result = quizCategoryScore(byWeek, [1, 3, 4, 6, 7, 9], new Set([1, 3]));
    expect(result).toMatchObject({ score: 100, counted: 1, dropped: 80, droppedWeek: 1 });
  });
  it("counts a missed quiz as 0 only once it has closed", () => {
    const byWeek = new Map<number, AttemptRow[]>([[1, [row(1, 1, 90)]]]);
    expect(quizCategoryScore(byWeek, [1, 3, 4], new Set([1])).score).toBe(90);
    expect(quizCategoryScore(byWeek, [1, 3, 4], new Set([1, 3]))).toMatchObject({ score: 90, dropped: 0, droppedWeek: 3 });
    expect(quizCategoryScore(new Map(), [1, 3], new Set()).score).toBeNull();
  });
});

describe("Eastern time helpers", () => {
  it("converts ET wall time to UTC across daylight saving time", () => {
    expect(fromEtInput("2026-10-05T21:00")).toBe("2026-10-06T01:00:00.000Z");
    expect(fromEtInput("2026-11-09T21:00")).toBe("2026-11-10T02:00:00.000Z");
    expect(toEtInput("2026-10-06T01:00:00.000Z")).toBe("2026-10-05T21:00");
    expect(toEtInput(fromEtInput("2026-11-01T01:30"))).toBe("2026-11-01T01:30");
  });
  it("formats chips and countdowns", () => {
    expect(formatEt("2026-10-05T21:00:00-04:00")).toBe("Mon Oct 5, 9:00 PM");
    expect(formatCountdown(125)).toBe("2:05");
    expect(formatCountdown(3725)).toBe("1:02:05");
  });
});
