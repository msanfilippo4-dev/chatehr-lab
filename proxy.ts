import { withAuth } from "next-auth/middleware";

/**
 * Page requests without a session redirect to /login. API routes are excluded
 * on purpose: route handlers verify the session themselves and answer with
 * JSON 401/403 so the browser client can react instead of parsing HTML.
 */
export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
