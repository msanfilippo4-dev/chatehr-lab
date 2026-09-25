#!/usr/bin/env node
/**
 * Capture FordMS screens for the course slides.
 * Requires a running server with FORDMS_TEST_AUTH=1 (see playwright.config.ts).
 *
 * Usage: FORDMS_E2E_BASE_URL=http://127.0.0.1:3100 node scripts/capture_screens.mjs [outDir]
 * Default outDir: ../assets/screens (the 01–20 filenames are the ones the slides already use).
 * Afterwards remove the test accounts with: node scripts/cleanup_test_users.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const baseURL = process.env.FORDMS_E2E_BASE_URL ?? "http://127.0.0.1:3100";
const outDir = resolve(process.argv[2] ?? "../assets/screens");
mkdirSync(outDir, { recursive: true });
const runId = Date.now().toString(36);
const studentEmail = `e2e-capture-${runId}@fordham.edu`;
const instructorEmail = `e2e-capture-staff-${runId}@fordham.edu`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const storage = () => page.locator(".storage-line");
async function saved() {
  await page.waitForTimeout(350);
  await storage().filter({ hasText: "Saved to your Fordham course account" }).waitFor({ timeout: 30_000 });
}
async function signIn(email, role) {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Test email").fill(email);
  await page.getByLabel("Test role").selectOption(role);
  await page.getByRole("button", { name: "Sign in as test account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.getByRole("navigation", { name: "FordMS EHR modules" }).waitFor();
  await storage().filter({ hasText: /workspace|Saved/ }).waitFor();
}
/** Open a deep link once the cloud copy is saved (a reload restores the cloud workspace). */
async function go(path) {
  await saved();
  await page.goto(`${baseURL}${path}`);
  await page.getByRole("navigation", { name: "FordMS EHR modules" }).waitFor();
  await storage().filter({ hasText: /restored|Saved/ }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(300);
}
const tab = (name) => page.getByRole("navigation", { name: "FordMS EHR modules" }).getByRole("link", { name, exact: true }).click();
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const shot = async (name) => {
  // Prefer a settled "Saved" status line, but never block a capture on it.
  await storage().filter({ hasText: /Saved|restored/ }).waitFor({ timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(outDir, name), fullPage: false });
  console.log("captured", name);
};

await signIn(studentEmail, "student");

// 01 Worklist (analyst home)
await go("/?view=worklist&role=analyst");
await shot("01-worklist.png");

// 02 Schedule conflict (Front Desk)
await go("/?view=schedule&role=front-desk");
const form = page.locator("form.form-stack");
await form.getByLabel("Patient", { exact: true }).selectOption("PT-002");
await form.getByLabel("Date", { exact: true }).fill("2026-09-21");
await form.getByLabel("Time", { exact: true }).fill("09:00");
await form.getByRole("button", { name: "Create appointment" }).click();
await page.locator(".form-message.error").waitFor();
await shot("02-schedule-and-conflict-check.png");
// Complete the A1 scheduling steps so the guide, evidence, and grading screens have real content.
await form.getByLabel("Date", { exact: true }).fill("2026-09-28");
await form.getByLabel("Time", { exact: true }).fill("10:00");
await form.getByRole("button", { name: "Create appointment" }).click();
await page.locator(".form-message.success").waitFor();
await page.locator("table tbody tr", { hasText: "2026-09-28" }).first().getByRole("button", { name: "Reschedule" }).click();
await form.getByLabel("Time", { exact: true }).fill("11:00");
await form.getByRole("button", { name: "Save reschedule" }).click();
await page.locator(".form-message.success", { hasText: "rescheduled" }).waitFor();

// 03–04 Chart with duplicate warning and the coding tab
await go("/?view=chart&patient=PT-001&role=front-desk");
await shot("03-patient-search-and-identity-warning.png");
// A page load does not record "Open chart"; clicking the patient does (as the in-app guide links do).
await page.locator(".patient-list button", { hasText: "Liu Huang" }).first().click();
await page.getByRole("button", { name: /Send to HIM identity queue/ }).click();
await page.getByRole("tab", { name: "Coding" }).click();
await shot("04-code-search-and-version-notice.png");
await page.getByRole("button", { name: /Record use of ICD-10-CM M75.51/ }).click();
await page.getByRole("button", { name: /Record use of CPT 99213/ }).click();

// 13 MPI (HIM), then record the identity decision
await go("/?view=mpi&role=him");
await shot("13-mpi-identity-workbench.png");
await page.getByLabel("Identity decision").selectOption("Need more information");
await page.getByLabel("Identity review reasoning").fill("Date of birth and language match, but phone, MRN, and name form differ. Verify with the patient using two identifiers before any merge.");
await page.getByRole("button", { name: "Record identity decision" }).click();
await page.locator(".form-message.success").waitFor();

// 17 Registration duplicate check
await go("/?view=registration&role=front-desk");
await page.getByLabel("Legal name", { exact: true }).fill("Liu Hwang");
await page.getByLabel("Date of birth", { exact: true }).fill("1984-03-19");
await page.getByLabel("Phone", { exact: true }).fill("(917) 555-4812");
await page.locator(".match-panel").waitFor();
await shot("17-registration-duplicate-check.png");

// 05 SOAP note (Physician/APP)
await go("/?view=encounter&patient=PT-001&role=physician");
await page.getByLabel("S · subjective").fill("Right shoulder pain after increased lifting, improves with rest. No fall, fever, weakness, or numbness. Mandarin interpreter used.");
await page.getByLabel("O · objective").fill("BP 124/78, HR 72. Tenderness over right lateral shoulder; range limited by pain. Neurologic exam not performed.");
await page.getByLabel("A · assessment").fill("Right shoulder bursitis (M75.51).");
await page.getByLabel("P · plan").fill("Rest, ice, activity modification, physical therapy referral, follow-up in four weeks.");
await page.getByRole("button", { name: "Sign note" }).click();
await page.getByLabel("Reason for amendment").fill("Clarify that the neurologic examination was not performed.");
await page.getByRole("button", { name: "Add amendment" }).click();
await shot("05-soap-note-and-chart-evidence.png");

// 06 Allergy warning on an amoxicillin order for Liu Huang
await tab("Orders & Results");
await page.getByText("Drug-allergy warning").waitFor();
await shot("06-medication-allergy-warning.png");

// 12 Longitudinal results (Marcus Reed)
await go("/?view=chart&patient=PT-002&role=physician&tab=results");
await shot("12-longitudinal-results.png");

// 23 In Basket with an AI-drafted reply
await go("/?view=in-basket&role=physician");
await page.getByRole("button", { name: "AI Draft Replies", exact: true }).click();
await page.getByRole("button", { name: /^Marcus Reed — Is my potassium dangerous/ }).click();
await shot("23-in-basket.png");

// 07 Portal messages (Elena Garcia)
await go("/?view=portal&patient=PT-003&role=nurse");
await shot("07-patient-portal-messages.png");

// 21 eMAR barcode scan with a dose mismatch
await go("/?view=emar&patient=PT-008&role=nurse");
const scan = page.getByRole("region", { name: "Barcode scan" });
await page.getByRole("button", { name: "Scan Metoprolol tartrate 25 mg tablet at 09:00" }).click();
await scan.getByLabel("Scan wristband").selectOption({ label: "Sofia Petrov · Rm 415-A" });
await scan.getByRole("button", { name: "Scan wristband" }).click();
await scan.getByLabel("Scan medication").selectOption({ label: "Metoprolol tartrate 50 mg tablet (unit dose)" });
await scan.getByRole("button", { name: "Scan medication" }).click();
await scan.getByText("DOSE MISMATCH").first().waitFor();
await shot("21-emar-barcode-scan.png");

// 22 Flowsheet with a high early warning score
await go("/?view=flowsheets&patient=PT-008&role=nurse");
await page.getByRole("button", { name: "Pull bedside monitor values" }).click();
await page.getByRole("button", { name: "File vitals" }).click();
await page.locator(".form-message.success").waitFor();
await top();
await shot("22-flowsheet-ews.png");

// 24–25 Billing: scrubber and denials
await go("/?view=billing&role=revenue-cycle");
await page.getByRole("button", { name: /Elena Garcia — CLM-26-0412/ }).click();
await page.getByRole("button", { name: "Run scrubber" }).click();
await shot("24-claim-scrubber.png");
await page.getByRole("tab", { name: /Denials/ }).click();
await page.getByRole("button", { name: /Noah Williams — CLM-26-0388/ }).click();
await shot("25-denial-queue.png");

// 08 Analytics, 15 Query Studio
await go("/?view=analytics&role=analyst");
await shot("08-population-and-access-analytics.png");
await tab("Query Studio");
await page.getByRole("button", { name: "Run cohort query" }).click();
await page.locator(".query-preview").waitFor();
await shot("15-query-studio-results.png");

// 26–27 Tickets
await go("/?view=tickets&role=analyst");
await shot("26-analyst-tickets.png");
await page.getByRole("button", { name: /^TKT-1041/ }).click();
await page.getByLabel("Category", { exact: true }).selectOption("Safety");
await page.getByLabel("Priority", { exact: true }).selectOption("High");
await page.getByRole("button", { name: "Save triage" }).click();
await page.getByLabel("Active order: metoprolol tartrate 25 mg PO BID with hold parameters", { exact: true }).check();
await page.getByLabel("Medication drawer: only metoprolol tartrate 50 mg tablets stocked for this patient (plus a look-alike ER product)", { exact: true }).check();
await page.getByLabel("Administration history: three dose-mismatch overrides in 48 hours ('pharmacy sent 50 mg')", { exact: true }).check();
await page.getByRole("button", { name: "Save evidence" }).click();
await page.getByLabel("Root cause", { exact: true }).selectOption({ index: 2 });
await page.getByLabel("Root cause detail").fill("The drawer is stocked with 50 mg tablets for a 25 mg order; every scan correctly flags a dose mismatch, and night shift has overridden it three times.");
await page.getByLabel("Fix or recommendation").fill("Pharmacy to stock 25 mg unit doses for this order today; review override reports weekly on 4 West.");
await page.getByLabel("Pharmacy operations manager", { exact: true }).check();
await page.getByLabel("4 West nurse manager", { exact: true }).check();
await page.getByLabel("Message to requester").fill("Hi Jordan, the scanner is right: the drawer had 50 mg tablets for a 25 mg order. Pharmacy is restocking 25 mg doses today; please hold and call pharmacy if you see it again.");
await page.getByRole("button", { name: "Resolve ticket" }).scrollIntoViewIfNeeded();
await shot("27-ticket-resolution.png");

// 09 & 28 AI review
await go("/?view=ai-review&role=analyst");
const classify = async (n, label, source) => {
  await page.getByRole("button", { name: `Sentence ${n}`, exact: true }).click();
  await page.getByRole("radio", { name: label, exact: true }).check();
  await page.getByLabel("Source line").selectOption(source);
  await page.getByRole("button", { name: "Save classification" }).click();
};
await classify(1, "Supported", "S1");
await classify(2, "Contradicts source", "S3");
await classify(3, "Supported", "S3");
await page.getByRole("button", { name: "Sentence 6", exact: true }).click();
await top();
await shot("09-ai-draft-review.png");
await page.getByRole("radio", { name: "Unsupported", exact: true }).check();
await page.getByLabel("Source line").selectOption("S5");
await page.evaluate(() => {
  const heading = [...document.querySelectorAll("h2, h3")].find((node) => /Classify sentence/.test(node.textContent ?? ""));
  if (heading) window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - 330);
});
await shot("28-ai-review-sentence-classification.png");

