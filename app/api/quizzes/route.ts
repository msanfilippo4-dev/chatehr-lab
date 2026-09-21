import { createCourseAdminClient } from "@/lib/server/course-db";
import { apiError, ok } from "@/lib/server/errors";
import { attemptsAllowed, bestScore, feedbackUnlocked, isClosed, loadAttempts, quizCategoryScore, quizWeeks } from "@/lib/server/quizzes";
import { requireCourseUser } from "@/lib/server/session";

/** Weekly quiz list with the signed-in learner's attempt state. */
export async function GET() {
  try {
    const user = await requireCourseUser();
    const admin = createCourseAdminClient();
    const attempts = await loadAttempts(admin, user.email);
    const byWeek = new Map<number, typeof attempts>();
    for (const row of attempts) byWeek.set(row.week, [...(byWeek.get(row.week) ?? []), row]);
    const weeks = quizWeeks().map((week) => {
      const rows = byWeek.get(week.week) ?? [];
      return {
        week: week.week,
        title: week.title,
        date: week.date,
        dueAt: week.dueAt,
        graded: week.graded,
        questionCount: week.items.length,
        attemptsUsed: rows.length,
        attemptsAllowed: attemptsAllowed(week),
        bestScore: bestScore(rows),
        closed: isClosed(week),
        feedbackUnlocked: feedbackUnlocked(week, rows.length),
        lastSubmittedAt: rows.at(-1)?.submitted_at ?? null,
      };
    });
    return ok({ weeks, category: quizCategoryScore(byWeek, quizWeeks()), rules: { gradedAttempts: 2, highestKept: true, lowestDropped: true } });
  } catch (error) {
    return apiError(error);
  }
}
