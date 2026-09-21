import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CourseRole } from "../types";

export type { CourseRole } from "../types";
export type EnrollmentStatus = "invited" | "active" | "dropped" | "test";

export interface CourseUserRow {
  email: string;
  name: string | null;
  image: string | null;
  role: CourseRole;
  enrollment_status: EnrollmentStatus;
  first_name: string | null;
  last_name: string | null;
  blackboard_username: string | null;
  section: string | null;
  notes: string | null;
  created_at: string;
  last_login_at: string | null;
}

export type AdminClient = SupabaseClient;

export function createCourseAdminClient(): AdminClient {
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

export function isTestEmail(email: string) {
  return /^e2e-[a-z0-9-]+@fordham\.edu$/.test(normalizeEmail(email));
}

/** Instructor addresses configured through the environment (comma separated). */
export function isConfiguredInstructor(email: string) {
  const configured = (process.env.INSTRUCTOR_EMAILS ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
  return new Set(configured).has(normalizeEmail(email));
}

function resolveRole(dbRole: CourseRole | null | undefined, email: string): CourseRole {
  if (dbRole === "admin") return "admin";
  if (isConfiguredInstructor(email)) return "instructor";
  return dbRole ?? "student";
}

export async function ensureCourseUser(email: string, name?: string | null, image?: string | null, options: { enrollmentStatus?: EnrollmentStatus } = {}) {
  const normalized = normalizeEmail(email);
  if (!isFordhamEmail(normalized)) throw new Error("A Fordham email address is required.");
  const admin = createCourseAdminClient();
  const { data: existing, error: readError } = await admin
    .from("ehr_course_users")
    .select("role,enrollment_status,name,first_name,last_name")
    .eq("email", normalized)
    .maybeSingle();
  if (readError) throw readError;
  const role = resolveRole(existing?.role as CourseRole | undefined, normalized);
  const status: EnrollmentStatus = options.enrollmentStatus ?? ((existing?.enrollment_status as EnrollmentStatus | undefined) ?? (isTestEmail(normalized) ? "test" : "active"));
  const displayName = name || existing?.name || normalized.split("@")[0];
  const nameParts = !existing?.last_name && displayName.includes(" ") ? displayName.trim().split(/\s+/) : null;
  const { error } = await admin.from("ehr_course_users").upsert({
    email: normalized,
    name: displayName,
    image: image || null,
    role,
    enrollment_status: status,
    ...(nameParts ? { first_name: nameParts.slice(0, -1).join(" "), last_name: nameParts[nameParts.length - 1] } : {}),
    last_login_at: new Date().toISOString(),
  }, { onConflict: "email" });
  if (error) throw error;
  return { email: normalized, role, enrollmentStatus: status };
}

export async function getCourseUser(email: string): Promise<{ role: CourseRole; enrollmentStatus: EnrollmentStatus }> {
  const normalized = normalizeEmail(email);
  const admin = createCourseAdminClient();
  const { data, error } = await admin.from("ehr_course_users").select("role,enrollment_status").eq("email", normalized).maybeSingle();
  if (error) throw error;
  return { role: resolveRole(data?.role as CourseRole | undefined, normalized), enrollmentStatus: (data?.enrollment_status as EnrollmentStatus | undefined) ?? "active" };
}

export async function getCourseRole(email: string): Promise<CourseRole> {
  return (await getCourseUser(email)).role;
}

export async function logAdminEvent(admin: AdminClient, actor: string, action: string, targetType: string, targetId: string | null, detail: Record<string, unknown> = {}) {
  const { error } = await admin.from("ehr_admin_events").insert({ actor, action, target_type: targetType, target_id: targetId, detail });
  if (error) console.error("[fordms] admin event not recorded", error.message);
}