// 10 Assignments guide (A1 is complete at this point, so steps show as ticked)
await go("/?view=assignments&role=analyst");
await shot("10-exercise-progress-evidence.png");

// 11 Audit, 13 MPI, 14 HIE
await go("/?view=audit&patient=PT-001&role=him");
await shot("11-chart-audit-history.png");
await tab("HIE");
await shot("14-hie-reconciliation-inbox.png");

// 16 Implementation readiness
await go("/?view=implementation&role=implementation-lead");
await shot("16-implementation-readiness-board.png");

// Submit A1 so the grading screen shows a synthetic submission (never a real student).
await go("/?view=assignments&role=analyst");
await page.locator(".assignment-list button", { hasText: "A1" }).first().click();
await page.getByLabel("Written analysis").fill("I compared the date of birth and preferred language, which matched, against the phone number, MRN, and the shortened name, which differed, and recorded that more information is needed rather than merging. The scheduling conflict appeared because Dr. Chen already had a 9:00 visit, so I booked an open slot and later rescheduled it while the appointment identifier stayed the same. M75.51 is an ICD-10-CM diagnosis; 99213 is a CPT service code.");
await page.getByRole("button", { name: /Submit assignment/ }).click();
await page.locator(".form-message.success", { hasText: "Submitted" }).waitFor({ timeout: 45_000 });

// 18–20 Instructor screens (roster filtered to this run's synthetic accounts)
await saved();
await page.locator("details.workspace-menu summary").click();
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL(/login/);
await signIn(instructorEmail, "instructor");
await tab("Gradebook");
await page.getByLabel("Show test accounts").check();
await page.getByLabel("Search", { exact: true }).fill(`e2e-capture-${runId}`);
// Select the synthetic student first: the gradebook otherwise preselects the first enrolled student.
await page.locator(".roster-table tbody tr", { hasText: studentEmail }).first().click();
await page.getByRole("heading", { name: "Student submission" }).waitFor();
await page.getByText("Test e2e-capture", { exact: false }).first().waitFor();
await top();
await shot("18-instructor-progress-overview.png");
await page.getByRole("heading", { name: /Rubric scoring/ }).evaluate((node) => window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 420));
await shot("19-instructor-rubric-grading.png");
await tab("Admin");
await page.getByRole("button", { name: "Alert rules" }).click();
await page.locator(".catalog-table").waitFor();
await shot("20-admin-config-editor.png");

await browser.close();
console.log("Done. Remove test users with: node scripts/cleanup_test_users.mjs");
