import { expect, test } from "@playwright/test";
import {
  BACKEND_UNAVAILABLE_PAYLOAD,
  INSTRUCTOR_REQUIRED_PAYLOAD,
  NO_TEAM_PAYLOAD,
  TEAM_PAYLOAD,
  fulfillJson,
  hasHorizontalOverflow,
  mockApi,
  signInAsDemo,
} from "./helpers";

async function mockBackendUnavailable(page: Page) {
  await mockApi(page, async (route) => {
    await fulfillJson(route, 503, BACKEND_UNAVAILABLE_PAYLOAD);
  });
}

async function mockWorkspacePatientFailure(page: Page) {
  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/patients") {
      await fulfillJson(route, 503, BACKEND_UNAVAILABLE_PAYLOAD);
      return;
    }

    await route.continue();
  });
}

async function mockNoTeam(page: Page) {
  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 404, NO_TEAM_PAYLOAD);
      return;
    }

    await route.continue();
  });
}

async function mockInstructorRequired(page: Page) {
  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (
      url.pathname === "/api/instructor/teams" ||
      url.pathname === "/api/instructor/settings"
    ) {
      await fulfillJson(route, 403, INSTRUCTOR_REQUIRED_PAYLOAD);
      return;
    }

    await route.continue();
  });
}

test("demo sign-in keeps the callback on the local origin", async ({
  page,
  baseURL,
}) => {
  await mockBackendUnavailable(page);
  await signInAsDemo(page);

  expect(page.url()).toBe(`${baseURL}/workspace`);

  const callbackCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "next-auth.callback-url"
  );

  expect(callbackCookie).toBeDefined();
  expect(decodeURIComponent(callbackCookie?.value ?? "")).toBe(
    `${baseURL}/workspace`
  );
});

test("protected routes surface unavailable states during backend outage", async ({
  page,
}) => {
  await mockBackendUnavailable(page);
  await signInAsDemo(page);

  const cases = [
    { path: "/workspace", heading: "Workspace unavailable" },
    { path: "/dashboard", heading: "Dashboard unavailable" },
    { path: "/leaderboard", heading: "Leaderboard unavailable" },
    { path: "/observability", heading: "Observability unavailable" },
    { path: "/benchmark", heading: "Benchmark unavailable" },
    { path: "/experiments", heading: "Experiments unavailable" },
    { path: "/population-health", heading: "Population lab unavailable" },
    { path: "/settings", heading: "Settings unavailable" },
    { path: "/instructor", heading: "Instructor dashboard unavailable" },
  ];

  for (const { path, heading } of cases) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: heading, exact: true })
    ).toBeVisible();
    await expect(page.getByText("Team service unavailable")).toBeVisible();
  }

  await page.goto("/settings");
  await expect(page.getByText("My Team", { exact: true })).toHaveCount(0);
  await expect(page.getByText("ABCD1234", { exact: true })).toHaveCount(0);

  await page.goto("/instructor");
  await expect(
    page.getByText("Instructor access only", { exact: true })
  ).toHaveCount(0);
});

test("patient selector shows fetch failure instead of an empty-state lie", async ({
  page,
}) => {
  await mockWorkspacePatientFailure(page);
  await signInAsDemo(page);

  await expect(page.getByText("Demo Team", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Patient list unavailable", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("No patients found", { exact: true })).toHaveCount(
    0
  );
});

test("workspace and settings keep the no-team state distinct from outage", async ({
  page,
}) => {
  await mockNoTeam(page);
  await signInAsDemo(page);

  await expect(
    page.getByRole("heading", {
      name: "Create or join your team first",
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByText("Team service unavailable")).toHaveCount(0);

  await page.goto("/settings");
  await expect(
    page.getByRole("heading", {
      name: "Join a team to use settings",
      exact: true,
    })
  ).toBeVisible();
  await expect(page.getByText("Team service unavailable")).toHaveCount(0);
  await expect(page.getByText("Settings unavailable", { exact: true })).toHaveCount(
    0
  );
});

test("instructor page keeps access denial distinct from backend outage", async ({
  page,
}) => {
  await mockInstructorRequired(page);
  await signInAsDemo(page);
  await page.goto("/instructor");

  await expect(
    page.getByRole("heading", { name: "Instructor access only", exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("This dashboard is restricted to instructor accounts.", {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByText("Instructor dashboard unavailable", { exact: true })
  ).toHaveCount(0);
  await expect(page.getByText("Demo Team", { exact: true })).toBeVisible();
});

test.describe("narrow viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("login fits without horizontal overflow", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("button", { name: "Sign in with Google" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Demo Sign In" })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test("workspace unavailable fits without horizontal overflow", async ({
    page,
  }) => {
    await mockBackendUnavailable(page);
    await signInAsDemo(page);

    await expect(
      page.getByRole("heading", { name: "Workspace unavailable", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry team lookup" })
    ).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});
