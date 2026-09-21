#!/usr/bin/env node
/**
 * Capture production-like FordMS screens for the course slides.
 * Requires a running server with FORDMS_TEST_AUTH=1 (see playwright.config.ts).
 *
 * Usage: FORDMS_E2E_BASE_URL=http://127.0.0.1:3100 node scripts/capture_screens.mjs [outDir]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const baseURL = process.env.FORDMS_E2E_BASE_URL ?? "http://127.0.0.1:3100";
const outDir = resolve(process.argv[2] ?? "../assets/ehr-screens");
mkdirSync(outDir, { recursive: true });
const runId = Date.now().toString(36);
const studentEmail = `e2e-capture-${runId}@fordham.edu`;
const instructorEmail = `e2e-capture-staff-${runId}@fordham.edu`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
const page = await context.newPage();

async function signIn(email, role) {
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Test email").fill(email);
  await page.getByLabel("Test role").selectOption(role);
  await page.getByRole("button", { name: "Sign in as test account" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.getByRole("navigation", { name: "FordMS EHR modules" }).waitFor();
  await page.locator(".storage-line").filter({ hasText: /workspace|Saved/ }).waitFor();
}
const role = (name) => page.getByLabel("Select simulated role").selectOption(name);
const tab = (name) => page.getByRole("navigation", { name: "FordMS EHR modules" }).getByRole("button", { name, exact: true }).click();
const shot = async (name) => { await page.waitForTimeout(400); await page.screenshot({ path: resolve(outDir, name), fullPage: false }); console.log("captured", name); };
const chart = async (query, name) => { await tab("Patients"); await page.getByLabel("Search patients").fill(query); await page.locator(".patient-list button", { hasText: name }).first().click(); };

await signIn(studentEmail, "student");
await role("Clinical");
await tab("Worklist");
await shot("01-worklist.png");

await role("Front Desk");
await tab("Schedule");
const form = page.locator("form.form-stack");
await form.getByLabel("Patient", { exact: true }).selectOption("PT-002");
await form.getByLabel("Date", { exact: true }).fill("2026-09-21");
await form.getByLabel("Time", { exact: true }).fill("09:00");
await page.getByRole("button", { name: "Create appointment" }).click();
await page.locator(".form-message.error").waitFor();
await shot("02-schedule-and-conflict-check.png");

await chart("Liu", "Liu Huang");
await shot("03-patient-search-and-identity-warning.png");
await page.getByRole("tab", { name: "Coding" }).click();
await shot("04-code-search-and-version-notice.png");

await tab("Registration");
await page.getByLabel("Legal name", { exact: true }).fill("Liu Hwang");
await page.getByLabel("Date of birth", { exact: true }).fill("1984-03-19");
await page.getByLabel("Phone", { exact: true }).fill("(917) 555-4812");
await page.locator(".match-panel").waitFor();
await shot("17-registration-duplicate-check.png");

await role("Clinical");
await chart("Liu", "Liu Huang");
await tab("Encounter");
await page.getByLabel("S · subjective").fill("Right shoulder pain after increased lifting, improves with rest. No fall, fever, weakness, or numbness.");
await page.getByLabel("O · objective").fill("BP 132/78. Tenderness over right lateral shoulder; range limited by pain. Neurologic exam not performed.");
await page.getByLabel("A · assessment").fill("Right shoulder bursitis (M75.51).");
await page.getByLabel("P · plan").fill("Rest, activity modification, physical therapy referral, follow-up in four weeks.");
await page.getByRole("button", { name: "Sign note" }).click();
await page.getByLabel("Reason for amendment").fill("Clarify that the neurologic examination was deferred.");
await page.getByRole("button", { name: "Add amendment" }).click();
await shot("05-soap-note-and-chart-evidence.png");

await tab("Orders & Results");
await page.getByText("Drug-allergy warning").waitFor();
await shot("06-medication-allergy-warning.png");
await page.getByLabel("Order type", { exact: true }).selectOption("Laboratory");
await page.getByRole("button", { name: "Submit simulated order" }).click();

await chart("Elena", "Elena Garcia");
await tab("Portal");
await shot("07-patient-portal-messages.png");

await role("Analyst");
await tab("Analytics");
await shot("08-population-and-access-analytics.png");
await tab("Query Studio");
await page.getByRole("button", { name: "Run cohort query" }).click();
await page.locator(".query-preview").waitFor();
await shot("15-query-studio-results.png");

await role("Clinical");
await chart("Liu", "Liu Huang");
await tab("AI Review");
await page.locator(".taxonomy-grid input").nth(0).check();
await page.locator(".taxonomy-grid input").nth(1).check();
await page.locator(".taxonomy-grid input").nth(2).check();
await shot("09-ai-draft-review.png");

await tab("Assignments");
await shot("10-exercise-progress-evidence.png");

await role("HIM");
await chart("Liu", "Liu Huang");
await tab("Audit Review");
await shot("11-chart-audit-history.png");
await chart("Liu", "Liu Huang");
await page.getByRole("tab", { name: "Results" }).click();
await shot("12-longitudinal-results.png");
await tab("MPI");
await shot("13-mpi-identity-workbench.png");
await tab("HIE");
await shot("14-hie-reconciliation-inbox.png");

await role("Implementation Lead");
await tab("Implementation");
await shot("16-implementation-readiness-board.png");

await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL(/login/);
await signIn(instructorEmail, "instructor");
await tab("Gradebook");
await page.getByLabel("Show test accounts").check();
await page.locator(".roster-table tbody tr").first().waitFor();
await shot("18-instructor-progress-overview.png");
await page.locator(".roster-table tbody tr").first().click();
await page.getByRole("heading", { name: "Student submission" }).waitFor();
await shot("19-instructor-rubric-grading.png");
await tab("Admin");
await page.getByRole("button", { name: "Alert rules" }).click();
await page.locator(".catalog-table").waitFor();
await shot("20-admin-config-editor.png");

await browser.close();
console.log(`Done. Remove test users with: node scripts/cleanup_test_users.mjs`);
