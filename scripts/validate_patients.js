import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function fail(errors) {
  console.error("Patient dataset validation failed:");
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

function latestLab(patient, name) {
  return patient.labs
    .filter((l) => l.name.toLowerCase() === name.toLowerCase())
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;
}

function hasFlu(patient) {
  return patient.immunizations.some((i) =>
    i.name.toLowerCase().includes("influenza")
  );
}

const dataPath = path.join(__dirname, "..", "public", "data", "patients.json");
const patients = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const errors = [];

if (!Array.isArray(patients)) {
  fail(["patients.json is not an array"]);
}

if (patients.length !== 1003) {
  errors.push(`Expected 1003 total patients, found ${patients.length}`);
}

const expectedGolden = [
  ["LAB-001", "Eleanor Vance"],
  ["LAB-002", "Marcus Thorne"],
  ["LAB-003", "Chloe Davis"],
];
for (const [id, expectedName] of expectedGolden) {
  const p = patients.find((x) => x.id === id);
  if (!p) {
    errors.push(`Missing golden patient ${id}`);
    continue;
  }
  if (p.name !== expectedName) {
    errors.push(`Golden patient ${id} name mismatch: expected "${expectedName}", got "${p.name}"`);
  }
}

const lab001 = patients.find((x) => x.id === "LAB-001");
const lab002 = patients.find((x) => x.id === "LAB-002");
const lab003 = patients.find((x) => x.id === "LAB-003");

if (!lab001?.visits?.[0]?.notes?.includes("potassium of 5.8")) {
  errors.push("LAB-001 note does not include potassium 5.8 clue");
}
if (!lab002?.visits?.[0]?.notes?.includes("HbA1c is currently 8.7%")) {
  errors.push("LAB-002 note does not include A1c 8.7 clue");
}
if (!lab002?.visits?.[0]?.notes?.includes("LDL Cholesterol is 142 mg/dL")) {
  errors.push("LAB-002 note does not include LDL 142 clue");
}

const lab001Spironolactone = lab001?.medications?.find(
  (m) => m.name.toLowerCase() === "spironolactone"
);
if (!lab001Spironolactone || lab001Spironolactone.status !== "Discontinued") {
  errors.push("LAB-001 spironolactone should be present and Discontinued");
}

const lab003Hcg = latestLab(lab003, "Pregnancy test (hCG)")?.value ?? null;
if (lab003Hcg !== 450) {
  errors.push(`LAB-003 hCG expected 450, got ${lab003Hcg}`);
}

const bronx = patients
  .filter((p) => typeof p.id === "string" && p.id.startsWith("PT-"))
  .sort((a, b) => Number(a.id.slice(3)) - Number(b.id.slice(3)))
  .slice(0, 50);

if (bronx.length !== 50) {
  errors.push(`Bronx cohort expected 50 patients, got ${bronx.length}`);
}

const bronxFlu = bronx.filter(hasFlu).length;
if (bronxFlu !== 34) {
  errors.push(`Bronx flu count expected 34, got ${bronxFlu}`);
}

const bronxA1cHighIds = bronx
  .filter((p) => {
    const a1c = latestLab(p, "Hemoglobin A1c");
    return a1c && a1c.value >= 8;
  })
  .map((p) => p.id)
  .sort();

if (bronxA1cHighIds.length !== 12) {
  errors.push(`Bronx A1c>=8 count expected 12, got ${bronxA1cHighIds.length}`);
}

if (errors.length > 0) {
  fail(errors);
}

console.log("Patient dataset validation passed.");
console.log(`- Total patients: ${patients.length}`);
console.log(`- Bronx cohort size: ${bronx.length}`);
console.log(`- Bronx flu recipients: ${bronxFlu}`);
console.log(`- Bronx A1c>=8 count: ${bronxA1cHighIds.length}`);
