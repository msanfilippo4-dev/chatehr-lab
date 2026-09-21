import { splitName, toBlackboardCsv, toCsv, type GradeExportRow } from "@/lib/csv";
import { bestScore, quizCategoryScore, quizWeeks, type AttemptRow } from "@/lib/server/quizzes";
import { createCourseAdminClient, logAdminEvent } from "@/lib/server/course-db";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { ApiError, apiError } from "@/lib/server/errors";
import { loadRoster } from "@/lib/server/roster";
import { requireInstructor } from "@/lib/server/session";
import { queryParam } from "@/lib/server/validation";

export async function GET(request: Request) {
  try {
    const instructor = await requireInstructor();
    const format = queryParam(request, "format", "blackboard");
    const scale = queryParam(request, "scale", "rubric") === "course" ? "course" : "rubric";
    const assignmentFilter = queryParam(request, "assignment", "all");
    const includeTest = queryParam(request, "includeTest") === "1";
    if (format !== "blackboard") throw new ApiError(400, "Unsupported export format.", "VALIDATION");
    const admin = createCourseAdminClient();
    if (queryParam(request, "scope") === "quizzes") return quizCsv(admin, instructor.email, includeTest);
    const effective = await loadEffectiveAssignments(admin);
    const assignments = effective.assignments.filter((item) => assignmentFilter === "all" || item.id === assignmentFilter);
    if (!assignments.length) throw new ApiError(400, "Unknown assignment.", "VALIDATION");
    const roster = await loadRoster(admin, assignments, { includeTest });
    const rows: GradeExportRow[] = roster
      .filter((student) => student.enrollment_status === "active" || (includeTest && student.enrollment_status === "test"))
      .map((student) => {
        const names = splitName(student.name, student.email);
        return {
          lastName: student.last_name ?? names.lastName,
          firstName: student.first_name ?? names.firstName,
          username: student.blackboard_username ?? student.email.split("@")[0],
          scores: Object.fromEntries(student.cells.map((cell) => [cell.assignment_id, cell.status === "graded" ? cell.score : null])),
        };
      });
    const csv = toBlackboardCsv(rows, assignments, scale);
    await logAdminEvent(admin, instructor.email, "grades_exported", "gradebook", assignmentFilter, { scale, rows: rows.length });
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fordms-grades-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

async function quizCsv(admin: ReturnType<typeof createCourseAdminClient>, actor: string, includeTest: boolean) {
  const [users, attempts] = await Promise.all([
    admin.from("ehr_course_users").select("email,name,first_name,last_name,role,enrollment_status,blackboard_username").eq("role", "student"),
    admin.from("ehr_quiz_attempts").select("email,week,attempt,answers,correct_count,total,score,late,submitted_at"),
  ]);
  if (users.error) throw users.error;
  if (attempts.error) throw attempts.error;
  const weeks = quizWeeks();
  const graded = weeks.filter((week) => week.graded);
  const rows = (users.data ?? []).filter((user) => user.enrollment_status === "active" || (includeTest && user.enrollment_status === "test")).map((user) => {
    const byWeek = new Map<number, AttemptRow[]>();
    for (const row of attempts.data ?? []) if (row.email === user.email) byWeek.set(row.week, [...(byWeek.get(row.week) ?? []), { ...row, id: "", score: Number(row.score) }]);
    const names = splitName(user.name, user.email);
    return { lastName: user.last_name ?? names.lastName, firstName: user.first_name ?? names.firstName, username: user.blackboard_username ?? user.email.split("@")[0], best: Object.fromEntries(graded.map((week) => [week.week, bestScore(byWeek.get(week.week) ?? [])])), category: quizCategoryScore(byWeek, weeks).score };
  });
  const csv = toCsv(rows, [
    { header: "Last Name", value: (row) => row.lastName },
    { header: "First Name", value: (row) => row.firstName },
    { header: "Username", value: (row) => row.username },
    ...graded.map((week) => ({ header: `Quiz Week ${week.week} [Total Pts: 100 Score]`, value: (row: (typeof rows)[number]) => (row.best[week.week] == null ? "" : Number(row.best[week.week]).toFixed(2)) })),
    { header: "Quiz category, lowest dropped [Total Pts: 100 Score]", value: (row) => (row.category == null ? "" : row.category.toFixed(2)) },
  ]);
  await logAdminEvent(admin, actor, "grades_exported", "quizzes", "all", { rows: rows.length });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="fordms-quizzes-${stamp}.csv"`, "Cache-Control": "no-store" } });
}
