import { ConfigRestoreBodySchema } from "@/lib/schemas/api";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { getConfigVersion, listConfigVersions, saveConfigVersion } from "@/lib/server/config";
import { apiError, ok } from "@/lib/server/errors";
import { requireInstructor } from "@/lib/server/session";
import { parseJsonBody, queryParam } from "@/lib/server/validation";

export async function GET(request: Request) {
  try {
    await requireInstructor();
    const admin = createCourseAdminClient();
    const version = Number(queryParam(request, "version", "0"));
    if (version > 0) return ok(await getConfigVersion(admin, version));
    return ok({ versions: await listConfigVersions(admin) });
  } catch (error) {
    return apiError(error);
  }
}

/** Restore: republish a previous version's document as a new version. */
export async function POST(request: Request) {
  try {
    const actor = await requireInstructor();
    const body = await parseJsonBody(request, ConfigRestoreBodySchema);
    const admin = createCourseAdminClient();
    const previous = await getConfigVersion(admin, body.version);
    const result = await saveConfigVersion(admin, previous.config, actor.email, "published", body.changeSummary ?? `Restored version ${body.version}`);
    return ok({ ...result, restoredFrom: body.version });
  } catch (error) {
    return apiError(error);
  }
}
