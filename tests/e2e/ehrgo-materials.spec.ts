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
  await expect(page.getByRole("link", { name: /Download student materials ZIP/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upload course material" })).toHaveCount(0);
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

test("instructors upload faculty keys and large student resources with the correct access", async ({ page, browser }, testInfo) => {
  const instructor = testEmail("ehrgo-uploader");
  await signIn(page, instructor, "instructor");
  await page.goto("/ehrgo");
  await expect(page.getByRole("heading", { name: "Upload course material" })).toBeVisible();
  await expect(page.getByLabel("Who can download this file?")).toHaveValue("instructor");
  const keyName = `${instructor.split("@")[0]}-faculty-key.txt`;
  const key = Buffer.from("Test faculty answer key.\n");
  let interruptConfirmation = true;
  await page.route("**/api/ehrgo/uploads/complete", async (route) => {
    if (interruptConfirmation) {
      interruptConfirmation = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "The upload could not be confirmed. Try confirming it again." }) });
    } else await route.continue();
  });
  await page.getByLabel("Course file", { exact: true }).setInputFiles({ name: keyName, mimeType: "text/plain", buffer: key });
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(page.getByRole("region", { name: "Upload course material" }).getByRole("alert")).toContainText("The upload could not be confirmed.");
  await expect(page.getByRole("button", { name: "Confirm uploaded file", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Course file", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Start another upload", exact: true }).click();
  await expect(page.getByLabel("Course file", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Course file", { exact: true })).toHaveValue("");
  await page.getByLabel("Course file", { exact: true }).setInputFiles({ name: keyName, mimeType: "text/plain", buffer: key });
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Available to instructors and admins only.", { timeout: 45_000 });
  const keyLink = page.locator(".materials-files a").filter({ hasText: keyName });
  await expect(keyLink).toBeVisible();
  const keyUrl = (await keyLink.getAttribute("href"))!;
  const keyResponse = await page.request.get(keyUrl);
  expect(keyResponse.status()).toBe(200);
  expect(await keyResponse.body()).toEqual(key);

  // This exceeds Vercel's function-body limit and must go straight to private storage.
  const worksheetName = `${instructor.split("@")[0]}-student-worksheet.txt`;
  const worksheet = Buffer.alloc(5 * 1024 * 1024 + 128, "EHR Go test worksheet.\n");
  await page.getByLabel("Who can download this file?").selectOption("student");
  await page.getByLabel("Course file", { exact: true }).setInputFiles({ name: worksheetName, mimeType: "text/plain", buffer: worksheet });
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Available to students and faculty.", { timeout: 45_000 });
  const worksheetLink = page.locator(".materials-files a").filter({ hasText: worksheetName });
  await expect(worksheetLink).toBeVisible();
  const worksheetUrl = (await worksheetLink.getAttribute("href"))!;
  await expect(page.getByLabel("Who can download this file?")).toHaveValue("instructor");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Upload course material" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `test-results/ehrgo-instructor-uploads-${testInfo.project.name}.png` });
  const origin = new URL(page.url()).origin;
  const pending = await page.request.post("/api/ehrgo/uploads", { headers: { Origin: origin }, data: { activityId: "74", audience: "student", name: `${instructor.split("@")[0]}-incomplete.txt`, bytes: 5 } });
  expect(pending.status()).toBe(200);
  const pendingId = (await pending.json()).id;
  expect((await page.request.post("/api/ehrgo/uploads/complete", { headers: { Origin: origin }, data: { id: pendingId } })).status()).toBe(409);
  expect((await page.request.get(`/api/ehrgo/downloads/upload-${pendingId}`, { maxRedirects: 0 })).status()).toBe(404);

  const studentContext = await browser.newContext({ baseURL: origin });
  try {
    const student = await studentContext.newPage();
    await signIn(student, testEmail("ehrgo-upload-reader"));
    await student.goto("/ehrgo");
    await expect(student.locator(".materials-files a").filter({ hasText: worksheetName })).toBeVisible();
    expect(await student.content()).not.toContain(keyName);
    await expect(student.getByRole("heading", { name: "Upload course material" })).toHaveCount(0);
    expect((await student.request.get(keyUrl, { maxRedirects: 0 })).status()).toBe(403);
    expect((await student.request.post("/api/ehrgo/uploads", { headers: { Origin: origin }, data: { activityId: "74", name: "Student.txt", bytes: 3 } })).status()).toBe(403);
    expect((await student.request.post("/api/ehrgo/uploads/complete", { headers: { Origin: origin }, data: { id: pendingId } })).status()).toBe(403);
    const received = await student.request.get(worksheetUrl);
    expect(received.status()).toBe(200);
    expect(createHash("sha256").update(await received.body()).digest("hex")).toBe(createHash("sha256").update(worksheet).digest("hex"));
  } finally { await studentContext.close(); }
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
