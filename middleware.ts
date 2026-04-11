export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/join-team/:path*",
    "/workspace/:path*",
    "/dashboard/:path*",
    "/benchmark/:path*",
    "/leaderboard/:path*",
    "/observability/:path*",
    "/experiments/:path*",
    "/population-health/:path*",
    "/settings/:path*",
    "/instructor/:path*",
  ],
};
