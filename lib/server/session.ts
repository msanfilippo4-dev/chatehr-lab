import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureCourseUser, getCourseRole, isFordhamEmail, normalizeEmail } from "@/lib/server/course-db";

export async function requireCourseUser() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!session?.user || !isFordhamEmail(email)) throw new Error("UNAUTHORIZED");
  const current = await ensureCourseUser(email, session.user.name, session.user.image);
  return { session, email, role: current.role };
}

export async function requireInstructor() {
  const user = await requireCourseUser();
  const role = await getCourseRole(user.email);
  if (role !== "instructor" && role !== "admin") throw new Error("FORBIDDEN");
  return { ...user, role };
}
