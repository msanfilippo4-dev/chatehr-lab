import { createCourseAdminClient } from "@/lib/server/course-db";
import { EHRGO_BUCKET as COURSE_MATERIALS_BUCKET } from "@/lib/server/ehrgo";
import { ApiError, apiError } from "@/lib/server/errors";
import { requireCourseUser } from "@/lib/server/session";

const filename = "AI_Supported_EHR_Feature_Project.pdf";
const cacheControl = "private, no-store";

export async function GET() {
  try {
    await requireCourseUser();
    const { data, error } = await createCourseAdminClient().storage
      .from(COURSE_MATERIALS_BUCKET)
      .download(`fall-2026/final/${filename}`);

    if (error || !data) {
      throw new ApiError(503, "The project brief is temporarily unavailable. Please try again.", "BRIEF_UNAVAILABLE");
    }

    return new Response(data, {
      headers: {
        "Cache-Control": cacheControl,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const response = apiError(error);
    response.headers.set("Cache-Control", cacheControl);
    return response;
  }
}
