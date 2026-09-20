import { createClient } from "@supabase/supabase-js";

export type CourseRole = "student" | "instructor" | "admin";

export function createCourseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Course database is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isFordhamEmail(email: string) {
  return normalizeEmail(email).endsWith("@fordham.edu");
}

export function isConfiguredInstructor(email: string) {
  const configured = (process.env.INSTRUCTOR_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  configured.push("msanfilippo4@fordham.edu");
  return new Set(configured).has(normalizeEmail(email));
}

export async function ensureCourseUser(email: string, name?: string | null, image?: string | null) {
  const normalized = normalizeEmail(email);
  if (!isFordhamEmail(normalized)) throw new Error("A Fordham email address is required.");
  const admin = createCourseAdminClient();
  const { data: existing, error: readError } = await admin
    .from("ehr_course_users")
    .select("role")
    .eq("email", normalized)
    .maybeSingle();
  if (readError) throw readError;
  const role: CourseRole = isConfiguredInstructor(normalized)
    ? "instructor"
    : ((existing?.role as CourseRole | undefined) ?? "student");
  const { error } = await admin.from("ehr_course_users").upsert({
    email: normalized,
    name: name || normalized.split("@")[0],
    image: image || null,
    role,
    last_login_at: new Date().toISOString(),
  }, { onConflict: "email" });
  if (error) throw error;
  return { email: normalized, role };
}

export async function getCourseRole(email: string): Promise<CourseRole> {
  const normalized = normalizeEmail(email);
  if (isConfiguredInstructor(normalized)) return "instructor";
  const admin = createCourseAdminClient();
  const { data, error } = await admin.from("ehr_course_users").select("role").eq("email", normalized).maybeSingle();
  if (error) throw error;
  return (data?.role as CourseRole | undefined) ?? "student";
}
