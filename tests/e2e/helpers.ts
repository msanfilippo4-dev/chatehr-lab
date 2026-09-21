import { expect, type Page } from "@playwright/test";

const RUN_ID = process.env.FORDMS_E2E_RUN_ID ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function testEmail(label: string) {
  return `e2e-${label}-${RUN_ID}@fordham.edu`.toLowerCase();
}

export async function signIn(page: Page, email: string, role: "student" | "instructor" | "admin" = "student") {
  await page.goto("/login");
  const form = page.getByTestId("test-auth");
  await expect(form).toBeVisible();
  await form.getByLabel("Test email").fill(email);
  await form.getByLabel("Test role").selectOption(role);
  await form.getByRole("button", { name: "Sign in as test account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await expect(page.getByRole("navigation", { name: "FordMS EHR modules" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".storage-line")).toContainText(/workspace|Saved/, { timeout: 30_000 });
}

export async function selectRole(page: Page, role: string) {
  await page.getByLabel("Select simulated role").selectOption(role);
}

export async function openTab(page: Page, name: string) {
  await page.getByRole("navigation", { name: "FordMS EHR modules" }).getByRole("button", { name, exact: true }).click();
}

export async function waitForSave(page: Page) {
  await expect(page.locator(".storage-line")).toContainText("Saved to your Fordham course account", { timeout: 30_000 });
}

export async function openPatientChart(page: Page, query: string, name: string) {
  await openTab(page, "Patients");
  await page.getByLabel("Search patients").fill(query);
  await page.locator(".patient-list button", { hasText: name }).first().click();
}

/** Complete every FORDMS-A1 requirement through the UI. */
export async function completeA1(page: Page) {
  await selectRole(page, "Front Desk");
  await openPatientChart(page, "Liu", "Liu Huang");
  await page.getByRole("button", { name: /Send to HIM identity queue/ }).click();
  await selectRole(page, "HIM");
  await openTab(page, "MPI");
  await page.getByLabel("Identity decision").selectOption("Need more information");
  await page.getByLabel("Identity review reasoning").fill("Date of birth and language match, but phone, MRN, and name form differ. Verify with the patient before any merge.");
  await page.getByRole("button", { name: "Record identity decision" }).click();
  await expect(page.locator(".form-message.success")).toContainText("Decision recorded");
  await selectRole(page, "Front Desk");
  await openTab(page, "Schedule");
  // Conflict first (Dr. Chen already has 09:00 on the simulated date).
  const form = page.locator("form.form-stack");
  await form.getByLabel("Patient", { exact: true }).selectOption("PT-002");
  await form.getByLabel("Date", { exact: true }).fill("2026-09-21");
  await form.getByLabel("Time", { exact: true }).fill("09:00");
  await form.getByRole("button", { name: "Create appointment" }).click();
  await expect(page.locator(".form-message.error")).toContainText("Conflict");
  await form.getByLabel("Date", { exact: true }).fill("2026-09-28");
  await form.getByLabel("Time", { exact: true }).fill("10:00");
  await form.getByRole("button", { name: "Create appointment" }).click();
  await expect(page.locator(".form-message.success")).toContainText("Appointment created");
  const newRow = page.locator("table tbody tr", { hasText: "2026-09-28" }).first();
  await newRow.getByRole("button", { name: "Reschedule" }).click();
  await form.getByLabel("Time", { exact: true }).fill("11:00");
  await form.getByRole("button", { name: "Save reschedule" }).click();
  await expect(page.locator(".form-message.success")).toContainText("rescheduled");
  await openPatientChart(page, "Liu", "Liu Huang");
  await page.getByRole("tab", { name: "Coding" }).click();
  await page.getByRole("button", { name: /Record use of ICD-10-CM M75.51/ }).click();
  await page.getByRole("button", { name: /Record use of CPT 99213/ }).click();
  await waitForSave(page);
}

export async function submitAssignment(page: Page, id: string, reflection: string) {
  await openTab(page, "Assignments");
  await page.locator(".assignment-list button", { hasText: id.replace("FORDMS-", "") }).first().click();
  await page.getByLabel("Written analysis").fill(reflection);
  const button = page.getByRole("button", { name: /Submit assignment|Resubmit assignment/ });
  await expect(button).toBeEnabled({ timeout: 30_000 });
  await button.click();
  await expect(page.locator(".form-message.success")).toContainText(/Submitted FORDMS/, { timeout: 45_000 });
}

export const REFLECTION = "I compared the date of birth and preferred language, which matched, against the phone number, MRN, and the shortened name, which differed, and recorded that more information is needed rather than merging. The scheduling conflict appeared because Dr. Chen already had a 9:00 visit, so I moved the visit to an open slot and later rescheduled it while the appointment identifier stayed the same. M75.51 is an ICD-10-CM diagnosis code describing why the visit happened, while 99213 is a CPT code describing the service performed.";
