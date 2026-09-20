import { NextResponse } from "next/server";
import { assignmentProgress, courseAssignments } from "@/lib/assignments";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { requireCourseUser } from "@/lib/server/session";

export async function POST(request: Request) {
  try {
    const user = await requireCourseUser();
    const body = await request.json();
    const assignment = courseAssignments.find((item) => item.id === body?.assignmentId);
    const reflection = String(body?.reflection ?? "").trim();
    if (!assignment) return NextResponse.json({ error: "Unknown assignment." }, { status: 400 });
    if (reflection.length < 150 || reflection.length > 5000) {
      return NextResponse.json({ error: "The written analysis must contain at least 150 characters." }, { status: 400 });
    }
    const admin = createCourseAdminClient();
    const { data: workspaceRow, error: workspaceError } = await admin.from("ehr_user_workspaces").select("workspace").eq("email", user.email).maybeSingle();
    if (workspaceError) throw workspaceError;
    const audit = Array.isArray(workspaceRow?.workspace?.audit) ? workspaceRow.workspace.audit : [];
    const progress = assignmentProgress(assignment, audit.map((event: { action?: unknown }) => String(event.action ?? "")));
    if (!progress.complete) return NextResponse.json({ error: "Complete all required EHR actions before submitting." }, { status: 409 });
    const requiredActions = new Set(assignment.requirements.map((item) => item.action));
    const evidence = audit.filter((event: { action?: unknown }) => requiredActions.has(String(event.action ?? "")));
    const { data: existing, error: existingError } = await admin.from("ehr_assignment_submissions").select("version").eq("email", user.email).eq("assignment_id", assignment.id).maybeSingle();
    if (existingError) throw existingError;
    const now = new Date().toISOString();
    const { error } = await admin.from("ehr_assignment_submissions").upsert({
      email: user.email,
      assignment_id: assignment.id,
      reflection,
      evidence,
      status: "submitted",
      version: (existing?.version ?? 0) + 1,
      score: null,
      feedback: null,
      submitted_at: now,
      graded_at: null,
      graded_by: null,
    }, { onConflict: "email,assignment_id" });
    if (error) throw error;
    return NextResponse.json({ assignmentId: assignment.id, status: "submitted", submittedAt: now, version: (existing?.version ?? 0) + 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
