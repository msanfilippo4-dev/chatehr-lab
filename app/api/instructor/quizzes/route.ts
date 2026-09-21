import { createCourseAdminClient } from "@/lib/server/course-db";
import { apiError, ok } from "@/lib/server/errors";
import { bestScore, quizCategoryScore, quizWeeks, type AttemptRow } from "@/lib/server/quizzes";
import { requireInstructor } from "@/lib/server/session";
import { queryParam } from "@/lib/server/validation";

/** Quiz results matrix: best score per week per student plus the category score. */
export async function GET(request: Request) {
  try {
    await requireInstructor();
    const includeTest = queryParam(request, "includeTest") === "1";
    const admin = createCourseAdminClient();
    const [users, attempts] = await Promise.all([
      admin.from("ehr_course_users").select("email,name,first_name,last_name,role,enrollment_status").eq("role", "student").order("last_name", { nullsFirst: false }),
      admin.from("ehr_quiz_attempts").select("id,email,week,attempt,answers,correct_count,total,score,late,submitted_at").order("week").order("attempt"),
    ]);
    if (users.error) throw users.error;
    if (attempts.error) throw attempts.error;
    const weeks = quizWeeks();
    const students = (users.data ?? []).filter((user) => includeTest || user.enrollment_status !== "test").map((user) => {
      const byWeek = new Map<number, AttemptRow[]>();
      for (const row of attempts.data ?? []) if (row.email === user.email) byWeek.set(row.week, [...(byWeek.get(row.week) ?? []), { ...row, score: Number(row.score) }]);
      return {
        email: user.email, name: user.name, first_name: user.first_name, last_name: user.last_name, enrollment_status: user.enrollment_status,
        weeks: weeks.map((week) => { const rows = byWeek.get(week.week) ?? []; return { week: week.week, graded: week.graded, attempts: rows.length, best: bestScore(rows), late: rows.some((row) => row.late) }; }),
        category: quizCategoryScore(byWeek, weeks),
      };
    });
    return ok({ weeks: weeks.map((week) => ({ week: week.week, title: week.title, graded: week.graded, dueAt: week.dueAt })), students, generatedAt: new Date().toISOString() });
  } catch (error) {
    return apiError(error);
  }
}
