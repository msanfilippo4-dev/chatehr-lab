"use client";

import { ageOn, allergySummary, formatDob, initials, sexLabel } from "@/lib/patient";
import type { Patient } from "@/lib/types";

type ChipTone = "danger" | "warn" | "info" | "good" | "neutral";

function Chip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  return <span className={`chip-pill ${tone}`}>{children}</span>;
}

/** Patient banner: identity line, allergy / code-status / flag chips, and location or PCP. */
export function PatientBanner({ patient }: { patient: Patient }) {
  const allergy = allergySummary(patient);
  const flags = (patient.flags ?? []).filter((flag) => !/possible duplicate/i.test(flag));
  const identity = [
    `${ageOn(patient.dob)} y`,
    sexLabel(patient.sex),
    `DOB ${formatDob(patient.dob)}`,
    `MRN ${patient.mrn}`,
    patient.pronouns,
    patient.language,
  ].filter(Boolean).join(" · ");

  return (
    <section className="patient-banner" aria-label="Selected patient summary">
      <span className="banner-avatar" aria-hidden="true">{initials(patient.name)}</span>
      <div className="banner-identity">
        <strong className="banner-name">{patient.name}</strong>
        <span className="banner-line">{identity}</span>
      </div>
      <div className="banner-chips">
        <Chip tone={allergy.tone === "danger" ? "danger" : allergy.tone === "good" ? "good" : "neutral"}>{allergy.text}</Chip>
        {patient.codeStatus && <Chip tone="info">{patient.codeStatus}</Chip>}
        {patient.duplicateCandidate && <Chip tone="warn">Possible duplicate</Chip>}
        {flags.map((flag) => <Chip key={flag} tone="warn">{flag}</Chip>)}
      </div>
      <div className="banner-context">
        <strong>{patient.location ?? patient.insurance}</strong>
        <span>{patient.pcp ? `PCP ${patient.pcp}` : patient.location ? "" : "No PCP on file"}</span>
      </div>
    </section>
  );
}
