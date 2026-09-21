import { studentSafeConfig } from "@/lib/config/merge";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { apiError, ok } from "@/lib/server/errors";
import { requireCourseUser } from "@/lib/server/session";

export async function GET() {
  try {
    const user = await requireCourseUser();
    const admin = createCourseAdminClient();
    const [effective, workspaceResult, progressResult, submissionsResult] = await Promise.all([
      loadEffectiveAssignments(admin),
      admin.from("ehr_user_workspaces").select("workspace,updated_at,reset_markers,last_import_at").eq("email", user.email).maybeSingle(),
      admin.from("ehr_assignment_progress").select("assignment_id,progress,percent_complete,status,earned_units,imported_units,total_units,completed_at,updated_at").eq("email", user.email),
      admin.from("ehr_assignment_submissions").select("assignment_id,status,version,score,rubric_total,feedback,submitted_at,graded_at,graded_by,returned_at,return_comment,late").eq("email", user.email),
    ]);
    for (const result of [workspaceResult, progressResult, submissionsResult]) if (result.error) throw result.error;
    const isStaff = user.role !== "student";
    const config = { ...effective.config, assignments: effective.assignments };
    return ok({
      user: { email: user.email, name: user.name, role: user.role },
      assignments: isStaff ? effective.assignments : effective.assignments.filter((item) => item.releaseState !== "hidden"),
      config: isStaff ? config : studentSafeConfig(config),
      configVersion: effective.version,
      invalidSections: isStaff ? effective.invalidSections : undefined,
      releases: effective.releases,
      workspace: workspaceResult.data?.workspace ?? null,
      workspaceUpdatedAt: workspaceResult.data?.updated_at ?? null,
      resetMarkers: workspaceResult.data?.reset_markers ?? {},
      progress: progressResult.data ?? [],
      submissions: submissionsResult.data ?? [],
    });
  } catch (error) {
    return apiError(error);
  }
}
