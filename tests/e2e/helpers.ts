import { type Page, type Route } from "@playwright/test";

export const BACKEND_UNAVAILABLE_PAYLOAD = {
  error: "Backend unavailable. Check the Supabase configuration and try again.",
  code: "backend_unavailable",
};

export const TEAM_PAYLOAD = {
  id: "team-demo",
  name: "Demo Team",
  joinCode: "REAL1234",
  role: "lead",
};

export const NO_TEAM_PAYLOAD = {
  error: "You must be on a team to continue.",
  code: "no_team",
};

export const INSTRUCTOR_REQUIRED_PAYLOAD = {
  error: "Instructor access required.",
  code: "instructor_required",
};

export async function fulfillJson(
  route: Route,
  status: number,
  body: unknown
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function signInAsDemo(page: Page) {
  await page.goto("/login");
  const origin = new URL(page.url()).origin;
  const csrfResponse = await page.request.get(`${origin}/api/auth/csrf`);
  const csrfBody = (await csrfResponse.json()) as { csrfToken?: string };

  if (!csrfBody.csrfToken) {
    throw new Error("Failed to load NextAuth CSRF token for demo sign-in.");
  }

  const callbackResponse = await page.request.post(
    `${origin}/api/auth/callback/credentials`,
    {
      form: {
        csrfToken: csrfBody.csrfToken,
        callbackUrl: `${origin}/workspace`,
        json: "true",
      },
    }
  );

  if (!callbackResponse.ok()) {
    throw new Error(
      `Demo sign-in failed with status ${callbackResponse.status()}.`
    );
  }

  const callbackBody = (await callbackResponse.json()) as { url?: string };
  const currentOrigin = new URL(origin);
  const redirectUrl = callbackBody.url
    ? new URL(callbackBody.url)
    : new URL("/workspace", currentOrigin);

  // NextAuth may echo NEXTAUTH_URL here, so keep the path/query but force
  // navigation back onto the active test origin.
  redirectUrl.protocol = currentOrigin.protocol;
  redirectUrl.host = currentOrigin.host;

  await page.goto(redirectUrl.toString(), {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL((url) => {
    const pathname = url.pathname;
    return pathname === "/workspace" || pathname === "/dashboard";
  }, {
    timeout: 15_000,
    waitUntil: "domcontentloaded",
  });
}

export async function mockApi(
  page: Page,
  resolver: (route: Route, url: URL) => Promise<void>
) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/auth/")) {
      await route.continue();
      return;
    }

    await resolver(route, url);
  });
}

export async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    return (
      html.scrollWidth > window.innerWidth + 1 ||
      body.scrollWidth > window.innerWidth + 1
    );
  });
}
