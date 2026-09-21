import { expect, test } from "@playwright/test";
import { openPatientChart, openTab, signIn, testEmail, waitForSave } from "./helpers";

test("imported evidence is labeled, scoped reset keeps signed notes, and keyboard navigation works", async ({ browser, browserName }) => {
  const sourceEmail = testEmail("import-source");
  const targetEmail = testEmail("import-target");

  const sourceContext = await browser.newContext({ acceptDownloads: true });
  const source = await sourceContext.newPage();
  await signIn(source, sourceEmail);
  await openPatientChart(source, "Liu", "Liu Huang");
  await source.getByRole("button", { name: /Send to HIM identity queue/ }).click();
  await waitForSave(source);
  const [download] = await Promise.all([source.waitForEvent("download"), source.getByRole("button", { name: "Export evidence" }).click()]);
  const path = await download.path();
  expect(path).toBeTruthy();

  const targetContext = await browser.newContext();
  const target = await targetContext.newPage();
  await signIn(target, targetEmail);
  await target.getByLabel("Import workspace").setInputFiles(path!);
  await expect(target.locator(".notice-line")).toContainText("Imported", { timeout: 30_000 });
  await openTab(target, "Assignments");
  await expect(target.locator(".evidence-list")).toContainText("imported");
  await expect(target.getByText("Imported evidence", { exact: true })).toBeVisible();

  // Scoped reset of A2 keeps a signed note but clears orders.
  await target.getByLabel("Select simulated role").selectOption("Clinical");
  await openPatientChart(target, "Liu", "Liu Huang");
  await openTab(target, "Encounter");
  for (const label of ["S · subjective", "O · objective", "A · assessment", "P · plan"]) await target.getByLabel(label).fill("Documented for the reset test.");
  await target.getByRole("button", { name: "Sign note" }).click();
  await openTab(target, "Orders & Results");
  await target.getByLabel("Order type", { exact: true }).selectOption("Laboratory");
  await target.getByRole("button", { name: "Submit simulated order" }).click();
  await waitForSave(target);
  await openTab(target, "Assignments");
  await target.locator(".assignment-list button", { hasText: "A2" }).click();
  await target.getByRole("button", { name: "Reset FORDMS-A2" }).click();
  await target.getByRole("button", { name: "Reset assignment" }).click();
  await expect(target.locator(".form-message.success")).toContainText("was reset", { timeout: 30_000 });
  await openPatientChart(target, "Liu", "Liu Huang");
  await target.getByRole("tab", { name: "Notes" }).click();
  await expect(target.locator(".timeline")).toContainText("Signed");
  await openTab(target, "Orders & Results");
  await expect(target.locator(".empty")).toContainText("No orders");

  // Keyboard: skip link reaches main; Tab moves through the module navigation.
  await target.reload();
  await expect(target.getByRole("navigation", { name: "FordMS EHR modules" })).toBeVisible({ timeout: 30_000 });
  // Safari does not reach links with Tab unless "Press Tab to highlight each item" is enabled, so focus it directly there.
  if (browserName === "webkit") await target.locator(".skip-link").focus();
  else await target.keyboard.press("Tab");
  await expect(target.locator(".skip-link")).toBeFocused();
  await target.keyboard.press("Enter");
  await expect(target.locator("#practice-ehr-main")).toBeFocused();
  await target.getByRole("navigation", { name: "FordMS EHR modules" }).getByRole("button").first().focus();
  await target.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(target.getByRole("navigation", { name: "FordMS EHR modules" }).getByRole("button").nth(1)).toBeFocused();

  await sourceContext.close();
  await targetContext.close();
});
