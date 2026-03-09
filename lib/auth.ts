// ---------------------------------------------------------------------------
// NextAuth configuration — Fordham Google OAuth domain gate + demo provider
// ---------------------------------------------------------------------------

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

if (!googleClientId || !googleClientSecret) {
  console.warn(
    "NextAuth Google OAuth is missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Sign-in will fall back to demo provider."
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
    // Demo credentials provider for local development
    CredentialsProvider({
      name: "Demo",
      credentials: {},
      async authorize() {
        return {
          id: "demo-user",
          name: "Demo User",
          email: "demo@fordham.edu",
          image: null,
        };
      },
    }),
  ],
  callbacks: {
    signIn: ({ account, profile }) => {
      if (account?.provider === "google") {
        return profile?.email?.endsWith("@fordham.edu") ?? false;
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as Record<string, unknown>).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
