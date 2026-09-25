import { normalizeState } from "@/lib/db";
import { ResetBodySchema } from "@/lib/schemas/api";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { computeServerProgress, toEventRows } from "@/lib/server/progress";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireCourseUser } from "@/lib/server/session";
import { recordResetMarker, snapshotWorkspace } from "@/lib/server/snapshots";
import { parseJsonBody, WORKSPACE_MAX_BYTES } from "@/lib/server/validation";

/**
 * Scoped or full reset, or an import. The server snapshots the current cloud
 * workspace, records a reset marker (so earlier evidence stops counting for
 * that assignment), and stores the replacement workspace sent by the client.
 */
export async function POST(request: Request) {
  try {
    const user = await requireCourseUser();
    const body = await parseJsonBody(request, ResetBodySchema, WORKSPACE_MAX_BYTES);
    const admin = createCourseAdminClient();
    await enforceRateLimit(admin, `reset:${user.email}`, 20, 600);
    if (body.scope === "assignment" && !body.assignmentId) throw new ApiError(400, "Choose the assignment to reset.", "VALIDATION");
    if (body.workspace?.meta?.owner && body.workspace.meta.owner.toLowerCase() !== user.email) throw new ApiError(403, "This workspace belongs to a different account.", "OWNER_MISMATCH");

    const now = new Date().toISOString();
    const reason = body.scope === "import" ? "import" : body.scope === "all" ? "full_reset" : "scoped_reset";
    await snapshotWorkspace(admin, user.email, reason, user.email, body.assignmentId ?? null);
    if (body.scope !== "import") await recordResetMarker(admin, user.email, body.scope === "all" ? "*" : body.assignmentId!, now);

    const effective = await loadEffectiveAssignments(admin);
    if (body.workspace) {
      const workspace = normalizeState(body.workspace, user.email);
      const write = await admin.from("ehr_user_workspaces").upsert({ email: user.email, workspace, schema_version: 4, updated_at: now, ...(body.scope === "import" ? { last_import_at: now } : {}) }, { onConflict: "email" });
      if (write.error) throw write.error;
      const events = toEventRows(user.email, workspace.audit, now);
      if (events.length) {
        const eventWrite = await admin.from("ehr_activity_events").upsert(events, { onConflict: "email,event_id", ignoreDuplicates: true });
        if (eventWrite.error) throw eventWrite.error;
      }
    }
    const { rows } = await computeServerProgress(admin, user.email, effective.assignments, effective.version);
    return ok({ resetAt: now, scope: body.scope, assignmentId: body.assignmentId ?? null, progress: rows });
  } catch (error) {
    return apiError(error);
  }
}
