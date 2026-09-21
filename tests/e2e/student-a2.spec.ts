import { expect, test } from "@playwright/test";
import { openPatientChart, openTab, selectRole, signIn, submitAssignment, testEmail, waitForSave } from "./helpers";

test("a student closes the clinical loop for FORDMS-A2", async ({ page }) => {
  await signIn(page, testEmail("a2"));
  await selectRole(page, "Clinical");
  await openPatientChart(page, "Liu", "Liu Huang");
  await openTab(page, "Encounter");
  await page.getByLabel("S · subjective").fill("Right shoulder pain after increased lifting, improves with rest. No fall, fever, weakness, or numbness.");
  await page.getByLabel("O · objective").fill("BP 132/78. Tenderness over right lateral shoulder; active range limited by pain. Neurologic exam not performed.");
  await page.getByLabel("A · assessment").fill("Right shoulder bursitis, consistent with M75.51.");
  await page.getByLabel("P · plan").fill("Rest, activity modification, physical therapy referral, follow-up in four weeks.");
  await page.getByRole("button", { name: "Sign note" }).click();
  await expect(page.locator(".form-message.success")).toContainText("Note signed");
  await page.getByLabel("Reason for amendment").fill("Clarify that neurologic examination was deferred, not normal.");
  await page.getByRole("button", { name: "Add amendment" }).click();
  await expect(page.locator(".form-message.success")).toContainText("Amendment added");

  await openTab(page, "Orders & Results");
  await expect(page.getByText("Drug-allergy warning")).toBeVisible();
  await page.getByRole("button", { name: "Submit simulated order" }).click();
  await expect(page.locator(".form-message.error")).toContainText("Choose an alternative");
  await page.getByLabel("Medication", { exact: true }).selectOption("Azithromycin 250 mg tablet");
  await page.getByRole("button", { name: "Submit simulated order" }).click();
  await expect(page.locator(".form-message.success")).toContainText("Order placed");
  await page.getByLabel("Order type", { exact: true }).selectOption("Laboratory");
  await page.getByRole("button", { name: "Submit simulated order" }).click();
  await expect(page.locator(".form-message.success")).toContainText("Laboratory order placed");
  await page.getByRole("button", { name: "Acknowledge" }).click();
  await page.getByRole("button", { name: "Create follow-up" }).click();
  await expect(page.locator("table")).toContainText("Reviewed");

  await openPatientChart(page, "Elena", "Elena Garcia");
  await openTab(page, "Portal");
  await page.getByRole("button", { name: "Route message" }).first().click();
  await expect(page.locator(".message").first()).toContainText("Routed");
  await page.getByRole("button", { name: "Send reconciliation request" }).click();
  await waitForSave(page);

  await submitAssignment(page, "FORDMS-A2", "The subjective section carries only what the patient reported and the objective section records the measured blood pressure and the deferred neurologic examination, so the assessment of right shoulder bursitis is supported without invented findings. The amoxicillin order triggered the documented penicillin allergy warning; I chose azithromycin instead of overriding. The potassium result was acknowledged and then assigned to the clinical team as an owned follow-up task, the portal message was routed to the clinical pool, and the amendment preserved the signed note while correcting the record.");
  await expect(page.locator(".assignment-header")).toContainText("Submitted v1");
});
