import { expect, test } from "@playwright/test";
import { openTab, signIn, testEmail } from "./helpers";

test("unauthenticated page requests redirect to login and API requests return JSON 401", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  const response = await request.get("/api/course/bootstrap");
  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"]).toContain("application/json");
  const body = await response.json();
  expect(body.code).toBe("UNAUTHORIZED");
});

test("students cannot reach instructor or admin routes", async ({ page }) => {
  await signIn(page, testEmail("auth-student"));
  const roster = await page.request.get("/api/instructor/roster");
  expect(roster.status()).toBe(403);
  const config = await page.request.get("/api/admin/config");
  expect(config.status()).toBe(403);
  await expect(page.getByRole("navigation", { name: "FordMS EHR modules" }).getByRole("button", { name: "Gradebook" })).toHaveCount(0);
});

test("instructor sees gradebook and admin tabs", async ({ page }) => {
  await signIn(page, testEmail("auth-instructor"), "instructor");
  await openTab(page, "Gradebook");
  await expect(page.getByRole("heading", { name: "Instructor gradebook" })).toBeVisible();
  await openTab(page, "Admin");
  await expect(page.getByRole("heading", { name: "Course configuration" })).toBeVisible();
});
