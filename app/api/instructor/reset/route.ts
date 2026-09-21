import { normalizeState } from "@/lib/db";
import { InstructorResetBodySchema } from "@/lib/schemas/api";
import { fullReset, scopedReset } from "@/lib/store/reset";
import { createCourseAdminClient, isFordhamEmail, logAdminEvent, normalizeEmail } from "@/lib/server/course-db";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { computeServerProgress } from "@/lib/server/progress";
import { requireInstructor } from "@/lib/server/session";
import { recordResetMarker, snapshotWorkspace } from "@/lib/server/snapshots";
import { parseJsonBody } from "@/lib/server/validation";

/** Instructor-initiated reset of a student's assignment work. Submissions and signed notes are preserved. */
export async function POST(request: Request) {
  try {
    const instructor = await requireInstructor();
    const body = await parseJsonBody(request, InstructorResetBodySchema);
    const email = normalizeEmail(body.email);
    if (!isFordhamEmail(email)) throw new ApiError(400, "Invalid student address.", "VALIDATION");
    if (body.scope === "assignment" && !body.assignmentId) throw new ApiError(400, "Choose the assignment to reset.", "VALIDATION");
    const admin = createCourseAdminClient();
    const effective = await loadEffectiveAssignments(admin);
    const { data: row, error } = await admin.from("ehr_user_workspaces").select("workspace").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!row?.workspace) throw new ApiError(404, "That student has no cloud workspace yet.", "NOT_FOUND");
    const now = new Date().toISOString();
    await snapshotWorkspace(admin, email, "instructor_reset", instructor.email, body.assignmentId ?? null, row.workspace);
    const current = normalizeState(row.workspace, email);
    let next;
    if (body.scope === "all") {
      next = fullReset(current, `Instructor (${instructor.email})`, now);
      await recordResetMarker(admin, email, "*", now);
    } else {
      const assignment = effective.assignments.find((item) => item.id === body.assignmentId);
      if (!assignment) throw new ApiError(400, "Unknown assignment.", "VALIDATION");
      next = scopedReset(current, assignment, `Instructor (${instructor.email})`, now);
      await recordResetMarker(admin, email, assignment.id, now);
    }
    const write = await admin.from("ehr_user_workspaces").update({ workspace: next, schema_version: 3, updated_at: now }).eq("email", email);
    if (write.error) throw write.error;
    const { rows } = await computeServerProgress(admin, email, effective.assignments, effective.version);
    await logAdminEvent(admin, instructor.email, "instructor_reset", "user", email, { scope: body.scope, assignmentId: body.assignmentId ?? null });
    return ok({ resetAt: now, progress: rows });
  } catch (error) {
    return apiError(error);
  }
}
