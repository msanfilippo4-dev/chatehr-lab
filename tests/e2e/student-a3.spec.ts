import { expect, test } from "@playwright/test";
import { gotoApp, openTab, resolveTicket, signIn, submitAssignment, testEmail, waitForSave } from "./helpers";

test("a student completes exchange, analytics, and revenue integrity for FORDMS-A3", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, testEmail("a3"));

  // Part 1: reconcile two outside records.
  await gotoApp(page, "/?view=hie&role=analyst");
  await page.getByRole("button", { name: "Keep local" }).first().click();
  await page.getByRole("button", { name: "Defer" }).last().click();
  await expect(page.getByText("Kept local").first()).toBeVisible();

  // Part 2: prove the number.
  await openTab(page, "Query Studio");
  await page.getByLabel("Cohort definition").selectOption("A1c ≥ 8%");
  await page.getByRole("button", { name: "Run cohort query" }).click();
  await page.getByLabel("Cohort definition").selectOption("Abnormal potassium");
  await page.getByRole("button", { name: "Run cohort query" }).click();
  await page.getByPlaceholder(/State the denominator/).fill("Denominator: all 12 patients with a final potassium result; I checked Marcus Reed's chart (6.1 mmol/L, final). Limitation: one patient has no potassium, so the rate excludes them.");
  await page.getByRole("button", { name: "Record validation" }).click();
  await expect(page.getByText("Validation evidence recorded.")).toBeVisible();

  await openTab(page, "Analytics");
  const fall = page.locator("section", { has: page.getByRole("heading", { name: "Fall-risk reassessment · 4 West" }) });
  await expect(fall).toContainText("61%");
  await page.getByLabel("Include new flowsheet row FS-2203").check();
  await expect(fall).toContainText("90%");
  await resolveTicket(page, "TKT-1045", {
    evidence: ["Report definition counts only flowsheet row FS-1180", "Flowsheet build change on 9/14 moved fall reassessment to new row FS-2203", "Recalculated rate including FS-2203 is about 90%"],
    notify: ["Reporting and analytics team"],
  });

  // Part 3: claims at the source.
  await gotoApp(page, "/?view=billing&role=revenue-cycle");
  await page.getByRole("button", { name: /Elena Garcia — CLM-26-0412/ }).click();
  await page.getByRole("button", { name: "Run scrubber" }).click();
  await page.getByLabel("Diagnosis pointer for line 2").selectOption("E11.9");
  await page.getByRole("button", { name: "Apply fix" }).click();
  await expect(page.getByText("No scrubber edits. Ready to submit.")).toBeVisible();
  await page.getByRole("button", { name: "Submit claim" }).click();
  await expect(page.locator(".form-message.success", { hasText: "Submitted to" }).first()).toBeVisible();

  await page.getByRole("tab", { name: /Denials/ }).click();
  await page.getByRole("button", { name: /Noah Williams — CLM-26-0388/ }).click();
  await page.getByLabel("Denial action").selectOption("Transfer balance to patient");
  await page.getByLabel("Denial note").fill("Attempting to bill the patient for the missing diagnosis denial.");
  await page.getByRole("button", { name: "Work denial" }).click();
  await expect(page.locator(".form-message.error", { hasText: /contractual/i }).first()).toBeVisible();
  await page.getByLabel("Denial action").selectOption("Correct and resubmit as a corrected claim");
  await page.getByLabel("Denial note").fill("Added diagnosis pointers E78.5 and R73.03 to the lab lines; resubmitted as a corrected claim.");
  await page.getByRole("button", { name: "Work denial" }).click();
  await expect(page.locator(".form-message.success", { hasText: "Denial worked" }).first()).toBeVisible();
  await resolveTicket(page, "TKT-1044", {
    evidence: ["Denial queue: three CO-16 / M76 denials, all lab lines ordered by Dr. Patel", "The denied lab lines have no diagnosis pointer; the visit lines on the same claims do"],
    notify: ["EHR build team (orders)", "Dr. Ravi Patel"],
  });
  await waitForSave(page);

  await openTab(page, "Assignments");
  await page.locator(".assignment-list button", { hasText: "A3" }).click();
  await expect(page.locator(".assignment-header")).toContainText("10/10 · 100%");
  await submitAssignment(page, "FORDMS-A3", "I kept Liu Huang's local penicillin allergy because it is more specific than the urgent-care entry and deferred Grace Kim's prediabetes condition because identity confidence was 71%. I validated 'Abnormal potassium': final results only, denominator all patients with a potassium result. The fall-reassessment drop is an artifact: the report counts row FS-1180 only; including FS-2203 restores about 90%. The CO-16 denials all share Dr. Patel's lab favorites without a diagnosis association; fix the build, not each claim.");
  await expect(page.locator(".assignment-header")).toContainText("Submitted v1");
});
