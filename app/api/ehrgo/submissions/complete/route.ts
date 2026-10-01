import { NextResponse } from "next/server";
import { requireCourseUser } from "@/lib/server/session";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { completeEhrgoSubmission } from "@/lib/server/ehrgo-submissions";
import { EhrgoCompleteSchema, requireSameOrigin } from "@/lib/server/ehrgo-uploads";
import { parseJsonBody } from "@/lib/server/validation";
import { apiError } from "@/lib/server/errors";

export async function POST(request: Request) {
  try {
    const user = await requireCourseUser();
    requireSameOrigin(request);
    const { id } = await parseJsonBody(request, EhrgoCompleteSchema, 4096);
    return NextResponse.json({ submission: await completeEhrgoSubmission(createCourseAdminClient(), user, id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = apiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
