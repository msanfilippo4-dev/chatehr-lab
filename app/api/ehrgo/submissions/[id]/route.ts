import { NextResponse } from "next/server";
import { requireCourseUser } from "@/lib/server/session";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { findEhrgoSubmission } from "@/lib/server/ehrgo-submissions";
import { EHRGO_BUCKET } from "@/lib/server/ehrgo";
import { apiError, ApiError } from "@/lib/server/errors";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCourseUser();
    const admin = createCourseAdminClient();
    const { id } = await params;
    const file = await findEhrgoSubmission(admin, user, id);
    const { data, error } = await admin.storage.from(EHRGO_BUCKET).createSignedUrl(file.storagePath, 60, { download: file.name });
    if (error || !data) throw new ApiError(503, "This answer sheet could not be downloaded. Please try again.", "DOWNLOAD_UNAVAILABLE");
    const response = NextResponse.redirect(data.signedUrl, 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    const response = apiError(error);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
