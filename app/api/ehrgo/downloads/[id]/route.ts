import { NextResponse } from "next/server";
import { requireCourseUser, requireInstructor } from "@/lib/server/session";
import { createCourseAdminClient } from "@/lib/server/course-db";
import { ApiError, apiError } from "@/lib/server/errors";
import { EHRGO_BUCKET, findEhrgoDownload } from "@/lib/server/ehrgo";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireCourseUser();
    const { id } = await params;
    const file = findEhrgoDownload(id);
    if (!file) throw new ApiError(404, "This course download was not found.", "NOT_FOUND");
    if (file.audience === "instructor") await requireInstructor();

    // Large ZIPs are served by private storage, avoiding function response limits.
    const { data, error } = await createCourseAdminClient().storage
      .from(EHRGO_BUCKET)
      .createSignedUrl(file.storagePath, 60, { download: file.name });
    if (error || !data) throw new ApiError(503, "This download is temporarily unavailable. Please try again.", "DOWNLOAD_UNAVAILABLE");
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
