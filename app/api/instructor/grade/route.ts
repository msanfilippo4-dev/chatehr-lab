import { NextResponse } from "next/server";
import { courseAssignments } from "@/lib/assignments";
import { assignmentBenchmarks } from "@/lib/server/assignment-benchmarks";
import { createCourseAdminClient, isFordhamEmail, normalizeEmail } from "@/lib/server/course-db";
import { requireInstructor } from "@/lib/server/session";

export async function GET() {
  try {
    await requireInstructor();
    const admin = createCourseAdminClient();
    const [users, progress, submissions] = await Promise.all([
      admin.from("ehr_course_users").select("email,name,role,last_login_at").eq("role", "student").order("name"),
      admin.from("ehr_assignment_progress").select("email,assignment_id,percent_complete,progress,updated_at"),
      admin.from("ehr_assignment_submissions").select("email,assignment_id,reflection,evidence,status,version,score,feedback,submitted_at,graded_at,graded_by"),
    ]);
    for (const result of [users, progress, submissions]) if (result.error) throw result.error;
    return NextResponse.json({
      assignments: courseAssignments.map((assignment) => ({ ...assignment, instructorBenchmark: assignmentBenchmarks[assignment.id] ?? [] })),
      students: (users.data ?? []).map((student) => ({
        ...student,
        progress: (progress.data ?? []).filter((item) => item.email === student.email),
        submissions: (submissions.data ?? []).filter((item) => item.email === student.email),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const instructor = await requireInstructor();
    const body = await request.json();
    const email = normalizeEmail(String(body?.email ?? ""));
    const assignmentId = String(body?.assignmentId ?? "");
    const score = Number(body?.score);
    const feedback = String(body?.feedback ?? "").trim();
    if (!isFordhamEmail(email) || !courseAssignments.some((item) => item.id === assignmentId)) {
      return NextResponse.json({ error: "Invalid student or assignment." }, { status: 400 });
    }
    if (!Number.isFinite(score) || score < 0 || score > 100 || feedback.length < 10) {
      return NextResponse.json({ error: "Provide a score from 0–100 and substantive feedback." }, { status: 400 });
    }
    const admin = createCourseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await admin.from("ehr_assignment_submissions").update({
      score,
      feedback,
      status: "graded",
      graded_at: now,
      graded_by: instructor.email,
    }).eq("email", email).eq("assignment_id", assignmentId).select("assignment_id,status,score,feedback,graded_at").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "No submitted assignment was found." }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}
