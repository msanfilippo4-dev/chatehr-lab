import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.PRACTICE_EHR_URL ?? "http://localhost:3000";
const outputDir = path.resolve(process.cwd(), "../assets/ehr-screens");
await fs.mkdir(outputDir, { recursive: true });
for (const file of await fs.readdir(outputDir)) {
  if (file.endsWith(".png")) await fs.rm(path.join(outputDir, file));
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
await page.goto(baseUrl, { waitUntil: "networkidle" });

async function capture(name) {
  await page.screenshot({
    path: path.join(outputDir, `${name}.png`),
    fullPage: true,
  });
}

await capture("01-worklist");

await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Front Desk");
await page.getByRole("button", { name: "Schedule", exact: true }).click();
await capture("02-schedule-and-conflict-check");

await page.getByRole("button", { name: "Patients", exact: true }).click();
await capture("03-patient-search-and-identity-warning");

await page.getByRole("button", { name: "Coding" }).click();
await capture("04-code-search-and-version-notice");

await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("HIM");
await capture("13-mpi-identity-workbench");

await page.getByRole("button", { name: "HIE", exact: true }).click();
await capture("14-hie-reconciliation-inbox");

await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Clinical");
await page.getByRole("button", { name: "Encounter", exact: true }).click();
await capture("05-soap-note-and-chart-evidence");

await page.getByRole("button", { name: "Orders & Results", exact: true }).click();
await capture("06-medication-allergy-warning");

await page.getByRole("button", { name: "Portal", exact: true }).click();
await capture("07-patient-portal-messages");

await page.getByRole("button", { name: "AI Review", exact: true }).click();
await capture("09-ai-draft-review");

await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Analyst");
await page.getByRole("button", { name: "Run cohort query" }).click();
await capture("15-query-studio-results");

await page.getByRole("button", { name: "Analytics", exact: true }).click();
await capture("08-population-and-access-analytics");

await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Implementation Lead");
await capture("16-implementation-readiness-board");

await page.getByRole("button", { name: "Exercises", exact: true }).click();
await capture("10-exercise-progress-evidence");

await page.getByRole("combobox", { name: "Select simulated role" }).selectOption("Clinical");
await page.getByRole("button", { name: "Patients", exact: true }).click();
await page.getByRole("button", { name: "Audit" }).click();
await capture("11-chart-audit-history");

await page.getByRole("button", { name: "Results", exact: true }).click();
await capture("12-longitudinal-results");

await browser.close();
console.log(`Captured 16 practice EHR screens in ${outputDir}`);
