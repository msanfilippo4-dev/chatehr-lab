import { computeProgress } from "@/lib/progress";
import { SubmitBodySchema } from "@/lib/schemas/api";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { loadEventsForUser, loadResetMarkers, resetCutoffFor } from "@/lib/server/progress";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireCourseUser } from "@/lib/server/session";
import { buildEvidence, createSubmissionVersion } from "@/lib/server/submissions";
import { parseJsonBody } from "@/lib/server/validation";

export async function POST(request: Request) {
  try {
    const user = await requireCourseUser();
    const body = await parseJsonBody(request, SubmitBodySchema);
    const admin = createCourseAdminClient();
    await enforceRateLimit(admin, `submit:${user.email}`, 10, 600);

    const effective = await loadEffectiveAssignments(admin);
    const assignment = effective.assignments.find((item) => item.id === body.assignmentId);
    if (!assignment || assignment.releaseState === "hidden") throw new ApiError(403, "This assignment is not open for submission.", "NOT_RELEASED");
    const release = effective.releases.find((row) => row.assignment_id === assignment.id);
    const now = Date.now();
    if (release?.release_at && Date.parse(release.release_at) > now) throw new ApiError(403, "This assignment has not been released yet.", "NOT_RELEASED");
    const late = Boolean(assignment.dueAt && Date.parse(assignment.dueAt) < now);
    if (assignment.releaseState === "closed" || (release?.close_at && Date.parse(release.close_at) < now)) {
      if (!(release?.accept_late ?? true) || assignment.releaseState === "closed") throw new ApiError(403, "This assignment is closed. Contact the instructor if you need an extension.", "CLOSED");
    }

    const [workspaceRow, events, markers] = await Promise.all([
      admin.from("ehr_user_workspaces").select("workspace").eq("email", user.email).maybeSingle(),
      loadEventsForUser(admin, user.email),
      loadResetMarkers(admin, user.email),
    ]);
    if (workspaceRow.error) throw workspaceRow.error;
    const progress = computeProgress(assignment, events, { resetCutoff: resetCutoffFor(markers, assignment.id) });
    if (!progress.complete) throw new ApiError(409, "Complete all required EHR actions before submitting. Save your work and wait for the cloud save confirmation first.", "INCOMPLETE", progress.requirements.filter((item) => !item.complete).map((item) => item.label));

    const evidence = buildEvidence(assignment, progress, events, workspaceRow.data?.workspace ?? null);
    const result = await createSubmissionVersion(admin, {
      email: user.email,
      assignment,
      reflection: body.reflection,
      evidence,
      progress,
      configVersion: effective.version,
      late,
      workspace: workspaceRow.data?.workspace ?? null,
    });
    return ok({ assignmentId: assignment.id, status: "submitted", submittedAt: result.submittedAt, version: result.version, late, importedUnits: progress.importedUnits });
  } catch (error) {
    return apiError(error);
  }
}
