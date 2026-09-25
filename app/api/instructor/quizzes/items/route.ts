import { createCourseAdminClient } from "@/lib/server/course-db";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { loadClassContext } from "@/lib/server/quiz-store";
import { ITEM_FLAG_MIN_RESPONSES, bankWeek, itemAnalysis, parseWeekParam } from "@/lib/server/quizzes";
import { requireInstructor } from "@/lib/server/session";
import { queryParam } from "@/lib/server/validation";

/** Item analysis for one week: times drawn, percent correct, option choice counts, flags. */
export async function GET(request: Request) {
  try {
    await requireInstructor();
    const week = parseWeekParam(queryParam(request, "week"));
    const bank = bankWeek(week);
    if (!bank) throw new ApiError(404, "That week is not in the quiz bank yet.", "NOT_FOUND");
    const includeTest = queryParam(request, "includeTest") === "1";
    const context = await loadClassContext(createCourseAdminClient(), { includeTest, week });
    const emails = new Set(context.students.map((student) => student.email));
    const rows = context.attempts.filter((row) => emails.has(row.email));
    return ok({
      week,
      title: bank.title,
      attempts: rows.filter((row) => row.status !== "in_progress").length,
      flagMinResponses: ITEM_FLAG_MIN_RESPONSES,
      items: itemAnalysis(bank, rows).map((item) => ({ ...item, options: bank.items.find((entry) => entry.id === item.id)?.options ?? [] })),
    });
  } catch (error) {
    return apiError(error);
  }
}
