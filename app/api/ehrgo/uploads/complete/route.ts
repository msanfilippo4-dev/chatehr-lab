import { NextResponse } from "next/server";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { completeEhrgoUpload, EhrgoCompleteSchema, requireSameOrigin } from "@/lib/server/ehrgo-uploads";
import { apiError } from "@/lib/server/errors";
import { requireInstructor } from "@/lib/server/session";
import { parseJsonBody } from "@/lib/server/validation";

export async function POST(request: Request) {
  try {
    const user = await requireInstructor();
    requireSameOrigin(request);
    const { id } = await parseJsonBody(request, EhrgoCompleteSchema, 4096);
    return NextResponse.json({ material: await completeEhrgoUpload(createCourseAdminClient(), user.email, id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const response = apiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
