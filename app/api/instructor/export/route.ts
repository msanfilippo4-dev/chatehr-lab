import { splitName, toBlackboardCsv, type GradeExportRow } from "@/lib/csv";
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
