export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect everything except:
     * - /login
     * - /lab and /lab/* (public lab instructions)
     * - /results and /results/* (PIN-protected, no Gemini API usage)
     * - /labresults and /labresults/*
     * - /api/auth/* (NextAuth routes)
     * - /_next/* (Next.js internals)
     * - /favicon.ico
     * - /data/* (static JSON patient/guideline data)
     */
    "/((?!login|lab|results|labresults|api/auth|_next|favicon\\.ico|data).*)",
  ],
};
