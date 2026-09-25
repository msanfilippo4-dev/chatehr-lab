import { createCourseAdminClient } from "@/lib/server/course-db";
import { apiError, ok } from "@/lib/server/errors";
import { classResults, loadClassContext, settingsOverview } from "@/lib/server/quiz-store";
import { requireInstructor } from "@/lib/server/session";
import { queryParam } from "@/lib/server/validation";

/**
 * Instructor quiz overview: migration status, per-week settings (defaults,
 * overrides, effective), extensions, and the results grid. Reading it also
 * finalizes any expired in-progress attempts.
 */
export async function GET(request: Request) {
  try {
    await requireInstructor();
    const includeTest = queryParam(request, "includeTest") === "1";
    const context = await loadClassContext(createCourseAdminClient(), { includeTest });
    const results = classResults(context);
    const names = new Map(context.students.map((student) => [student.email, student.name]));
    return ok({
      schema: context.schema,
      weeks: settingsOverview(context),
      extensions: context.extensions.map((row) => ({ ...row, name: names.get(row.email) ?? null })),
      students: results.students,
      gradedWeeks: results.gradedWeeks,
      generatedAt: new Date(context.now).toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
