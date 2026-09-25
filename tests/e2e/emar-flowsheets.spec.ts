import { expect, test } from "@playwright/test";
import { gotoApp, signIn, testEmail } from "./helpers";

test("a nurse scans, administers, and documents a deteriorating patient", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, testEmail("emar"));

  // A deep link switches the simulated role to Nurse and opens Sofia Petrov's MAR.
  await gotoApp(page, "/?view=emar&patient=PT-008&role=nurse");
  await expect(page.getByLabel("Select simulated role")).toHaveValue("Nurse");
  await expect(page.locator(".patient-banner")).toContainText("Sofia Petrov");
  await expect(page.locator(".patient-banner")).toContainText("DNR/DNI");
  const scan = page.getByRole("region", { name: "Barcode scan" });

  // A correct scan inside the window can be given without an override.
  await page.getByRole("button", { name: "Scan Ceftriaxone 1 g IV piggyback at 10:00" }).click();
  await scan.getByLabel("Scan wristband").selectOption({ label: "Sofia Petrov · Rm 415-A" });
  await scan.getByRole("button", { name: "Scan wristband" }).click();
  await scan.getByLabel("Scan medication").selectOption({ label: "Ceftriaxone 1 g in 50 mL IV piggyback" });
  await scan.getByRole("button", { name: "Scan medication" }).click();
  await scan.getByRole("button", { name: "Administer", exact: true }).click();
  await expect(page.locator(".form-message.success", { hasText: "Dose given" }).first()).toBeVisible();

  // A dose mismatch can only be given with a documented override.
  await page.getByRole("button", { name: "Scan Metoprolol tartrate 25 mg tablet at 09:00" }).click();
  await scan.getByLabel("Scan wristband").selectOption({ label: "Sofia Petrov · Rm 415-A" });
  await scan.getByRole("button", { name: "Scan wristband" }).click();
  await scan.getByLabel("Scan medication").selectOption({ label: "Metoprolol tartrate 50 mg tablet (unit dose)" });
  await scan.getByRole("button", { name: "Scan medication" }).click();
  await expect(scan).toContainText("DOSE MISMATCH");
  await expect(scan.getByRole("button", { name: "Administer", exact: true })).toHaveCount(0);
  await scan.getByLabel("Override reason").selectOption({ index: 1 });
  await scan.getByLabel("Override details").fill("Pharmacist verified a 25 mg half-tablet product; attending at bedside approved.");
  await scan.getByRole("button", { name: "Administer with override" }).click();
  await expect(page.locator(".form-message.success", { hasText: "override" }).first()).toBeVisible();

  // James O'Brien: the look-alike drug is a hard stop.
  await page.getByLabel("Inpatient").selectOption("PT-005");
  await expect(page.locator(".patient-banner")).toContainText("James O'Brien");
  await page.getByRole("button", { name: "Scan HydrALAZINE 25 mg tablet at 10:00" }).click();
  await scan.getByLabel("Scan wristband").selectOption({ label: "James O'Brien · Rm 412-B" });
  await scan.getByRole("button", { name: "Scan wristband" }).click();
  await scan.getByLabel("Scan medication").selectOption({ label: "HydrOXYzine 25 mg tablet" });
  await scan.getByRole("button", { name: "Scan medication" }).click();
  await expect(scan).toContainText("LOOK-ALIKE");
  await expect(scan.getByRole("button", { name: "Hold dose" })).toHaveCount(0);

  // Flowsheet: the bedside values compute a high early warning score and escalate.
  await gotoApp(page, "/?view=flowsheets&patient=PT-008&role=nurse");
  await page.getByRole("button", { name: "Pull bedside monitor values" }).click();
  await expect(page.locator("body")).toContainText("EWS");
  await page.getByRole("button", { name: "File vitals" }).click();
  await expect(page.locator(".form-message.success", { hasText: "Vitals filed" }).first()).toBeVisible();
  await expect(page.getByText("Escalation triggered")).toBeVisible();
  await expect(page.locator("body")).toContainText(/sepsis screen positive/i);

  // Back and forward replay the URL.
  await page.goBack();
  await expect(page).toHaveURL(/view=emar/);
  await page.goForward();
  await expect(page).toHaveURL(/view=flowsheets/);
});
