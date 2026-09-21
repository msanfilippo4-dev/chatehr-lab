import { expect, test } from "@playwright/test";
import { completeA1, openTab, REFLECTION, signIn, submitAssignment, testEmail } from "./helpers";

test("a student completes and submits FORDMS-A1 with server-verified progress", async ({ page }) => {
  const email = testEmail("a1");
  await signIn(page, email);
  await openTab(page, "Assignments");
  await expect(page.locator(".assignment-header")).toContainText("0/7");
  await completeA1(page);
  await openTab(page, "Assignments");
  await expect(page.locator(".assignment-header")).toContainText("7/7 · 100%");
  await submitAssignment(page, "FORDMS-A1", REFLECTION);
  await expect(page.locator(".assignment-header")).toContainText("Submitted v1");
  // Recovery: reload restores the cloud workspace with the same evidence.
  await page.reload();
  await expect(page.locator(".storage-line")).toContainText(/restored|Saved to your Fordham/, { timeout: 30_000 });
  await openTab(page, "Assignments");
  await expect(page.locator(".assignment-header")).toContainText("Submitted v1");
  const bootstrap = await page.request.get("/api/course/bootstrap");
  const payload = await bootstrap.json();
  const row = payload.progress.find((item: { assignment_id: string }) => item.assignment_id === "FORDMS-A1");
  expect(row.percent_complete).toBe(100);
  expect(row.computed_from ?? "server").toBe("server");
});
