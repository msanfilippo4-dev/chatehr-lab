import type { NextAuthOptions } from "next-auth";
import type { Provider } from "next-auth/providers/index";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { createCourseAdminClient, ensureCourseUser, getCourseRole, isConfiguredInstructor, isFordhamEmail, isTestEmail, normalizeEmail } from "@/lib/server/course-db";
import { loadPublishedConfig } from "@/lib/server/config";

/** When roster-only sign-in is published, only enrolled (non-dropped) accounts and configured instructors may enter. */
async function allowedByRoster(email: string) {
  if (isConfiguredInstructor(email)) return true;
  const { config } = await loadPublishedConfig(createCourseAdminClient());
  if (!config.permissions.rosterOnlySignIn) return true;
  const { data } = await createCourseAdminClient().from("ehr_course_users").select("enrollment_status,role").eq("email", email).maybeSingle();
  return Boolean(data && data.enrollment_status !== "dropped");
}

/**
 * Test-only credentials sign-in used by Playwright. It is registered only when
 * FORDMS_TEST_AUTH=1 and never on a Vercel production deployment.
 */
export function testAuthEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.FORDMS_TEST_AUTH !== "1") return false;
  if (env.VERCEL_ENV === "production") throw new Error("FORDMS_TEST_AUTH must not be enabled on a production deployment.");
  return true;
}

export function buildProviders(env: NodeJS.ProcessEnv = process.env): Provider[] {
  const providers: Provider[] = [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: { params: { prompt: "select_account", hd: "fordham.edu" } },
    }),
  ];
  if (testAuthEnabled(env)) {
    providers.push(CredentialsProvider({
      id: "fordms-test",
      name: "FordMS test account",
      credentials: { email: { label: "Email", type: "text" }, role: { label: "Role", type: "text" } },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email ?? "");
        if (!isTestEmail(email)) return null;
        const requested = credentials?.role === "instructor" || credentials?.role === "admin" ? credentials.role : "student";
        const user = await ensureCourseUser(email, `Test ${email.split("@")[0]}`, null, { enrollmentStatus: "test" });
        if (requested !== "student" && user.role !== requested) {
          const { createCourseAdminClient } = await import("@/lib/server/course-db");
          await createCourseAdminClient().from("ehr_course_users").update({ role: requested }).eq("email", email);
        }
        return { id: email, email, name: `Test ${email.split("@")[0]}` };
      },
    }));
  }
  return providers;
}

export const authOptions: NextAuthOptions = {
  providers: buildProviders(),
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "fordms-test") return testAuthEnabled() && isTestEmail(user.email ?? "");
      if (account?.provider !== "google") return false;
      const email = normalizeEmail(profile?.email ?? user.email ?? "");
      const verified = !profile || !("email_verified" in profile) || profile.email_verified !== false;
      if (!verified || !isFordhamEmail(email)) return false;
      if (!(await allowedByRoster(email))) return false;
      await ensureCourseUser(email, user.name, user.image);
      return true;
    },
    async jwt({ token, user, trigger }) {
      const email = normalizeEmail(user?.email ?? token.email ?? "");
      if (email && isFordhamEmail(email) && (user || trigger === "update" || !token.courseRole)) {
        token.email = email;
        token.courseRole = await getCourseRole(email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const target = session.user as typeof session.user & { id?: string; courseRole?: string };
        target.id = token.sub ?? normalizeEmail(session.user.email ?? "");
        target.email = String(token.email ?? session.user.email ?? "");
        target.courseRole = String(token.courseRole ?? "student");
      }
      return session;
    },
  },
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
