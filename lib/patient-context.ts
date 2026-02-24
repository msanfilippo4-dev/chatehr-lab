import { Patient } from "./types";

export type ContextLevel = "LIMITED" | "STANDARD" | "FULL";

/**
 * Builds the patient context string sent to the AI.
 * Three levels implement the HIPAA "minimum necessary" concept.
 */
export function buildPatientContext(patient: Patient, level: ContextLevel): string {
  if (level === "LIMITED") {
    return `PATIENT CONTEXT (LIMITED — Minimum Necessary):
Age: ${patient.age} years old
Gender: ${patient.gender}
Zip code prefix: 104xx

NOTE: Limited context mode. Specific clinical details have been withheld per minimum-necessary privacy principles. This AI assistant has very limited information about this patient.`;
  }

  if (level === "STANDARD") {
    const conditions =
      patient.conditions.length > 0
        ? patient.conditions
            .map((c) => `  - ${c.display} (ICD: ${c.code}, Onset: ${c.onset})`)
            .join("\n")
        : "  - No active conditions on file";

    const labs =
      patient.labs.length > 0
        ? patient.labs
            .map(
              (l) =>
                `  - ${l.name}: ${l.value} ${l.unit} [${l.flag}] (${l.date})`
            )
            .join("\n")
        : "  - No recent labs";

    const activeMeds = patient.medications.filter((m) => m.status === "Active");
    const meds =
      activeMeds.length > 0
        ? activeMeds
            .map(
              (m) =>
                `  - ${m.name} ${m.dose} ${m.frequency} ${m.route} (started ${m.started})`
            )
            .join("\n")
        : "  - No active medications";

    const allergies =
      patient.allergies.length > 0
        ? patient.allergies
            .map((a) => `  - ${a.allergen}: ${a.reaction} [${a.severity}]`)
            .join("\n")
        : "  - NKDA (No Known Drug Allergies)";

    const immunizations =
      patient.immunizations.length > 0
        ? patient.immunizations
            .map((i) => `  - ${i.name} (CVX: ${i.cvx}, ${i.date})`)
            .join("\n")
        : "  - No immunization history";

    return `PATIENT EHR CONTEXT (STANDARD):

Demographics:
  Name: ${patient.name}
  ID: ${patient.id}
  Age: ${patient.age} years old
  Gender: ${patient.gender}
  Date of Birth: ${patient.dob}
  Last Visit: ${patient.lastVisit}

Active Problem List:
${conditions}

Recent Laboratory Results:
${labs}

Active Medications:
${meds}

Allergies & Adverse Reactions:
${allergies}

Immunization History:
${immunizations}`;
  }

  // FULL — structured data + visit notes
  const standardContext = buildPatientContext(patient, "STANDARD");

  const visitNotes =
    patient.visits.length > 0
      ? patient.visits
          .slice(0, 5)
          .map(
            (v, i) => `
--- Visit ${i + 1}: ${v.date} (${v.type}) ---
Provider: ${v.provider}
Chief Complaint: ${v.chiefComplaint}
Vitals: BP ${v.vitals.bp} | HR ${v.vitals.hr} bpm | RR ${v.vitals.rr} | SpO2 ${v.vitals.spo2}% | Temp ${v.vitals.temp} | Wt ${v.vitals.weight}
Assessment: ${v.assessment}
Plan:
${v.plan}
Clinical Notes:
${v.notes}`
          )
          .join("\n")
      : "  No visit notes available";

  return `${standardContext}

VISIT HISTORY & CLINICAL NOTES (FULL context):
${visitNotes}`;
}
