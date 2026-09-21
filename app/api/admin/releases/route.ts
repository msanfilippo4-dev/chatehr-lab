import { ReleaseBodySchema } from "@/lib/schemas/api";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { loadReleases, upsertRelease } from "@/lib/server/config";
import { apiError, ok } from "@/lib/server/errors";
import { requireInstructor } from "@/lib/server/session";
import { parseJsonBody } from "@/lib/server/validation";

export async function GET() {
  try {
    await requireInstructor();
    return ok({ releases: await loadReleases(createCourseAdminClient()) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireInstructor();
    const body = await parseJsonBody(request, ReleaseBodySchema);
    const admin = createCourseAdminClient();
    await upsertRelease(admin, actor.email, body);
    return ok({ releases: await loadReleases(admin) });
  } catch (error) {
    return apiError(error);
  }
}
