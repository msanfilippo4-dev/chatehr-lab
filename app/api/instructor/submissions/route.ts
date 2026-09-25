import { createCourseAdminClient, isFordhamEmail, normalizeEmail } from "@/lib/server/course-db";
import { buildAutoChecks } from "@/lib/server/answer-keys";
import { assignmentBenchmarks } from "@/lib/server/assignment-benchmarks";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { requireInstructor } from "@/lib/server/session";
import { loadSubmissionDetail } from "@/lib/server/submissions";
import { queryParam } from "@/lib/server/validation";

export async function GET(request: Request) {
  try {
    await requireInstructor();
    const email = normalizeEmail(queryParam(request, "email"));
    const assignmentId = queryParam(request, "assignmentId");
    if (!isFordhamEmail(email) || !/^FORDMS-A\d$/.test(assignmentId)) throw new ApiError(400, "A student email and assignment id are required.", "VALIDATION");
    const admin = createCourseAdminClient();
    const effective = await loadEffectiveAssignments(admin);
    const assignment = effective.assignments.find((item) => item.id === assignmentId);
    if (!assignment) throw new ApiError(404, "Unknown assignment.", "NOT_FOUND");
    const [detail, progress, workspaceRow] = await Promise.all([
      loadSubmissionDetail(admin, email, assignmentId),
      admin.from("ehr_assignment_progress").select("progress,percent_complete,status,earned_units,imported_units,total_units,updated_at").eq("email", email).eq("assignment_id", assignmentId).maybeSingle(),
      admin.from("ehr_user_workspaces").select("workspace").eq("email", email).maybeSingle(),
    ]);
    if (progress.error) throw progress.error;
    // Auto-checks use the answer keys, which stay on the server; a missing workspace just omits them.
    const autoChecks = workspaceRow.error ? null : buildAutoChecks(assignment.id, workspaceRow.data?.workspace ?? null);
    return ok({ assignment: { ...assignment, instructorBenchmark: assignmentBenchmarks[assignment.id] ?? [] }, progress: progress.data ?? null, submission: detail, autoChecks });
  } catch (error) {
    return apiError(error);
  }
}
