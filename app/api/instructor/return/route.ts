import { ReturnBodySchema } from "@/lib/schemas/api";
import { createCourseAdminClient, normalizeEmail } from "@/lib/server/course-db";
import { apiError, ok } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireInstructor } from "@/lib/server/session";
import { returnForRevision } from "@/lib/server/submissions";
import { parseJsonBody } from "@/lib/server/validation";

export async function POST(request: Request) {
  try {
    const instructor = await requireInstructor();
    const body = await parseJsonBody(request, ReturnBodySchema);
    const admin = createCourseAdminClient();
    await enforceRateLimit(admin, `return:${instructor.email}`, 60, 60);
    const result = await returnForRevision(admin, { email: normalizeEmail(body.email), assignmentId: body.assignmentId, comment: body.comment, actor: instructor.email });
    return ok(result);
  } catch (error) {
    return apiError(error);
  }
}
