import { createCourseAdminClient } from "@/lib/server/course-db";
import { apiError, ok } from "@/lib/server/errors";
import { startAttempt } from "@/lib/server/quiz-store";
import { parseWeekParam } from "@/lib/server/quizzes";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireCourseUser } from "@/lib/server/session";

/**
 * Start a timed attempt: draws questions at random, shuffles options, and
 * starts the clock. If an attempt is already in progress it is returned
 * unchanged (no redraw, no timer reset).
 */
export async function POST(_request: Request, context: { params: Promise<{ week: string }> }) {
  try {
    const user = await requireCourseUser();
    const week = parseWeekParam((await context.params).week);
    const admin = createCourseAdminClient();
    await enforceRateLimit(admin, `quiz-start:${user.email}`, 20, 600);
    return ok(await startAttempt(admin, user.email, week));
  } catch (error) {
    return apiError(error);
  }
}
