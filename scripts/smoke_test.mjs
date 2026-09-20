import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const baseUrl = process.env.PRACTICE_EHR_URL ?? "http://localhost:3000";
const browserName = process.env.BROWSER === "webkit" ? "WebKit" : "Chrome";
const browser = process.env.BROWSER === "webkit" ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "networkidle" });

await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Front Desk");
await page.getByRole("button", { name: "Schedule", exact: true }).click();
await page.getByRole("button", { name: "Create appointment" }).click();
await assert.doesNotReject(() => page.getByText("Appointment created", { exact: false }).waitFor());
await page.getByRole("button", { name: "Create appointment" }).click();
await assert.doesNotReject(() => page.getByText("Conflict:", { exact: false }).waitFor());
await page.getByRole("button", { name: "Reschedule" }).first().click();
await page.getByRole("textbox", { name: "Date" }).fill("2026-09-22");
await page.getByRole("textbox", { name: "Time" }).fill("08:00");
await page.getByRole("button", { name: "Save reschedule" }).click();
await assert.doesNotReject(() => page.getByText("Appointment rescheduled", { exact: false }).waitFor());

await page.getByRole("button", { name: "Patients", exact: true }).click();
await assert.doesNotReject(() => page.getByText("Possible duplicate record").waitFor());

await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("HIM");
await assert.doesNotReject(() => page.getByText("Side-by-side identity review").waitFor());
await page.getByRole("combobox", { name: "Identity decision" }).selectOption({ label: "Need more information" });
await page.getByRole("textbox", { name: "Identity review reasoning" }).fill("Date of birth and language match, but phone and legal name require authoritative verification.");
await page.getByRole("button", { name: "Record identity decision" }).click();
await assert.doesNotReject(() => page.getByText("Decision recorded", { exact: false }).waitFor());

await page.getByRole("button", { name: "HIE", exact: true }).click();
await assert.doesNotReject(() => page.getByText("FHIR-like resources", { exact: false }).waitFor());
await page.getByRole("button", { name: "Accept into chart" }).first().click();
await assert.doesNotReject(() => page.getByText("Accepted into the longitudinal record", { exact: false }).waitFor());

await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Clinical");
await page.getByRole("button", { name: "Patients", exact: true }).click();
await page.getByRole("button", { name: "Encounter", exact: true }).click();
const note = {
  "S · subjective": "Right shoulder pain after lifting; improves with rest.",
  "O · objective": "BP 132/78; right lateral shoulder tenderness.",
  "A · assessment": "Right shoulder pain consistent with musculoskeletal strain.",
  "P · plan": "Activity modification and follow-up for worsening symptoms.",
};
for (const [label, value] of Object.entries(note)) await page.getByRole("textbox", { name: label }).fill(value);
await page.getByRole("button", { name: "Sign note" }).click();
await page.getByRole("textbox", { name: "Reason for amendment" }).fill("Clarified that the neurologic examination was not performed.");
await page.getByRole("button", { name: "Add amendment" }).click();

await page.getByRole("button", { name: "Orders & Results", exact: true }).click();
await assert.doesNotReject(() => page.getByText("Drug-allergy warning").waitFor());
await page.getByRole("combobox", { name: "Order type" }).selectOption("Laboratory");
await page.getByRole("button", { name: "Submit simulated order" }).click();
await page.getByRole("button", { name: "Review + follow-up" }).click();
await page.getByRole("button", { name: "Worklist", exact: true }).click();
await assert.doesNotReject(() => page.getByText("Follow up Basic metabolic panel", { exact: false }).waitFor());

await page.getByRole("button", { name: "AI Review", exact: true }).click();
const reviewChecks = page.getByRole("checkbox");
for (let i = 0; i < await reviewChecks.count(); i++) await reviewChecks.nth(i).check();
await page.getByRole("combobox", { name: "Decision" }).selectOption("Reject and redraft from evidence");
await page.getByRole("button", { name: "Record review" }).click();

