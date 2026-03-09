/**
 * Seed Database — deterministic local seed for ChartEHR course product.
 *
 * Usage:
 *   npx tsx scripts/generate_patients.ts
 *   npx tsx scripts/seed_database.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import {
  benchmarkSeedCases,
  expectedSeedCounts,
  guidelineSeedChunks,
  type SeedPatientData,
} from "./data/teaching-content";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env.local in project root.");
  }

  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceKey);

async function seedPatients() {
  const patientsPath = path.join(__dirname, "output", "patients.json");
  if (!fs.existsSync(patientsPath)) {
    throw new Error(
      "Missing scripts/output/patients.json. Run `npx tsx scripts/generate_patients.ts` first."
    );
  }

  console.log("Seeding patients...");
  const patients = JSON.parse(
    fs.readFileSync(patientsPath, "utf-8")
  ) as SeedPatientData[];

  for (const table of [
    "clinical_notes",
    "imaging_reports",
    "social_history",
    "encounters",
    "immunizations",
    "allergies",
    "medications",
    "lab_results",
    "conditions",
  ]) {
    await supabase.from(table).delete().neq("id", "");
  }
  await supabase.from("patients").delete().like("id", "PT-%");

  const batchSize = 100;
  for (let start = 0; start < patients.length; start += batchSize) {
    const batch = patients.slice(start, start + batchSize);

    const patientRows = batch.map((patient) => ({
      id: patient.id,
      name: patient.name,
      dob: patient.dob,
      age: patient.age,
      gender: patient.gender,
      race: patient.race ?? null,
      ethnicity: patient.ethnicity ?? null,
      language: patient.language ?? "English",
      marital_status: patient.maritalStatus ?? null,
      address_zip: patient.addressZip ?? null,
      insurance_type: patient.insuranceType ?? null,
      is_complex: patient.isComplex ?? false,
      last_visit: patient.lastVisit,
    }));

    const { error: patientError } = await supabase
      .from("patients")
      .upsert(patientRows);
    if (patientError) {
      throw new Error(`Failed seeding patients: ${patientError.message}`);
    }

    const conditionRows = batch.flatMap((patient) =>
      patient.conditions.map((condition) => ({
        patient_id: patient.id,
        code: condition.code,
        display: condition.display,
        onset: condition.onset,
        status: condition.status ?? "active",
      }))
    );
    if (conditionRows.length > 0) {
      await supabase.from("conditions").insert(conditionRows);
    }

    const labRows = batch.flatMap((patient) =>
      patient.labResults.map((lab) => ({
        patient_id: patient.id,
        name: lab.name,
        value: lab.value,
        unit: lab.unit,
        flag: lab.flag,
        reference_range: lab.referenceRange ?? null,
        date: lab.date,
      }))
    );
    if (labRows.length > 0) {
      await supabase.from("lab_results").insert(labRows);
    }

    const medicationRows = batch.flatMap((patient) =>
      patient.medications.map((medication) => ({
        patient_id: patient.id,
        name: medication.name,
        dose: medication.dose,
        frequency: medication.frequency,
        route: medication.route,
        status: medication.status,
        started: medication.started,
        ended: medication.ended ?? null,
      }))
    );
    if (medicationRows.length > 0) {
      await supabase.from("medications").insert(medicationRows);
    }

    const allergyRows = batch.flatMap((patient) =>
      patient.allergies.map((allergy) => ({
        patient_id: patient.id,
        allergen: allergy.allergen,
        reaction: allergy.reaction,
        severity: allergy.severity,
      }))
    );
    if (allergyRows.length > 0) {
      await supabase.from("allergies").insert(allergyRows);
    }

    const immunizationRows = batch.flatMap((patient) =>
      patient.immunizations.map((immunization) => ({
        patient_id: patient.id,
        name: immunization.name,
        cvx: immunization.cvx,
        date: immunization.date,
      }))
    );
    if (immunizationRows.length > 0) {
      await supabase.from("immunizations").insert(immunizationRows);
    }

    const encounterRows = batch.flatMap((patient) =>
      patient.encounters.map((encounter) => ({
        patient_id: patient.id,
        date: encounter.date,
        type: encounter.type,
        provider: encounter.provider,
        chief_complaint: encounter.chiefComplaint,
        assessment: encounter.assessment ?? null,
        plan: encounter.plan ?? null,
        vitals: encounter.vitals ?? null,
        orders: encounter.orders ?? [],
      }))
    );
    if (encounterRows.length > 0) {
      await supabase.from("encounters").insert(encounterRows);
    }

    const imagingRows = batch.flatMap((patient) =>
      (patient.imagingReports ?? []).map((report) => ({
        patient_id: patient.id,
        type: report.type,
        finding: report.finding,
        impression: report.impression ?? null,
        date: report.date,
      }))
    );
    if (imagingRows.length > 0) {
      await supabase.from("imaging_reports").insert(imagingRows);
    }

    const socialRows = batch
      .filter((patient) => patient.socialHistory)
      .map((patient) => ({
        patient_id: patient.id,
        housing_status: patient.socialHistory?.housingStatus ?? null,
        employment_status: patient.socialHistory?.employmentStatus ?? null,
        food_security: patient.socialHistory?.foodSecurity ?? null,
        education_level: patient.socialHistory?.educationLevel ?? null,
        tobacco_use: patient.socialHistory?.tobaccoUse ?? null,
        alcohol_use: patient.socialHistory?.alcoholUse ?? null,
        recorded_date: patient.socialHistory?.recordedDate ?? patient.lastVisit,
      }));
    if (socialRows.length > 0) {
      await supabase.from("social_history").insert(socialRows);
    }

    const noteRows = batch.flatMap((patient) =>
      (patient.clinicalNotes ?? []).map((note) => ({
        patient_id: patient.id,
        note_type: note.noteType,
        content: note.content,
        author: note.author,
        date: note.date,
      }))
    );
    if (noteRows.length > 0) {
      await supabase.from("clinical_notes").insert(noteRows);
    }

    process.stdout.write(
      `\r  Seeded ${Math.min(start + batchSize, patients.length)} / ${patients.length} patients`
    );
  }

  process.stdout.write("\n");
}

async function seedCourseSettings() {
  console.log("Seeding course settings...");
  const { error } = await supabase.from("course_settings").upsert({
    id: "hinf6117",
    official_benchmark_locked: false,
    checkpoint_benchmark_locked: false,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed seeding course settings: ${error.message}`);
  }
}

async function seedGuidelines() {
  console.log("Seeding guideline chunks...");
  await supabase.from("guideline_chunks").delete().neq("id", "");

  const { error } = await supabase
    .from("guideline_chunks")
    .upsert(guidelineSeedChunks);
  if (error) {
    throw new Error(`Failed seeding guideline chunks: ${error.message}`);
  }
}

async function seedBenchmarkCases() {
  console.log("Seeding benchmark packs...");
  for (const table of [
    "instructor_flags",
    "benchmark_case_results",
    "benchmark_runs",
    "benchmark_cases",
  ]) {
    await supabase.from(table).delete().neq("id", "");
  }

  const { error } = await supabase
    .from("benchmark_cases")
    .upsert(benchmarkSeedCases);
  if (error) {
    throw new Error(`Failed seeding benchmark cases: ${error.message}`);
  }
}

async function verifySeedData() {
  console.log("Verifying seed counts...");
  const [
    patientCount,
    guidelineCount,
    benchmarkCount,
    fairnessCount,
    practiceCount,
    checkpointCount,
    finalCount,
  ] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).like("id", "PT-%"),
    supabase.from("guideline_chunks").select("id", { count: "exact", head: true }),
    supabase.from("benchmark_cases").select("id", { count: "exact", head: true }),
    supabase
      .from("benchmark_cases")
      .select("id", { count: "exact", head: true })
      .eq("category", "bias_equity"),
    supabase
      .from("benchmark_cases")
      .select("id", { count: "exact", head: true })
      .eq("pack_id", "practice"),
    supabase
      .from("benchmark_cases")
      .select("id", { count: "exact", head: true })
      .eq("pack_id", "checkpoint"),
    supabase
      .from("benchmark_cases")
      .select("id", { count: "exact", head: true })
      .eq("pack_id", "final"),
  ]);

  console.log(`  Patients:        ${patientCount.count ?? 0}`);
  console.log(
    `  Guideline chunks:${String(guidelineCount.count ?? 0).padStart(4, " ")} expected ${expectedSeedCounts.guidelineChunkCount}`
  );
  console.log(
    `  Benchmark cases: ${String(benchmarkCount.count ?? 0).padStart(4, " ")} expected ${expectedSeedCounts.benchmarkCaseCount}`
  );
  console.log(
    `  Bias/equity:     ${String(fairnessCount.count ?? 0).padStart(4, " ")} expected ${expectedSeedCounts.fairnessCaseCount}`
  );
  console.log(
    `  Practice pack:   ${String(practiceCount.count ?? 0).padStart(4, " ")} expected ${expectedSeedCounts.benchmarkPackCounts.practice}`
  );
  console.log(
    `  Checkpoint pack: ${String(checkpointCount.count ?? 0).padStart(4, " ")} expected ${expectedSeedCounts.benchmarkPackCounts.checkpoint}`
  );
  console.log(
    `  Final pack:      ${String(finalCount.count ?? 0).padStart(4, " ")} expected ${expectedSeedCounts.benchmarkPackCounts.final}`
  );
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  ChartEHR Course Product Seeder");
  console.log("═══════════════════════════════════════════════");
  console.log("");

  await seedPatients();
  console.log("");
  await seedCourseSettings();
  await seedGuidelines();
  await seedBenchmarkCases();
  console.log("");
  await verifySeedData();
  console.log("");
  console.log("Seed complete.");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
