import { createCourseAdminClient } from "@/lib/server/course-db";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { apiError, ok } from "@/lib/server/errors";
import { loadRoster, type RosterStatus } from "@/lib/server/roster";
import { requireInstructor } from "@/lib/server/session";

const STATUSES: RosterStatus[] = ["not_started", "in_progress", "ready", "submitted", "revision_requested", "graded"];

/** Cohort aggregates with explicit denominators (active students only, no test accounts). */
export async function GET() {
  try {
    await requireInstructor();
    const admin = createCourseAdminClient();
    const effective = await loadEffectiveAssignments(admin);
    const roster = (await loadRoster(admin, effective.assignments)).filter((student) => student.enrollment_status === "active");
    const denominator = roster.length;
    const assignments = effective.assignments.map((assignment) => {
      const cells = roster.map((student) => student.cells.find((cell) => cell.assignment_id === assignment.id)!).filter(Boolean);
      const graded = cells.filter((cell) => cell.status === "graded" && cell.score != null);
      const scores = graded.map((cell) => Number(cell.score)).sort((a, b) => a - b);
      const median = scores.length ? (scores.length % 2 ? scores[(scores.length - 1) / 2] : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2) : null;
      return {
        assignment_id: assignment.id,
        shortTitle: assignment.shortTitle,
        dueAt: assignment.dueAt,
        denominator,
        counts: Object.fromEntries(STATUSES.map((status) => [status, cells.filter((cell) => cell.status === status).length])),
        submitted: cells.filter((cell) => cell.submitted_at).length,
        late: cells.filter((cell) => cell.late).length,
        withImportedEvidence: cells.filter((cell) => cell.imported_units > 0).length,
        meanScore: scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : null,
        medianScore: median,
        gradedCount: scores.length,
        meanPercent: cells.length ? Math.round(cells.reduce((sum, cell) => sum + cell.percent, 0) / cells.length) : 0,
      };
    });
    const { data: recent } = await admin.from("ehr_activity_events").select("email,occurred_at").gte("occurred_at", new Date(Date.now() - 7 * 86400000).toISOString()).limit(5000);
    const activeLastWeek = new Set((recent ?? []).map((row) => row.email).filter((email) => roster.some((student) => student.email === email))).size;
    return ok({ generatedAt: new Date().toISOString(), denominator, activeLastWeek, assignments, note: "Denominator = enrolled students with status active. Test accounts and staff are excluded." });
  } catch (error) {
    return apiError(error);
  }
}