await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Analyst");
await page.getByRole("button", { name: "Run cohort query" }).click();
await assert.doesNotReject(() => page.getByText("Query result", { exact: true }).waitFor());
await assert.doesNotReject(() => page.getByLabel("Query logic preview").waitFor());

await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Implementation Lead");
await page.getByRole("combobox", { name: "Downtime readiness status" }).selectOption("Ready");
await assert.doesNotReject(() => page.getByText("2/8", { exact: true }).waitFor());

await page.getByRole("button", { name: "Exercises", exact: true }).click();
await assert.doesNotReject(() => page.getByText("Completion comes from actions", { exact: false }).waitFor());
await page.getByRole("button", { name: /Master patient index adjudication/ }).click();
await assert.doesNotReject(() => page.getByText("All required actions are present", { exact: false }).waitFor());

await page.reload({ waitUntil: "networkidle" });
await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Clinical");
await page.getByRole("button", { name: "Patients", exact: true }).click();
await page.getByRole("button", { name: "Notes" }).click();
await assert.doesNotReject(() => page.getByText("Signed", { exact: true }).waitFor());
await assert.doesNotReject(() => page.getByText("Amendment", { exact: true }).waitFor());

const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "Export evidence" }).click();
const download = await downloadPromise;
const exportPath = await download.path();
assert.ok(exportPath);
const exported = JSON.parse(await fs.readFile(exportPath, "utf8"));
assert.equal(exported.version, 2);
assert.equal(exported.patients.length, 12);
assert.equal(exported.identityReviews[0].status, "Resolved");
assert.equal(exported.exchanges[0].status, "Accepted");
assert.ok(exported.queryRuns.length >= 1);

page.once("dialog", (dialog) => dialog.accept());
await page.getByRole("button", { name: "Reset" }).click();
await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Clinical");
await page.getByRole("button", { name: "Patients", exact: true }).click();
await page.getByRole("button", { name: "Notes" }).click();
await assert.doesNotReject(() => page.getByText("No notes have been created", { exact: false }).waitFor());

await page.getByLabel("Import workspace").setInputFiles(exportPath);
await page.waitForTimeout(500);
await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Clinical");
await page.getByRole("button", { name: "Patients", exact: true }).click();
await page.getByRole("button", { name: "Notes" }).click();
await assert.doesNotReject(() => page.getByText("Signed", { exact: true }).waitFor());

const skipLink = page.getByRole("link", { name: "Skip to main content" });
await skipLink.focus();
assert.equal(await page.evaluate(() => document.activeElement?.tagName), "A");
await page.keyboard.press("Enter");
assert.equal(await page.evaluate(() => document.activeElement?.id), "practice-ehr-main");

const unavailable = await browser.newContext();
const unavailablePage = await unavailable.newPage();
await unavailablePage.goto(`${baseUrl}?storage=unavailable`, { waitUntil: "networkidle" });
await assert.doesNotReject(() => unavailablePage.getByText("Could not save to browser storage", { exact: false }).waitFor());
await unavailablePage.getByRole("combobox", { name: "Select simulated role" }).selectOption("Front Desk");
await assert.doesNotReject(() => unavailablePage.getByRole("button", { name: "Schedule", exact: true }).click());

await unavailable.close();
await context.close();
await browser.close();
if (process.env.SMOKE_REPORT) {
  await fs.writeFile(process.env.SMOKE_REPORT, JSON.stringify({
    status: "pass",
    browser: browserName,
    checks: ["scheduling", "rescheduling", "conflict detection", "MPI adjudication", "HIE reconciliation", "SOAP history and amendments", "order warnings", "result follow-up", "AI review", "population query", "implementation readiness", "audit-driven exercise progress", "refresh persistence", "scenario reset", "export/import and v2 schema", "keyboard focus", "storage fallback"],
  }, null, 2));
}
console.log(`Practice EHR ${browserName} smoke test passed: scheduling, MPI, HIE, SOAP history, warnings, result follow-up, AI review, population query, implementation readiness, audit-driven exercises, persistence, reset, export/import, keyboard focus, and storage fallback.`);
