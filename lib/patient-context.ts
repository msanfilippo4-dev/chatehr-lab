import type { Patient, ContextLevel, SectionToggles } from "./types";

// ---------------------------------------------------------------------------
// Context options
// ---------------------------------------------------------------------------

export interface ContextOptions {
  level: ContextLevel;
  sectionToggles?: SectionToggles;
  /** How many recent visits to include in FULL context (default 5). */
  noteWindow?: number;
}

// ---------------------------------------------------------------------------
// Default toggles (everything on)
// ---------------------------------------------------------------------------

const ALL_ON: SectionToggles = {
  demographics: true,
  conditions: true,
  medications: true,
  allergies: true,
  labs: true,
  vitals: true,
  immunizations: true,
  visits: true,
  imaging: true,
  socialHistory: true,
  clinicalNotes: true,
};

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Builds a patient context string for injection into the system/user prompt.
 *
 * Three levels implement the HIPAA "minimum necessary" concept:
 *   - LIMITED:  age + gender + zip prefix only
 *   - STANDARD: demographics + conditions + labs + meds + allergies + immunizations
 *               (respects sectionToggles -- if labs=false, omit labs section)
 *   - FULL:     everything in STANDARD + visit notes (bounded by noteWindow)
 *               + imaging + SDOH + clinical notes (also respects sectionToggles)
 */
export function buildPatientContext(
  patient: Patient,
  options: ContextOptions
): string {
  const { level, noteWindow = 5 } = options;
  const t = options.sectionToggles ?? ALL_ON;

  // ── LIMITED ──────────────────────────────────────────────────────────
  if (level === "LIMITED") {
    const zipPrefix = patient.addressZip
      ? patient.addressZip.substring(0, 3) + "xx"
      : "N/A";
    return `PATIENT CONTEXT (LIMITED — Minimum Necessary):
Age: ${patient.age} years old
Gender: ${patient.gender}
Zip code prefix: ${zipPrefix}

NOTE: Limited context mode. Specific clinical details have been withheld per minimum-necessary privacy principles. This AI assistant has very limited information about this patient.`;
  }

  // ── STANDARD & FULL: build sections ─────────────────────────────────
  const sections: string[] = [];

  // Demographics (always included in STANDARD/FULL unless toggled off)
  if (t.demographics) {
    sections.push(`Demographics:
  Name: ${patient.name}
  ID: ${patient.id}
  Age: ${patient.age} years old
  Gender: ${patient.gender}
  Date of Birth: ${patient.dob}
  Race: ${patient.race || "Not specified"}
  Ethnicity: ${patient.ethnicity || "Not specified"}
  Language: ${patient.language || "Not specified"}
  Marital Status: ${patient.maritalStatus || "Not specified"}
  Insurance: ${patient.insuranceType || "Not specified"}
  Zip: ${patient.addressZip || "N/A"}
  Last Visit: ${patient.lastVisit}`);
  }

  // Active Problem List
  if (t.conditions) {
    const conditions =
      patient.conditions.length > 0
        ? patient.conditions
            .map((c) => `  - ${c.display} (ICD: ${c.code}, Onset: ${c.onset})`)
            .join("\n")
        : "  - No active conditions on file";
    sections.push(`Active Problem List:\n${conditions}`);
  }

  // Labs
  if (t.labs) {
    const labs =
      patient.labs.length > 0
        ? patient.labs
            .map(
              (l) =>
                `  - ${l.name}: ${l.value} ${l.unit} [${l.flag}] (${l.date})`
            )
            .join("\n")
        : "  - No recent labs";
    sections.push(`Recent Laboratory Results:\n${labs}`);
  }

  // Medications
  if (t.medications) {
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
    sections.push(`Active Medications:\n${meds}`);
  }

  // Allergies
  if (t.allergies) {
    const allergies =
      patient.allergies.length > 0
        ? patient.allergies
            .map((a) => `  - ${a.allergen}: ${a.reaction} [${a.severity}]`)
            .join("\n")
        : "  - NKDA (No Known Drug Allergies)";
    sections.push(`Allergies & Adverse Reactions:\n${allergies}`);
  }

  // Immunizations
  if (t.immunizations) {
    const immunizations =
      patient.immunizations.length > 0
        ? patient.immunizations
            .map((i) => `  - ${i.name} (CVX: ${i.cvx}, ${i.date})`)
            .join("\n")
        : "  - No immunization history";
    sections.push(`Immunization History:\n${immunizations}`);
  }

  // ── STANDARD stops here ─────────────────────────────────────────────
  if (level === "STANDARD") {
    return `PATIENT EHR CONTEXT (STANDARD):\n\n${sections.join("\n\n")}`;
  }

  // ── FULL: add visit notes, imaging, SDOH, clinical notes ────────────

  // Visit history & vitals
  if (t.visits) {
    const sortedVisits = [...patient.visits].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const windowedVisits = sortedVisits.slice(0, noteWindow);

    if (windowedVisits.length > 0) {
      const visitNotes = windowedVisits
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
        .join("\n");
      sections.push(
        `Visit History & Clinical Notes (last ${noteWindow}):\n${visitNotes}`
      );
    } else {
      sections.push("Visit History:\n  No visit notes available");
    }
  }

  // Imaging
  if (t.imaging && patient.imagingReports && patient.imagingReports.length > 0) {
    const imagingLines = patient.imagingReports
      .map(
        (img) =>
          `  - ${img.date}: ${img.modality} (${img.bodyPart})\n    Findings: ${img.findings}\n    Impression: ${img.impression}\n    Ordering: ${img.orderingProvider}`
      )
      .join("\n");
    sections.push(`Imaging Reports:\n${imagingLines}`);
  } else if (t.imaging) {
    sections.push("Imaging Reports:\n  - No imaging reports on file");
  }

  // Social History / SDOH
  if (t.socialHistory && patient.socialHistory) {
    const sh = patient.socialHistory;
    sections.push(`Social Determinants of Health (SDOH):
  Smoking Status: ${sh.smokingStatus}
  Alcohol Use: ${sh.alcoholUse}
  Exercise Frequency: ${sh.exerciseFrequency}
  Occupation: ${sh.occupation}
  Living Situation: ${sh.livingSituation}`);
  } else if (t.socialHistory) {
    sections.push(
      "Social Determinants of Health (SDOH):\n  - No social history on file"
    );
  }

  // Clinical Notes
  if (
    t.clinicalNotes &&
    patient.clinicalNotes &&
    patient.clinicalNotes.length > 0
  ) {
    const noteLines = patient.clinicalNotes
      .slice(0, noteWindow)
      .map(
        (n) =>
          `  - ${n.date} [${n.noteType}] by ${n.author}:\n    ${n.content}`
      )
      .join("\n");
    sections.push(`Clinical Notes (last ${noteWindow}):\n${noteLines}`);
  } else if (t.clinicalNotes) {
    sections.push("Clinical Notes:\n  - No additional clinical notes on file");
  }

  return `PATIENT EHR CONTEXT (FULL):\n\n${sections.join("\n\n")}`;
}
