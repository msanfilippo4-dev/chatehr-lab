import { studentSafeConfig } from "@/lib/config/merge";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { apiError, ok } from "@/lib/server/errors";
import { requireCourseUser } from "@/lib/server/session";

export async function GET() {
  try {
    const user = await requireCourseUser();
    const effective = await loadEffectiveAssignments(createCourseAdminClient());
    const config = { ...effective.config, assignments: effective.assignments };
    return ok({ config: user.role === "student" ? studentSafeConfig(config) : config, version: effective.version, publishedAt: effective.publishedAt });
  } catch (error) {
    return apiError(error);
  }
}
