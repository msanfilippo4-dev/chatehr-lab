import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { ensureCourseUser, getCourseRole, isFordhamEmail, normalizeEmail } from "@/lib/server/course-db";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: { params: { prompt: "select_account", hd: "fordham.edu" } },
    }),
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider !== "google") return false;
      const email = normalizeEmail(profile?.email ?? user.email ?? "");
      const verified = !profile || !("email_verified" in profile) || profile.email_verified !== false;
      if (!verified || !isFordhamEmail(email)) return false;
      await ensureCourseUser(email, user.name, user.image);
      return true;
    },
    async jwt({ token, user }) {
      const email = normalizeEmail(user?.email ?? token.email ?? "");
      if (email && isFordhamEmail(email)) token.courseRole = await getCourseRole(email);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const target = session.user as typeof session.user & { id?: string; courseRole?: string };
        target.id = token.sub ?? normalizeEmail(session.user.email ?? "");
        target.courseRole = String(token.courseRole ?? "student");
      }
      return session;
    },
  },
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
