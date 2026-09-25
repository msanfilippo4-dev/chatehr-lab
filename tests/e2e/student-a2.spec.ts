import { expect, test } from "@playwright/test";
import { gotoApp, openTab, resolveTicket, signIn, submitAssignment, testEmail, waitForSave } from "./helpers";

test("a student closes the clinical loops for FORDMS-A2", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, testEmail("a2"));

  // Part 1: note integrity (Dr. Chen's ticket) — sign and amend a note via a deep link.
  await gotoApp(page, "/?view=encounter&patient=PT-001&role=physician");
  await expect(page.getByLabel("Select simulated role")).toHaveValue("Physician/APP");
  await page.getByLabel("S · subjective").fill("Right shoulder pain after increased lifting, improves with rest. No fall, fever, weakness, or numbness. Mandarin interpreter used.");
  await page.getByLabel("O · objective").fill("BP 124/78, HR 72. Tenderness over right lateral shoulder; active range limited by pain. Neurologic exam not performed.");
  await page.getByLabel("A · assessment").fill("Right shoulder bursitis, consistent with M75.51.");
  await page.getByLabel("P · plan").fill("Rest, ice, activity modification, physical therapy referral, follow-up in four weeks.");
  await page.getByRole("button", { name: "Sign note" }).click();
  await expect(page.locator(".form-message.success", { hasText: "Note signed" }).first()).toBeVisible();
  await page.getByLabel("Reason for amendment").fill("Clarify that the neurologic examination was not performed, not normal.");
  await page.getByRole("button", { name: "Add amendment" }).click();
  await expect(page.locator(".form-message.success", { hasText: "Amendment added" }).first()).toBeVisible();
  await resolveTicket(page, "TKT-1043", {
    evidence: ["Note NOTE-SEED-001B metadata: source 'AI scribe draft accepted', signed 9/14 at 16:05", "No edit or amendment exists after the 9/14 signature"],
    notify: ["HIM record integrity"],
  });

  // Part 2: the critical potassium — In Basket follow-up, orders with the interaction warning.
  await gotoApp(page, "/?view=in-basket&role=physician");
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await page.getByRole("button", { name: /^Marcus Reed — CRITICAL/ }).click();
  await page.getByLabel("Action", { exact: true }).selectOption("Acknowledge and create follow-up task");
  await page.getByLabel("Task owner").selectOption("Dr. Lin Chen");
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(page.locator(".form-message.success", { hasText: "Completed" }).first()).toBeVisible();

  await gotoApp(page, "/?view=orders&patient=PT-002&role=physician");
  await page.getByLabel("Medication", { exact: true }).selectOption("Lisinopril 10 mg tablet");
  await expect(page.getByText("Interaction warning")).toBeVisible();
  await page.getByLabel("Medication", { exact: true }).selectOption("Sodium zirconium cyclosilicate 10 g oral packet");
  await page.getByRole("button", { name: "Submit simulated order" }).click();
  await expect(page.locator(".form-message.success", { hasText: "Order placed" }).first()).toBeVisible();
  await page.getByLabel("Order type", { exact: true }).selectOption("Laboratory");
  await page.getByRole("button", { name: "Submit simulated order" }).click();
  await expect(page.locator(".form-message.success", { hasText: "Laboratory order placed" }).first()).toBeVisible();

  // Part 3: eMAR barcode scanning for Sofia Petrov's metoprolol.
  await gotoApp(page, "/?view=emar&patient=PT-008&role=nurse");
  const scan = page.getByRole("region", { name: "Barcode scan" });
  await page.getByRole("button", { name: "Scan Metoprolol tartrate 25 mg tablet at 09:00" }).click();
  await scan.getByLabel("Scan wristband").selectOption({ label: "Sofia Petrova · Rm 415-B" });
  await scan.getByRole("button", { name: "Scan wristband" }).click();
  await expect(scan).toContainText("WRONG PATIENT");
  await scan.getByLabel("Scan wristband").selectOption({ label: "Sofia Petrov · Rm 415-A" });
  await scan.getByRole("button", { name: "Scan wristband" }).click();
  await scan.getByLabel("Scan medication").selectOption({ label: "Metoprolol succinate ER 25 mg tablet" });
  await scan.getByRole("button", { name: "Scan medication" }).click();
  await expect(scan).toContainText("LOOK-ALIKE");
  await scan.getByLabel("Scan medication").selectOption({ label: "Metoprolol tartrate 50 mg tablet (unit dose)" });
  await scan.getByRole("button", { name: "Scan medication" }).click();
  await expect(scan).toContainText("DOSE MISMATCH");
  await scan.getByLabel("Hold reason").selectOption("Wrong strength dispensed; pharmacy notified");
  await scan.getByRole("button", { name: "Hold dose" }).click();
  await expect(page.locator(".form-message.success", { hasText: "Dose held" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Administration history" })).toBeVisible();
  await resolveTicket(page, "TKT-1041", {
    evidence: ["Active order: metoprolol tartrate 25 mg PO BID with hold parameters", "Administration history: three dose-mismatch overrides in 48 hours ('pharmacy sent 50 mg')"],
    notify: ["Pharmacy operations manager", "4 West nurse manager"],
  });

  // Part 4: route the English portal message (the Spanish one matches no rule).
  await gotoApp(page, "/?view=portal&patient=PT-003&role=nurse");
  await expect(page.getByText(/No routing rule matched/)).toBeVisible();
  await page.getByRole("button", { name: "Route message" }).first().click();
  await expect(page.locator(".message").first()).toContainText("Routed");
  await waitForSave(page);

  await openTab(page, "Assignments");
  await page.locator(".assignment-list button", { hasText: "A2" }).click();
  await expect(page.locator(".assignment-header")).toContainText("10/10 · 100%");
  await expect(page.locator(".guide-part.complete")).toHaveCount(3);
  await submitAssignment(page, "FORDMS-A2", "TKT-1041: the scanner is correct. The drawer holds only metoprolol tartrate 50 mg tablets for a 25 mg order, so every scan flags a dose mismatch and three overrides in 48 hours show staff working around it; the fix is pharmacy stocking of the 25 mg unit dose. On the eMAR I held the 09:00 dose after the wrong-patient and look-alike hard stops and the dose mismatch. Acknowledging Marcus Reed's potassium only shows someone saw it; the follow-up task with an owner and due date closes the loop, and the portal message now has an owner.");
  await expect(page.locator(".assignment-header")).toContainText("Submitted v1");
});
