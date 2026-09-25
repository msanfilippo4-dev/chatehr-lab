import { z } from "zod";
import { createCourseAdminClient, logAdminEvent } from "@/lib/server/course-db";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { QuizExtensionBodySchema } from "@/lib/schemas/api";
import { deleteExtension, saveExtension } from "@/lib/server/quiz-store";
import { requireInstructor } from "@/lib/server/session";
import { parseJsonBody, queryParam } from "@/lib/server/validation";

/** Grant or update a student's extension for one week (extra minutes and/or a later close). */
export async function POST(request: Request) {
  try {
    const instructor = await requireInstructor();
    const body = await parseJsonBody(request, QuizExtensionBodySchema);
    const admin = createCourseAdminClient();
    const row = { ...body, closes_at_override: body.closes_at_override ? new Date(body.closes_at_override).toISOString() : null };
    await saveExtension(admin, instructor.email, row);
    await logAdminEvent(admin, instructor.email, "quiz_extension_saved", "quiz", `${body.week}:${body.email}`, row);
    return ok({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}

const DeleteQuery = z.object({ email: z.string().trim().toLowerCase().email(), week: z.coerce.number().int().min(1).max(12) });

export async function DELETE(request: Request) {
  try {
    const instructor = await requireInstructor();
    const parsed = DeleteQuery.safeParse({ email: queryParam(request, "email"), week: queryParam(request, "week") });
    if (!parsed.success) throw new ApiError(400, "Give the student's email and the week.", "VALIDATION");
    const admin = createCourseAdminClient();
    await deleteExtension(admin, parsed.data.email, parsed.data.week);
    await logAdminEvent(admin, instructor.email, "quiz_extension_removed", "quiz", `${parsed.data.week}:${parsed.data.email}`);
    return ok({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
