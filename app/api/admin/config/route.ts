import { defaultCourseConfig } from "@/lib/config/defaults";
import { ConfigPublishBodySchema } from "@/lib/schemas/api";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { listConfigVersions, loadPublishedConfig, loadReleases, saveConfigVersion } from "@/lib/server/config";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireInstructor } from "@/lib/server/session";
import { parseJsonBody } from "@/lib/server/validation";

export async function GET() {
  try {
    await requireInstructor();
    const admin = createCourseAdminClient();
    const [published, versions, releases] = await Promise.all([loadPublishedConfig(admin), listConfigVersions(admin).catch(() => []), loadReleases(admin)]);
    return ok({ published: published.config, version: published.version, publishedAt: published.publishedAt, invalidSections: published.invalidSections, defaults: defaultCourseConfig, versions, releases });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireInstructor();
    const body = await parseJsonBody(request, ConfigPublishBodySchema, 1024 * 1024);
    const admin = createCourseAdminClient();
    if (body.action === "validate") return ok({ valid: true, sections: Object.keys(body.config).length });
    if (body.action === "publish") {
      const current = await loadPublishedConfig(admin);
      if (actor.role !== "admin" && !current.config.permissions.instructorCanPublishConfig) throw new ApiError(403, "Publishing configuration requires the admin role.", "FORBIDDEN");
      if (!body.changeSummary) throw new ApiError(400, "Describe the change before publishing.", "VALIDATION");
    }
    await enforceRateLimit(admin, `config:${actor.email}`, 30, 600);
    const result = await saveConfigVersion(admin, body.config, actor.email, body.action === "publish" ? "published" : "draft", body.changeSummary);
    return ok(result);
  } catch (error) {
    return apiError(error);
  }
}
