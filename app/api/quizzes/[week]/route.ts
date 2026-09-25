import { createCourseAdminClient } from "@/lib/server/course-db";
import { apiError, ok } from "@/lib/server/errors";
import { QuizAttemptAnswersSchema, QuizSubmitSchema } from "@/lib/schemas/api";
import { autosaveAttempt, loadStudentContext, studentDetail, submitDrawnAttempt, submitFixedAttempt } from "@/lib/server/quiz-store";
import { parseWeekParam } from "@/lib/server/quizzes";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireCourseUser } from "@/lib/server/session";
import { parseJsonBody } from "@/lib/server/validation";

type WeekContext = { params: Promise<{ week: string }> };

/** Quiz detail: window, attempts, the in-progress attempt (for resume), and unlocked feedback. */
export async function GET(_request: Request, context: WeekContext) {
  try {
    const user = await requireCourseUser();
    const week = parseWeekParam((await context.params).week);
    const state = await loadStudentContext(createCourseAdminClient(), user.email);
    return ok(studentDetail(state, week));
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Submit. With `attempt`, submits a drawn attempt (answers in displayed order).
 * Without it, records a one-step fixed attempt (legacy week 1, or any week
 * while migration 012 is not applied).
 */
export async function POST(request: Request, context: WeekContext) {
  try {
    const user = await requireCourseUser();
    const week = parseWeekParam((await context.params).week);
    const body = await parseJsonBody(request, QuizSubmitSchema);
    const admin = createCourseAdminClient();
    await enforceRateLimit(admin, `quiz:${user.email}`, 30, 600);
    if ("attempt" in body) return ok(await submitDrawnAttempt(admin, user.email, week, body.attempt, body.answers));
    return ok(await submitFixedAttempt(admin, user.email, week, body.answers));
  } catch (error) {
    return apiError(error);
  }
}

/** Autosave answers for the in-progress attempt. */
export async function PATCH(request: Request, context: WeekContext) {
  try {
    const user = await requireCourseUser();
    const week = parseWeekParam((await context.params).week);
    const body = await parseJsonBody(request, QuizAttemptAnswersSchema);
    const admin = createCourseAdminClient();
    await enforceRateLimit(admin, `quiz-save:${user.email}`, 300, 600);
    return ok(await autosaveAttempt(admin, user.email, week, body.attempt, body.answers));
  } catch (error) {
    return apiError(error);
  }
}
