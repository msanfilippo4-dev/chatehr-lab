import { NextResponse } from "next/server";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { EhrgoUploadSchema, prepareEhrgoUpload, requireSameOrigin } from "@/lib/server/ehrgo-uploads";
import { apiError } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireInstructor } from "@/lib/server/session";
import { parseJsonBody } from "@/lib/server/validation";

export async function POST(request: Request) {
  try {
    const user = await requireInstructor();
    requireSameOrigin(request);
    const body = await parseJsonBody(request, EhrgoUploadSchema, 4096);
    const admin = createCourseAdminClient();
    await enforceRateLimit(admin, `ehrgo-upload:${user.email}`, 30, 3600);
    return NextResponse.json(await prepareEhrgoUpload(admin, user.email, body), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = apiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
