import { describe, expect, it } from "vitest";
import { attemptsAllowed, feedbackUnlocked, isClosed, quizCategoryScore, quizWeek, quizWeeks, score, studentQuestions, type AttemptRow } from "@/lib/server/quizzes";

const attempt = (week: number, attemptNo: number, value: number): AttemptRow => ({ id: `${week}-${attemptNo}`, week, attempt: attemptNo, answers: [], correct_count: 0, total: 6, score: value, late: false, submitted_at: "2026-10-01T00:00:00Z" });

describe("quiz bank", () => {
  it("has twelve weeks of six four-option questions with six graded weeks", () => {
    const weeks = quizWeeks();
    expect(weeks.length).toBe(12);
    expect(weeks.every((week) => week.items.length === 6 && week.items.every((item) => item.options.length === 4 && item.correct >= 0 && item.correct < 4))).toBe(true);
    expect(weeks.filter((week) => week.graded).map((week) => week.week)).toEqual([1, 3, 4, 6, 7, 9]);
  });
  it("never sends answers or rationales to students", () => {
    const shown = studentQuestions(quizWeek(3));
    expect(Object.keys(shown[0])).toEqual(["id", "question", "options"]);
  });
  it("scores attempts and applies attempt limits", () => {
    const week = quizWeek(1);
    const perfect = score(week, week.items.map((item) => item.correct));
    expect(perfect.percent).toBe(100);
    const none = score(week, week.items.map((item) => (item.correct + 1) % 4));
    expect(none.correctCount).toBe(0);
    expect(attemptsAllowed(quizWeek(1))).toBe(2);
    expect(attemptsAllowed(quizWeek(2))).toBeGreaterThan(2);
  });
  it("unlocks feedback after the final graded attempt or the due date", () => {
    const graded = quizWeek(1);
    expect(feedbackUnlocked(graded, 1, Date.parse("2026-09-22T00:00:00Z"))).toBe(false);
    expect(feedbackUnlocked(graded, 2, Date.parse("2026-09-22T00:00:00Z"))).toBe(true);
    expect(feedbackUnlocked(graded, 0, Date.parse("2026-12-01T00:00:00Z"))).toBe(true);
    expect(isClosed(graded, Date.parse("2026-12-01T00:00:00Z"))).toBe(true);
    expect(feedbackUnlocked(quizWeek(2), 1)).toBe(true);
  });
  it("drops the lowest graded quiz and keeps the best attempt per week", () => {
    const byWeek = new Map<number, AttemptRow[]>([[1, [attempt(1, 1, 50), attempt(1, 2, 100)]], [3, [attempt(3, 1, 80)]], [4, [attempt(4, 1, 90)]], [6, [attempt(6, 1, 70)]], [7, [attempt(7, 1, 60)]], [9, [attempt(9, 1, 100)]], [2, [attempt(2, 1, 10)]]]);
    const result = quizCategoryScore(byWeek, quizWeeks());
    expect(result.dropped).toBe(60);
    expect(result.counted).toBe(5);
    expect(result.score).toBe(88);
  });
});
