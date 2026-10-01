import { NextResponse } from "next/server";
import { requireCourseUser } from "@/lib/server/session";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { EhrgoSubmissionSchema, prepareEhrgoSubmission } from "@/lib/server/ehrgo-submissions";
import { requireSameOrigin } from "@/lib/server/ehrgo-uploads";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { parseJsonBody } from "@/lib/server/validation";
import { apiError } from "@/lib/server/errors";

export async function POST(request: Request) {
  try {
    const user = await requireCourseUser();
    requireSameOrigin(request);
    const body = await parseJsonBody(request, EhrgoSubmissionSchema, 4096);
    const admin = createCourseAdminClient();
    await enforceRateLimit(admin, `ehrgo-submission:${user.email}`, 20, 3600);
    return NextResponse.json(await prepareEhrgoSubmission(admin, user, body), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = apiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
