import { createCourseAdminClient } from "@/lib/server/course-db";
import { apiError, ok } from "@/lib/server/errors";
import { loadStudentContext, studentList } from "@/lib/server/quiz-store";
import { requireCourseUser } from "@/lib/server/session";

/** Weekly quiz list with the signed-in learner's attempt state and window status. */
export async function GET() {
  try {
    const user = await requireCourseUser();
    const context = await loadStudentContext(createCourseAdminClient(), user.email);
    return ok(studentList(context));
  } catch (error) {
    return apiError(error);
  }
}
