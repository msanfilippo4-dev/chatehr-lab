import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import catalog from "../../lib/server/ehrgo-catalog.json";
import { signIn, testEmail } from "./helpers";

test("EHR Go pages and downloads require course sign-in", async ({ page, request }) => {
  await page.goto("/ehrgo");
  await expect(page).toHaveURL(/\/login/);
  expect((await request.get("/api/ehrgo/downloads/file-529542", { maxRedirects: 0 })).status()).toBe(401);
});

test("students see materials, download a verified worksheet, and cannot access faculty files", async ({ page }, testInfo) => {
  await signIn(page, testEmail("ehrgo-student"));
  await page.getByRole("navigation", { name: "FordMS EHR modules" }).getByRole("link", { name: "EHR Go materials", exact: true }).click();
  await expect(page.getByRole("heading", { name: "EHR Go materials", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Download all student materials/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Download faculty answer keys/ })).toHaveCount(0);
  const html = await page.content();
  expect(html).not.toContain("faculty-package");
  expect(html).not.toContain(" KEY.");
  expect((await page.request.get("/api/ehrgo/downloads/file-526294", { maxRedirects: 0 })).status()).toBe(403);
  expect((await page.request.get("/api/ehrgo/downloads/faculty-package", { maxRedirects: 0 })).status()).toBe(403);
  expect((await page.request.get("/api/ehrgo/downloads/not-a-file", { maxRedirects: 0 })).status()).toBe(404);
  const response = await page.request.get("/api/ehrgo/downloads/file-529542");
  expect(response.status()).toBe(200);
  expect(decodeURIComponent(response.headers()["content-disposition"])).toContain("EHR Orientation");
  expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(catalog.files.find((file) => file.id === "file-529542")!.sha256);
  await page.screenshot({ path: `test-results/ehrgo-student-desktop-${testInfo.project.name}.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/ehrgo-student-mobile-${testInfo.project.name}.png`, fullPage: true });
});

test("faculty can download verified answer keys and both packages", async ({ page }) => {
  await signIn(page, testEmail("ehrgo-instructor"), "instructor");
  await page.goto("/ehrgo");
  await expect(page.getByRole("link", { name: /Download faculty answer keys/ })).toBeVisible();
  const response = await page.request.get("/api/ehrgo/downloads/file-526294");
  expect(response.status()).toBe(200);
  expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(catalog.files.find((file) => file.id === "file-526294")!.sha256);
  for (const id of ["student-package", "faculty-package"]) {
    const redirect = await page.request.get(`/api/ehrgo/downloads/${id}`, { maxRedirects: 0 });
    expect(redirect.status()).toBe(303);
    expect(redirect.headers()["cache-control"]).toBe("private, no-store");
  }
});
