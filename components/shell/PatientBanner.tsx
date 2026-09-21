"use client";

import type { Patient } from "@/lib/types";

export function PatientBanner({ patient }: { patient: Patient }) {
  const allergy = patient.allergies[0];
  return <div className="patient-banner" aria-label="Selected patient summary">
    <div><strong>{patient.name}</strong><span>{patient.pronouns}</span></div>
    <div><label>MRN</label><strong>{patient.mrn}</strong></div>
    <div><label>DOB</label><strong>{patient.dob}</strong></div>
    <div><label>Language</label><strong>{patient.language}</strong></div>
    <div><label>Allergies</label><strong className={allergy?.severity === "Severe" ? "danger-text" : ""}>{allergy?.allergen ?? "Not reviewed"}</strong></div>
    {patient.duplicateCandidate && <div><label>Identity</label><strong className="danger-text">Possible duplicate</strong></div>}
  </div>;
}
