import { createCourseAdminClient, logAdminEvent } from "@/lib/server/course-db";
import { apiError, ok } from "@/lib/server/errors";
import { QuizSettingsBodySchema } from "@/lib/schemas/api";
import { saveSettings } from "@/lib/server/quiz-store";
import { requireInstructor } from "@/lib/server/session";
import { parseJsonBody } from "@/lib/server/validation";

/** Save one week's settings. Null fields fall back to the quiz bank default. */
export async function PUT(request: Request) {
  try {
    const instructor = await requireInstructor();
    const body = await parseJsonBody(request, QuizSettingsBodySchema);
    const admin = createCourseAdminClient();
    const row = {
      ...body,
      opens_at: body.opens_at ? new Date(body.opens_at).toISOString() : null,
      closes_at: body.closes_at ? new Date(body.closes_at).toISOString() : null,
    };
    await saveSettings(admin, instructor.email, row);
    await logAdminEvent(admin, instructor.email, "quiz_settings_saved", "quiz", String(body.week), row);
    return ok({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
