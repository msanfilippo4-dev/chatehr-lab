import { expect, test } from "@playwright/test";
import { gotoApp, openTab, resolveTicket, signIn, submitAssignment, testEmail, waitForSave } from "./helpers";

const LABELS: Record<number, [string, string]> = {
  1: ["Supported", "S1"],
  2: ["Contradicts source", "S3"],
  3: ["Supported", "S3"],
  4: ["Supported", "S4"],
  5: ["Supported", "S5"],
  6: ["Unsupported", "S5"],
  7: ["Wrong patient detail", "S6"],
  8: ["Supported", "S6"],
  9: ["Unsupported", "S10"],
  10: ["Omission", "S7"],
  11: ["Supported", "S9"],
  12: ["Contradicts source", "S1"],
};

test("a student completes the AI safety review and go-live readiness for FORDMS-A4", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, testEmail("a4"));

  // Part 1: sentence-level review; no answer key is shown.
  await gotoApp(page, "/?view=ai-review&role=analyst");
  for (let n = 1; n <= 12; n += 1) {
    const [label, source] = LABELS[n];
    await page.getByRole("button", { name: `Sentence ${n}`, exact: true }).click();
    await page.getByRole("radio", { name: label, exact: true }).check();
    await page.getByLabel("Source line").selectOption(source);
    await page.getByRole("button", { name: "Save classification" }).click();
  }
  await expect(page.getByText("12 of 12 classified")).toBeVisible();
  await page.getByLabel("Disposition").selectOption("Reject and redraft from the source");
  await page.getByLabel("Reviewer note").fill("Most serious: amoxicillin in the plan despite a severe penicillin allergy (S7), plus wrong laterality and a fabricated neuro exam.");
  await page.getByRole("button", { name: "Finish review" }).click();
  await expect(page.locator(".form-message.success", { hasText: "Review recorded" }).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("planted");

  // Part 2: AI-drafted replies in the In Basket.
  await gotoApp(page, "/?view=in-basket&role=physician");
  await page.getByRole("button", { name: "AI Draft Replies", exact: true }).click();
  await page.getByRole("button", { name: /^Marcus Reed — Is my potassium dangerous/ }).click();
  await page.getByLabel("Unsafe or incorrect clinical advice", { exact: true }).check();
  await page.getByLabel("Makes a decision no clinician has made", { exact: true }).check();
  await page.getByLabel("Decision", { exact: true }).selectOption("Discard and route to clinician");
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.locator(".form-message.success", { hasText: "Completed" }).first()).toBeVisible();
  await page.getByRole("button", { name: /^Grace Kim — Metformin refill/ }).click();
  await page.getByLabel("Wrong patient or wrong detail", { exact: true }).check();
  await page.getByLabel("Decision", { exact: true }).selectOption("Edit and send");
  await page.getByLabel("Reply text").fill("Hello Grace, your metformin refill has been sent to Walgreens #10421 on Northern Blvd. It should be ready tomorrow.");
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.locator(".form-message.success", { hasText: "Completed" }).first()).toBeVisible();
  await resolveTicket(page, "TKT-1046", {
    evidence: ["Marcus Reed's draft reply tells him to stop lisinopril and eat high-potassium foods", "Drafts can be sent without edits or an attestation step"],
    notify: ["AI governance committee"],
  });

  // Part 3: readiness and the go-live recommendation.
  await gotoApp(page, "/?view=implementation&role=implementation-lead");
  await page.getByLabel("Workflow readiness status").selectOption("Blocked");
  await page.getByLabel("Interfaces readiness status").selectOption("In progress");
  await page.getByLabel("Downtime readiness status").selectOption("Blocked");
  await page.getByLabel("Decision", { exact: true }).selectOption("Conditional go");
  await page.getByLabel("Accountable owner").fill("CNIO and the BCMA steering committee");
  await page.getByLabel("Release condition").fill("Pharmacy retest passes and the downtime drill is completed");
  await page.getByLabel("Outcome measure").fill("Scan compliance above 95% on 4 West within two weeks");
  await page.getByLabel("Balancing measure").fill("Override rate and late doses per 100 administrations");
  await page.getByLabel("Monitoring plan").fill("Daily huddle review of the BCMA dashboard by the nurse manager");
  await page.getByLabel("Rollback trigger").fill("Any wrong-patient administration or override rate above 10%");
  await page.getByRole("button", { name: "Record recommendation" }).click();
  await expect(page.getByText("Go-live recommendation recorded in the audit trail.")).toBeVisible();
  await waitForSave(page);

  await openTab(page, "Assignments");
  await page.locator(".assignment-list button", { hasText: "A4" }).click();
  await expect(page.locator(".assignment-header")).toContainText("8/8 · 100%");
  await submitAssignment(page, "FORDMS-A4", "The draft's most material errors were the amoxicillin plan despite a severe penicillin allergy, wrong laterality and an invented fall, a normal neurologic exam that was never performed, another patient's diabetes, and an English-only understanding statement although a Mandarin interpreter was used. I discarded Marcus Reed's reply, which told him to stop lisinopril, and edited Grace Kim's to the correct pharmacy. I recommend a conditional go for BCMA owned by the CNIO, measuring scan compliance against overrides and late doses, with rollback on any wrong-patient administration.");
  await expect(page.locator(".assignment-header")).toContainText("Submitted v1");
});
