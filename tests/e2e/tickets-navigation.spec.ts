import { expect, test } from "@playwright/test";
import { gotoApp, openTab, resolveTicket, signIn, testEmail } from "./helpers";

test("an analyst works a ticket end to end with deep links and history navigation", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, testEmail("tickets"));

  // Grouped navigation with URL state: rail links update the URL; back/forward replay it.
  await openTab(page, "Tickets");
  await expect(page).toHaveURL(/view=tickets/);
  await expect(page.getByRole("heading", { name: "Analyst tickets" })).toBeVisible();
  await openTab(page, "Query Studio");
  await expect(page).toHaveURL(/view=query-studio/);
  await page.goBack();
  await expect(page).toHaveURL(/view=tickets/);
  await expect(page.getByRole("heading", { name: "Analyst tickets" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Population Query Studio" })).toBeVisible();

  // Triage, then follow the ticket's deep link into the evidence.
  await openTab(page, "Tickets");
  await page.getByRole("button", { name: /^TKT-1042/ }).click();
  await page.getByLabel("Category", { exact: true }).selectOption("Safety");
  await page.getByLabel("Priority", { exact: true }).selectOption("Urgent");
  await page.getByLabel("Owner", { exact: true }).selectOption("Me (clinical informatics analyst)");
  await page.getByRole("button", { name: "Save triage" }).click();
  await page.getByRole("link", { name: "Open the physician In Basket (Results)" }).click();
  await expect(page).toHaveURL(/view=in-basket/);
  await expect(page.getByLabel("Select simulated role")).toHaveValue("Physician/APP");
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await page.getByRole("button", { name: /^Marcus Reed — CRITICAL/ }).click();
  await expect(page.locator("body")).toContainText("no delegate");
  await page.goBack();
  await expect(page).toHaveURL(/view=tickets/);

  await resolveTicket(page, "TKT-1042", {
    evidence: [
      "In Basket item: routed to Sam Brooks, NP's personal inbox; out of office 9/18–9/21 with no delegate",
      "Routing note: the critical-result escalation rule applies to inpatient locations only",
    ],
    notify: ["Sam Brooks, NP", "Laboratory director"],
  });
  await page.getByRole("tab", { name: /Resolved/ }).click();
  await expect(page.getByRole("button", { name: /^TKT-1042/ })).toBeVisible();

  // The audit trail records triage, evidence, and resolution with the ticket context.
  await gotoApp(page, "/?view=audit&role=him&patient=PT-002");
  await expect(page.locator("table", { hasText: "Resolve ticket" }).first()).toBeVisible();
  await openTab(page, "Assignments");
  await page.locator(".assignment-list button", { hasText: "A2" }).click();
  await expect(page.locator(".evidence-list")).toContainText("1/2 required");
});
