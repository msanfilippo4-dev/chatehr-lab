import type { AdminClient } from "./course-db";

export type SnapshotReason = "scoped_reset" | "full_reset" | "instructor_reset" | "import" | "pre_submit";

export async function snapshotWorkspace(admin: AdminClient, email: string, reason: SnapshotReason, createdBy: string, assignmentId: string | null = null, workspace?: unknown) {
  let payload = workspace;
  if (payload === undefined) {
    const { data, error } = await admin.from("ehr_user_workspaces").select("workspace").eq("email", email).maybeSingle();
    if (error) throw error;
    payload = data?.workspace ?? null;
  }
  if (!payload) return null;
  const { data, error } = await admin.from("ehr_workspace_snapshots").insert({ email, reason, assignment_id: assignmentId, workspace: payload, created_by: createdBy }).select("id,created_at").maybeSingle();
  if (error) {
    console.error("[fordms] snapshot not recorded", error.message);
    return null;
  }
  return data;
}

export async function recordResetMarker(admin: AdminClient, email: string, assignmentId: string | "*", at: string) {
  const { data, error } = await admin.from("ehr_user_workspaces").select("reset_markers").eq("email", email).maybeSingle();
  if (error) throw error;
  const markers = { ...((data?.reset_markers as Record<string, string> | null) ?? {}), [assignmentId]: at };
  const { error: writeError } = await admin.from("ehr_user_workspaces").update({ reset_markers: markers, last_reset_at: at }).eq("email", email);
  if (writeError) throw writeError;
  return markers;
}
