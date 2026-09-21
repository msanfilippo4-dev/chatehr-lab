import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureCourseUser, getCourseUser, isFordhamEmail, normalizeEmail, type CourseRole } from "@/lib/server/course-db";

export interface CourseUserContext {
  email: string;
  name: string | null | undefined;
  role: CourseRole;
}

export async function requireCourseUser(): Promise<CourseUserContext> {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!session?.user || !isFordhamEmail(email)) throw new Error("UNAUTHORIZED");
  const current = await ensureCourseUser(email, session.user.name, session.user.image);
  if (current.enrollmentStatus === "dropped") throw new Error("DROPPED");
  return { email, name: session.user.name, role: current.role };
}

export async function requireInstructor(): Promise<CourseUserContext> {
  const user = await requireCourseUser();
  const { role } = await getCourseUser(user.email);
  if (role !== "instructor" && role !== "admin") throw new Error("FORBIDDEN");
  return { ...user, role };
}

export async function requireAdmin(): Promise<CourseUserContext> {
  const user = await requireCourseUser();
  const { role } = await getCourseUser(user.email);
  if (role !== "admin") throw new Error("FORBIDDEN");
  return { ...user, role };
}
