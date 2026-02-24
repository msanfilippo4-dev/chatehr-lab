import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
