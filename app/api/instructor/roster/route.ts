import { RosterBodySchema } from "@/lib/schemas/api";
import { createCourseAdminClient, getCourseUser, isFordhamEmail, logAdminEvent, normalizeEmail } from "@/lib/server/course-db";
import { loadEffectiveAssignments } from "@/lib/server/config";
import { ApiError, apiError, ok } from "@/lib/server/errors";
import { loadRoster } from "@/lib/server/roster";
import { requireInstructor } from "@/lib/server/session";
import { parseJsonBody, queryParam } from "@/lib/server/validation";

export async function GET(request: Request) {
  try {
    await requireInstructor();
    const admin = createCourseAdminClient();
    const effective = await loadEffectiveAssignments(admin);
    const includeTest = queryParam(request, "includeTest") === "1";
    const includeStaff = queryParam(request, "includeStaff") === "1";
    const students = await loadRoster(admin, effective.assignments, { includeTest, includeStaff });
    return ok({ assignments: effective.assignments, configVersion: effective.version, releases: effective.releases, students, generatedAt: new Date().toISOString() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireInstructor();
    const body = await parseJsonBody(request, RosterBodySchema);
    const email = normalizeEmail(body.email);
    if (!isFordhamEmail(email)) throw new ApiError(400, "Only Fordham accounts can be enrolled.", "VALIDATION");
    if (body.role && actor.role !== "admin") throw new ApiError(403, "Only an admin can change course roles.", "FORBIDDEN");
    if (body.role && email === actor.email && body.role !== "admin") throw new ApiError(400, "You cannot remove your own admin role.", "VALIDATION");
    const admin = createCourseAdminClient();
    const update: Record<string, unknown> = {};
    if (body.role) update.role = body.role;
    if (body.enrollmentStatus) update.enrollment_status = body.enrollmentStatus;
    if (body.firstName !== undefined) update.first_name = body.firstName;
    if (body.lastName !== undefined) update.last_name = body.lastName;
    if (body.blackboardUsername !== undefined) update.blackboard_username = body.blackboardUsername;
    if (body.section !== undefined) update.section = body.section;
    if (body.notes !== undefined) update.notes = body.notes;
    if (!Object.keys(update).length) throw new ApiError(400, "Nothing to update.", "VALIDATION");
    const { data, error } = await admin.from("ehr_course_users").upsert({ email, name: email.split("@")[0], ...update }, { onConflict: "email" }).select("email,name,role,enrollment_status,first_name,last_name,blackboard_username,section,notes").maybeSingle();
    if (error) throw error;
    await logAdminEvent(admin, actor.email, "roster_updated", "user", email, update);
    const current = await getCourseUser(email);
    return ok({ ...data, role: current.role });
  } catch (error) {
    return apiError(error);
  }
}
