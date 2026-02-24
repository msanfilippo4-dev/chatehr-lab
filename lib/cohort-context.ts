import { Patient } from "./types";

export const ALL_PATIENTS_OPTION_ID = "__ALL_PATIENTS__";
export const BRONX_HOSPITAL_50_OPTION_ID = "__BRONX_HOSPITAL_50__";

function byPatientNumber(a: Patient, b: Patient): number {
  const aNum = Number.parseInt(a.id.replace(/\D/g, ""), 10);
  const bNum = Number.parseInt(b.id.replace(/\D/g, ""), 10);
  return aNum - bNum;
}

function isDemoPatient(patient: Patient): boolean {
  return patient.id.startsWith("LAB-");
}

export function getBronxHospitalCohort(patients: Patient[]): Patient[] {
  return patients
    .filter((p) => p.id.startsWith("PT-") && !isDemoPatient(p))
    .sort(byPatientNumber)
    .slice(0, 50);
}

function hasFluShot(patient: Patient): boolean {
  return patient.immunizations.some((i) => i.name.toLowerCase().includes("influenza"));
}

function latestLabValue(patient: Patient, labName: string): number | null {
  const candidate = patient.labs
    .filter((l) => l.name.toLowerCase() === labName.toLowerCase())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  return candidate ? candidate.value : null;
}

function formatPct(count: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((count / total) * 100).toFixed(1)}%`;
}

function topConditions(patients: Patient[], limit = 8): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const p of patients) {
    for (const c of p.conditions) {
      counts.set(c.display, (counts.get(c.display) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function buildCohortKeywords(patients: Patient[]): string[] {
  const conditionTerms = topConditions(patients, 6).map((c) => c.name);
  return [
    ...conditionTerms,
    "influenza immunization",
    "flu shot",
    "hemoglobin a1c",
    "ldl cholesterol",
    "hypertension",
    "diabetes",
    "chronic kidney disease",
  ];
}

export function buildCohortContext(
  patients: Patient[],
  label: string,
  opts?: { includeRoster?: boolean }
): string {
  const total = patients.length;
  const fluShotCount = patients.filter(hasFluShot).length;
  const noFluShotCount = total - fluShotCount;
  const highA1cCount = patients.filter((p) => {
    const a1c = latestLabValue(p, "Hemoglobin A1c");
    return a1c !== null && a1c >= 8;
  }).length;
  const highLDLCount = patients.filter((p) => {
    const ldl = latestLabValue(p, "LDL Cholesterol");
    return ldl !== null && ldl >= 130;
  }).length;
  const ckdCount = patients.filter((p) =>
    p.conditions.some((c) => c.display.toLowerCase().includes("kidney"))
  ).length;
  const dmCount = patients.filter((p) =>
    p.conditions.some((c) => c.display.toLowerCase().includes("diabetes"))
  ).length;
  const htnCount = patients.filter((p) =>
    p.conditions.some((c) => c.display.toLowerCase().includes("hypertension"))
  ).length;

  const conditions = topConditions(patients, 8)
    .map((c) => `- ${c.name}: ${c.count}`)
    .join("\n");

  const includeRoster = opts?.includeRoster ?? total <= 60;
  const roster = includeRoster
    ? patients
        .slice(0, 60)
        .map((p) => {
          const a1c = latestLabValue(p, "Hemoglobin A1c");
          const ldl = latestLabValue(p, "LDL Cholesterol");
          return `- ${p.id} | ${p.name} | Flu shot: ${hasFluShot(p) ? "Yes" : "No"} | A1c: ${a1c ?? "NA"} | LDL: ${ldl ?? "NA"}`;
        })
        .join("\n")
    : "";

  const tractableReviewNote = includeRoster
    ? "Roster detail is included below for tractable manual review."
    : "For tractable manual review, ask for aggregate counts first, then drill into a smaller cohort.";

  return `COHORT EHR CONTEXT (${label}):

Population size: ${total}
${tractableReviewNote}

Key cohort metrics:
- Flu shot documented: ${fluShotCount}/${total} (${formatPct(fluShotCount, total)})
- No flu shot documented: ${noFluShotCount}/${total} (${formatPct(noFluShotCount, total)})
- Hemoglobin A1c >= 8.0: ${highA1cCount}/${total} (${formatPct(highA1cCount, total)})
- LDL >= 130 mg/dL: ${highLDLCount}/${total} (${formatPct(highLDLCount, total)})
- Diabetes diagnosis present: ${dmCount}/${total} (${formatPct(dmCount, total)})
- Hypertension diagnosis present: ${htnCount}/${total} (${formatPct(htnCount, total)})
- CKD diagnosis present: ${ckdCount}/${total} (${formatPct(ckdCount, total)})

Top conditions in this cohort:
${conditions || "- No conditions found"}

Guidance:
- Use only this cohort data for answers.
- If asked for counts, show numerator/denominator.
- If asked to list patients, prefer IDs and keep explanations short.
${includeRoster ? `\nCohort roster (for review):\n${roster}` : ""}`;
}
