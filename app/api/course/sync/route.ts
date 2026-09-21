import { normalizeState } from "@/lib/db";
import { SyncBodySchema } from "@/lib/schemas/api";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { computeServerProgress, toEventRows } from "@/lib/server/progress";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireCourseUser } from "@/lib/server/session";
import { parseJsonBody, WORKSPACE_MAX_BYTES } from "@/lib/server/validation";

export async function POST(request: Request) {
  try {
    const user = await requireCourseUser();
    const body = await parseJsonBody(request, SyncBodySchema, WORKSPACE_MAX_BYTES);
    const owner = body.workspace.meta?.owner;
    if (owner && owner.toLowerCase() !== user.email) throw new ApiError(403, "This workspace belongs to a different account and cannot be saved here.", "OWNER_MISMATCH");
    const admin = createCourseAdminClient();
    await enforceRateLimit(admin, `sync:${user.email}`, 240, 60);

    let workspace;
    try {
      workspace = normalizeState(body.workspace, user.email);
    } catch {
      throw new ApiError(400, "The workspace could not be read. Export your evidence and reload the page.", "BAD_WORKSPACE");
    }
    const now = new Date().toISOString();
    const effective = await loadEffectiveAssignments(admin);

    const workspaceWrite = await admin.from("ehr_user_workspaces").upsert({ email: user.email, workspace, schema_version: 3, updated_at: now }, { onConflict: "email" });
    if (workspaceWrite.error) throw workspaceWrite.error;

    const events = toEventRows(user.email, workspace.audit, now);
    if (events.length) {
      const eventWrite = await admin.from("ehr_activity_events").upsert(events, { onConflict: "email,event_id", ignoreDuplicates: true });
      if (eventWrite.error) throw eventWrite.error;
    }
    const { rows } = await computeServerProgress(admin, user.email, effective.assignments, effective.version);
    return ok({ savedAt: now, configVersion: effective.version, progress: rows });
  } catch (error) {
    return apiError(error);
  }
}
