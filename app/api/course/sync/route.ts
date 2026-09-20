import { NextResponse } from "next/server";
import { assignmentProgress, courseAssignments } from "@/lib/assignments";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { requireCourseUser } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    const user = await requireCourseUser();
    const body = await request.json();
    const workspace = body?.workspace;
    if (!workspace || workspace.version !== 2 || !Array.isArray(workspace.audit)) {
      return NextResponse.json({ error: "A compatible version 2 workspace is required." }, { status: 400 });
    }
    if (JSON.stringify(workspace).length > 1_500_000) {
      return NextResponse.json({ error: "The workspace is too large to synchronize." }, { status: 413 });
    }
    const admin = createCourseAdminClient();
    const now = new Date().toISOString();
    const actions = workspace.audit.map((event: { action?: unknown }) => String(event.action ?? ""));
    const progressRows = courseAssignments.map((assignment) => {
      const progress = assignmentProgress(assignment, actions);
      return {
        email: user.email,
        assignment_id: assignment.id,
        progress,
        percent_complete: progress.percent,
        completed_at: progress.complete ? now : null,
        updated_at: now,
      };
    });
    const events = workspace.audit.slice(0, 250).map((event: Record<string, unknown>) => ({
      email: user.email,
      event_id: String(event.id ?? ""),
      action: String(event.action ?? ""),
      patient_id: event.patientId ? String(event.patientId) : null,
      detail: String(event.detail ?? ""),
      occurred_at: String(event.timestamp ?? now),
    })).filter((event: { event_id: string; action: string }) => event.event_id && event.action);
    const workspaceWrite = await admin.from("ehr_user_workspaces").upsert({ email: user.email, workspace, schema_version: 2, updated_at: now }, { onConflict: "email" });
    if (workspaceWrite.error) throw workspaceWrite.error;
    const progressWrite = await admin.from("ehr_assignment_progress").upsert(progressRows, { onConflict: "email,assignment_id" });
    if (progressWrite.error) throw progressWrite.error;
    if (events.length) {
      const eventWrite = await admin.from("ehr_activity_events").upsert(events, { onConflict: "email,event_id", ignoreDuplicates: true });
      if (eventWrite.error) throw eventWrite.error;
    }
    return NextResponse.json({ savedAt: now, progress: progressRows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
