import { readFile } from "fs/promises";
import path from "path";
import { Patient } from "./types";
import { getBronxHospitalCohort } from "./cohort-context";

export type FordhamBenchGroundTruth = {
  lab001Potassium: number | null;
  lab001ActiveRiskMedication: string | null;
  lab001DiscontinuedMedication: string | null;
  lab002A1c: number | null;
  lab002Ldl: number | null;
  lab003Hcg: number | null;
  bronxFluCount: number;
  bronxA1cHighCount: number;
  bronxA1cHighIds: string[];
  allPatientsNoFluCount: number;
  allPatientsCkdCount: number;
};

let cachedPatients: Patient[] | null = null;

function byDateDesc<T extends { date: string }>(a: T, b: T): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

function parseFirstNumber(text: string, regex: RegExp): number | null {
  const match = text.match(regex);
  if (!match) return null;
  const raw = Number.parseFloat(match[1]);
  return Number.isFinite(raw) ? raw : null;
}

function latestLab(patient: Patient | null, name: string): number | null {
  if (!patient) return null;
  const latest = patient.labs
    .filter((l) => l.name.toLowerCase() === name.toLowerCase())
    .sort(byDateDesc)[0];
  return latest ? latest.value : null;
}

function hasFluShot(patient: Patient): boolean {
  return patient.immunizations.some((i) => i.name.toLowerCase().includes("influenza"));
}

function hasHighA1c(patient: Patient): boolean {
  const a1c = latestLab(patient, "Hemoglobin A1c");
  return a1c !== null && a1c >= 8;
}

function hasCkdCondition(patient: Patient): boolean {
  return patient.conditions.some(
    (c) =>
      c.code.toLowerCase().startsWith("n18") ||
      c.display.toLowerCase().includes("kidney")
  );
}

function getLab001PotassiumFromNotes(patient: Patient | null): number | null {
  if (!patient) return null;
  const noteCandidate = patient.visits
    .slice()
    .sort(byDateDesc)
    .map((v) => parseFirstNumber(v.notes, /potassium(?: of|:)?\s*([0-9]+(?:\.[0-9]+)?)/i))
    .find((n) => n !== null);
  return noteCandidate ?? latestLab(patient, "Potassium");
}

function getLab002A1cFromNotes(patient: Patient | null): number | null {
  if (!patient) return null;
  const noteCandidate = patient.visits
    .slice()
    .sort(byDateDesc)
    .map((v) => parseFirstNumber(v.notes, /HbA1c(?: is currently|:)?\s*([0-9]+(?:\.[0-9]+)?)%/i))
    .find((n) => n !== null);
  return noteCandidate ?? latestLab(patient, "Hemoglobin A1c");
}

function getLab002LdlFromNotes(patient: Patient | null): number | null {
  if (!patient) return null;
  const noteCandidate = patient.visits
    .slice()
    .sort(byDateDesc)
    .map((v) =>
      parseFirstNumber(v.notes, /LDL(?: Cholesterol)?(?: is)?\s*([0-9]+(?:\.[0-9]+)?)\s*mg\/dL/i)
    )
    .find((n) => n !== null);
  return noteCandidate ?? latestLab(patient, "LDL Cholesterol");
}

function lower(value: string | undefined): string {
  return (value || "").toLowerCase();
}

function getLab001MedicationFacts(patient: Patient | null): {
  activeRiskMedication: string | null;
  discontinuedMedication: string | null;
} {
  if (!patient) {
    return { activeRiskMedication: null, discontinuedMedication: null };
  }

  const activeRiskMedication =
    patient.medications.find(
      (m) => lower(m.status) === "active" && lower(m.name).includes("lisinopril")
    )?.name || null;

  const discontinuedMedication =
    patient.medications.find(
      (m) => lower(m.status) === "discontinued" && lower(m.name).includes("spironolactone")
    )?.name || null;

  return { activeRiskMedication, discontinuedMedication };
}

export async function loadPatientsDataset(): Promise<Patient[]> {
  if (cachedPatients) return cachedPatients;
  const filePath = path.join(process.cwd(), "public", "data", "patients.json");
  const raw = await readFile(filePath, "utf8");
  cachedPatients = JSON.parse(raw) as Patient[];
  return cachedPatients;
}

export async function getFordhamHealthBenchGroundTruth(
  patientsInput?: Patient[]
): Promise<FordhamBenchGroundTruth> {
  const patients = patientsInput || (await loadPatientsDataset());
  const lab001 = patients.find((p) => p.id === "LAB-001") || null;
  const lab002 = patients.find((p) => p.id === "LAB-002") || null;
  const lab003 = patients.find((p) => p.id === "LAB-003") || null;
  const bronx = getBronxHospitalCohort(patients);

  const bronxA1cHigh = bronx.filter(hasHighA1c);
  const { activeRiskMedication, discontinuedMedication } =
    getLab001MedicationFacts(lab001);

  return {
    lab001Potassium: getLab001PotassiumFromNotes(lab001),
    lab001ActiveRiskMedication: activeRiskMedication,
    lab001DiscontinuedMedication: discontinuedMedication,
    lab002A1c: getLab002A1cFromNotes(lab002),
    lab002Ldl: getLab002LdlFromNotes(lab002),
    lab003Hcg: latestLab(lab003, "Pregnancy test (hCG)"),
    bronxFluCount: bronx.filter(hasFluShot).length,
    bronxA1cHighCount: bronxA1cHigh.length,
    bronxA1cHighIds: bronxA1cHigh.map((p) => p.id).sort(),
    allPatientsNoFluCount: patients.filter((p) => !hasFluShot(p)).length,
    allPatientsCkdCount: patients.filter(hasCkdCondition).length,
  };
}
