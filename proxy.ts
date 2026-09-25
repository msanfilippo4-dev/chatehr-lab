import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";

/**
 * Page requests without a session redirect to /login. API routes are excluded
 * on purpose: route handlers verify the session themselves and answer with
 * JSON 401/403 so the browser client can react instead of parsing HTML.
 */
const auth = withAuth({ pages: { signIn: "/login" } });

/** Hosts that are short links into FordMS. Sign-in cookies live on fordms.com, so these redirect rather than serve pages. */
const SHORT_HOSTS: Record<string, string> = {
  "quiz.fordms.com": "/quizzes",
  "quizzes.fordms.com": "/quizzes",
};

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const target = SHORT_HOSTS[host];
  if (target) {
    const url = new URL(target, "https://fordms.com");
    return NextResponse.redirect(url, 308);
  }
  if (req.nextUrl.pathname.startsWith("/login")) return NextResponse.next();
  return auth(req as NextRequestWithAuth, event);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
