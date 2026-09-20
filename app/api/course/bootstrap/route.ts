import { NextResponse } from "next/server";
import { courseAssignments } from "@/lib/assignments";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { requireCourseUser } from "@/lib/server/session";

export async function GET() {
  try {
    const user = await requireCourseUser();
    const admin = createCourseAdminClient();
    const [workspaceResult, progressResult, submissionsResult] = await Promise.all([
      admin.from("ehr_user_workspaces").select("workspace,updated_at").eq("email", user.email).maybeSingle(),
      admin.from("ehr_assignment_progress").select("assignment_id,progress,percent_complete,completed_at,updated_at").eq("email", user.email),
      admin.from("ehr_assignment_submissions").select("assignment_id,status,version,score,feedback,submitted_at,graded_at").eq("email", user.email),
    ]);
    for (const result of [workspaceResult, progressResult, submissionsResult]) if (result.error) throw result.error;
    return NextResponse.json({
      user: { email: user.email, name: user.session.user?.name, role: user.role },
      assignments: courseAssignments,
      workspace: workspaceResult.data?.workspace ?? null,
      workspaceUpdatedAt: workspaceResult.data?.updated_at ?? null,
      progress: progressResult.data ?? [],
      submissions: submissionsResult.data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
