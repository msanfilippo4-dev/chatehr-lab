import { GradeBodySchema } from "@/lib/schemas/api";
import { assignmentBenchmarks } from "@/lib/server/assignment-benchmarks";
import { createCourseAdminClient, isFordhamEmail, normalizeEmail } from "@/lib/server/course-db";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { loadRoster } from "@/lib/server/roster";
import { requireInstructor } from "@/lib/server/session";
import { applyRubricGrade } from "@/lib/server/submissions";
import { parseJsonBody } from "@/lib/server/validation";

/** Legacy-compatible overview: assignments with benchmarks plus every student row. */
export async function GET() {
  try {
    await requireInstructor();
    const admin = createCourseAdminClient();
    const effective = await loadEffectiveAssignments(admin);
    const students = await loadRoster(admin, effective.assignments);
    return ok({
      assignments: effective.assignments.map((assignment) => ({ ...assignment, instructorBenchmark: assignmentBenchmarks[assignment.id] ?? [] })),
      students,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const instructor = await requireInstructor();
    const body = await parseJsonBody(request, GradeBodySchema);
    const email = normalizeEmail(body.email);
    if (!isFordhamEmail(email)) throw new ApiError(400, "Invalid student address.", "VALIDATION");
    const admin = createCourseAdminClient();
    await enforceRateLimit(admin, `grade:${instructor.email}`, 120, 60);
    const effective = await loadEffectiveAssignments(admin);
    const assignment = effective.assignments.find((item) => item.id === body.assignmentId);
    if (!assignment) throw new ApiError(400, "Unknown assignment.", "VALIDATION");
    const result = await applyRubricGrade(admin, { email, assignment, rubric: body.rubric, score: body.score, feedback: body.feedback, finalize: body.finalize, actor: instructor.email });
    return ok(result);
  } catch (error) {
    return apiError(error);
  }
}
