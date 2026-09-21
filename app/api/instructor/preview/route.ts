import { createCourseAdminClient, isFordhamEmail, logAdminEvent, normalizeEmail } from "@/lib/server/course-db";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { requireInstructor } from "@/lib/server/session";
import { queryParam } from "@/lib/server/validation";

/** Read-only view of one student's workspace, progress, and submissions. */
export async function GET(request: Request) {
  try {
    const instructor = await requireInstructor();
    const email = normalizeEmail(queryParam(request, "email"));
    if (!isFordhamEmail(email)) throw new ApiError(400, "A student email is required.", "VALIDATION");
    const admin = createCourseAdminClient();
    const [effective, user, workspace, progress, submissions] = await Promise.all([
      loadEffectiveAssignments(admin),
      admin.from("ehr_course_users").select("email,name,role,enrollment_status,last_login_at").eq("email", email).maybeSingle(),
      admin.from("ehr_user_workspaces").select("workspace,updated_at,reset_markers").eq("email", email).maybeSingle(),
      admin.from("ehr_assignment_progress").select("assignment_id,progress,percent_complete,status,earned_units,imported_units,total_units,completed_at,updated_at").eq("email", email),
      admin.from("ehr_assignment_submissions").select("assignment_id,status,version,score,rubric_total,feedback,submitted_at,graded_at,graded_by,returned_at,return_comment,late").eq("email", email),
    ]);
    for (const result of [user, workspace, progress, submissions]) if (result.error) throw result.error;
    if (!user.data) throw new ApiError(404, "That student has not signed in to FordMS.", "NOT_FOUND");
    await logAdminEvent(admin, instructor.email, "preview", "user", email, {});
    return ok({
      student: user.data,
      assignments: effective.assignments,
      releases: effective.releases,
      workspace: workspace.data?.workspace ?? null,
      workspaceUpdatedAt: workspace.data?.updated_at ?? null,
      resetMarkers: workspace.data?.reset_markers ?? {},
      progress: progress.data ?? [],
      submissions: submissions.data ?? [],
    });
  } catch (error) {
    return apiError(error);
  }
}
