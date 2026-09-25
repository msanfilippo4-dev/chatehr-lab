import { expect, test } from "@playwright/test";
import { openPatientChart, openTab, signIn, testEmail, waitForSave } from "./helpers";

test("admin publishes a configuration version that students receive, and preview mode is read-only", async ({ browser }) => {
  const adminEmail = testEmail("admin");
  const studentEmail = testEmail("config-student");
  const code = `Z99.${Date.now().toString().slice(-2)}`;

  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await signIn(student, studentEmail);
  await openPatientChart(student, "Marcus", "Marcus Reed");
  await waitForSave(student);

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signIn(admin, adminEmail, "admin");
  // Remember the live configuration so it can be restored: this suite runs against the course database.
  const before = await (await admin.request.get("/api/admin/config")).json();
  const previousVersion: number = before.version;
  await openTab(admin, "Admin");
  await admin.getByRole("button", { name: "ICD-10-CM examples" }).click();
  await admin.getByRole("button", { name: "Add row" }).click();
  const lastRow = admin.locator(".catalog-table tbody tr").last();
  await lastRow.getByLabel(/^system row/).fill("ICD-10-CM");
  await lastRow.getByLabel(/^code row/).fill(code);
  await lastRow.getByLabel(/^display row/).fill("Teaching example added in test");
  await lastRow.getByLabel(/^use row/).fill("Status / context");
  await lastRow.getByLabel(/^version row/).fill("FY2027");
  await lastRow.getByLabel(/^effectiveDate row/).fill("2026-10-01");
  await lastRow.getByLabel(/^status row/).fill("example");
  await lastRow.getByLabel(/^source row/).fill("Automated test");
  await lastRow.getByLabel(/^teachingNote row/).fill("Verifies that published catalogs reach students.");
  await admin.getByLabel("Change summary (required to publish)").fill("Automated test publish");
  await admin.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(admin.locator(".form-message.success")).toContainText("Published configuration version", { timeout: 30_000 });

  await student.reload();
  await openPatientChart(student, "Marcus", "Marcus Reed");
  await student.getByRole("tab", { name: "Coding" }).click();
  await expect(student.locator("table")).toContainText(code);

  // Preview mode: the admin views the student's workspace but cannot change it.
  await openTab(admin, "Gradebook");
  await admin.getByLabel("Show test accounts").check();
  await admin.getByLabel("Search").fill(studentEmail);
  await admin.locator(".roster-table tbody tr", { hasText: studentEmail }).first().click();
  await admin.getByRole("button", { name: "Preview workspace (read-only)" }).click();
  await expect(admin.locator(".preview-banner")).toContainText(studentEmail);
  await openTab(admin, "Patients");
  await admin.getByLabel("Search patients").fill("Amina");
  await admin.locator(".patient-list button", { hasText: "Amina Yusuf" }).first().click();
  await expect(admin.locator(".storage-line")).toContainText("Preview mode");
  await admin.getByRole("button", { name: "Exit preview" }).click();
  await expect(admin.locator(".preview-banner")).toHaveCount(0);

  const preview = await admin.request.get(`/api/instructor/preview?email=${encodeURIComponent(studentEmail)}`);
  const payload = await preview.json();
  const opened = (payload.workspace.audit as { action: string; detail: string }[]).filter((event) => event.action === "Open chart");
  expect(opened.some((event) => event.detail.includes("Amina"))).toBe(false);

  // Republish the configuration that was live before this test (restores never delete history).
  if (previousVersion > 0) {
    const restore = await admin.request.post("/api/admin/config/history", { data: { version: previousVersion, changeSummary: "Restore after automated test publish" } });
    expect(restore.status()).toBe(200);
  }

  await studentContext.close();
  await adminContext.close();
});
