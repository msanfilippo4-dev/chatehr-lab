import { z } from "zod";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { attemptsAllowed, feedbackUnlocked, isClosed, loadAttempts, quizWeek, score, studentQuestions } from "@/lib/server/quizzes";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireCourseUser } from "@/lib/server/session";
import { parseJsonBody } from "@/lib/server/validation";

const AttemptBodySchema = z.object({ answers: z.array(z.number().int().min(0).max(3).nullable()).length(6) });

function parseWeek(value: string) {
  const week = Number(value);
  if (!Number.isInteger(week) || week < 1 || week > 12) throw new ApiError(404, "That quiz does not exist.", "NOT_FOUND");
  return week;
}

function feedbackFor(week: ReturnType<typeof quizWeek>, attempts: Awaited<ReturnType<typeof loadAttempts>>) {
  const unlocked = feedbackUnlocked(week, attempts.length);
  return {
    unlocked,
    items: unlocked ? week.items.map((item) => ({ id: item.id, correct: item.correct, rationale: item.rationale })) : [],
  };
}

export async function GET(_request: Request, context: { params: Promise<{ week: string }> }) {
  try {
    const user = await requireCourseUser();
    const { week: weekParam } = await context.params;
    const week = quizWeek(parseWeek(weekParam));
    const attempts = await loadAttempts(createCourseAdminClient(), user.email, week.week);
    return ok({
      week: week.week, title: week.title, date: week.date, dueAt: week.dueAt, graded: week.graded,
      questions: studentQuestions(week),
      attempts: attempts.map((row) => ({ attempt: row.attempt, score: row.score, correctCount: row.correct_count, total: row.total, late: row.late, submittedAt: row.submitted_at, answers: row.answers })),
      attemptsAllowed: attemptsAllowed(week),
      closed: isClosed(week),
      feedback: feedbackFor(week, attempts),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ week: string }> }) {
  try {
    const user = await requireCourseUser();
    const { week: weekParam } = await context.params;
    const week = quizWeek(parseWeek(weekParam));
    const body = await parseJsonBody(request, AttemptBodySchema);
    const admin = createCourseAdminClient();
    await enforceRateLimit(admin, `quiz:${user.email}`, 30, 600);
    const previous = await loadAttempts(admin, user.email, week.week);
    if (isClosed(week)) throw new ApiError(403, "This quiz closed at its due date. Contact the instructor if you need an extension.", "CLOSED");
    if (previous.length >= attemptsAllowed(week)) throw new ApiError(409, `You have used all ${attemptsAllowed(week)} attempts for this quiz.`, "NO_ATTEMPTS_LEFT");
    if (body.answers.some((value) => value === null)) throw new ApiError(400, "Answer every question before submitting.", "INCOMPLETE");
    const result = score(week, body.answers);
    const attempt = previous.length + 1;
    const late = Boolean(week.dueAt) && Date.parse(week.dueAt!) < Date.now();
    const { error } = await admin.from("ehr_quiz_attempts").insert({ email: user.email, week: week.week, attempt, answers: body.answers, correct_count: result.correctCount, total: result.total, score: result.percent, late });
    if (error) throw error;
    const attempts = await loadAttempts(admin, user.email, week.week);
    return ok({
      attempt, score: result.percent, correctCount: result.correctCount, total: result.total,
      attemptsRemaining: Math.max(0, attemptsAllowed(week) - attempts.length),
      bestScore: Math.max(...attempts.map((row) => row.score)),
      feedback: feedbackFor(week, attempts),
      perQuestion: feedbackUnlocked(week, attempts.length) ? result.detail : undefined,
    });
  } catch (error) {
    return apiError(error);
  }
}
