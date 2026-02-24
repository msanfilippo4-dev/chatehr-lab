import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

if (!googleClientId || !googleClientSecret) {
  console.warn(
    "NextAuth Google OAuth is missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Sign-in will fail until configured."
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  callbacks: {
    signIn: ({ account, profile }) => {
      if (account?.provider === "google") {
        return profile?.email?.endsWith("@fordham.edu") ?? false;
      }
      return true;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
