import type { AppointmentRules, NoteTemplate, Provider, ProviderRole, Specialty, VisitType } from "../config/types";

export const specialties: Specialty[] = [
  { id: "SPC-IM", name: "Internal medicine" },
  { id: "SPC-FM", name: "Family medicine" },
  { id: "SPC-PT", name: "Physical therapy" },
];

export const providerRoles: ProviderRole[] = [
  { id: "ROLE-ATT", name: "Attending physician", canSign: true, canCosign: true },
  { id: "ROLE-RES", name: "Resident physician", canSign: true, canCosign: false },
  { id: "ROLE-NP", name: "Nurse practitioner", canSign: true, canCosign: false },
];

const weekdays = (start: string, end: string) => [1, 2, 3, 4, 5].map((day) => ({ day, start, end }));

export const providers: Provider[] = [
  { id: "PRV-CHEN", name: "Dr. Chen", credentials: "MD", specialtyId: "SPC-IM", roleId: "ROLE-ATT", facilityId: "FAC-LC", availability: weekdays("08:00", "17:00") },
  { id: "PRV-PATEL", name: "Dr. Patel", credentials: "MD", specialtyId: "SPC-FM", roleId: "ROLE-ATT", facilityId: "FAC-LC", availability: weekdays("09:00", "18:00") },
  { id: "PRV-OKAFOR", name: "Nadia Okafor, NP", credentials: "NP", specialtyId: "SPC-IM", roleId: "ROLE-NP", facilityId: "FAC-LC", availability: weekdays("08:00", "16:00") },
];

export const visitTypes: VisitType[] = [
  { id: "VT-EST", label: "Established patient", durationMinutes: 30, resources: ["Exam room"], noteTemplateId: "TPL-SOAP" },
  { id: "VT-NEW", label: "New patient", durationMinutes: 60, resources: ["Exam room"], noteTemplateId: "TPL-SOAP" },
  { id: "VT-FU", label: "Follow-up", durationMinutes: 15, resources: ["Exam room"], noteTemplateId: "TPL-FOLLOWUP" },
  { id: "VT-URG", label: "Urgent", durationMinutes: 30, resources: ["Exam room"], noteTemplateId: "TPL-SOAP" },
  { id: "VT-TELE", label: "Telehealth", durationMinutes: 20, resources: ["Video"], noteTemplateId: "TPL-FOLLOWUP" },
];

export const noteTemplates: NoteTemplate[] = [
  { id: "TPL-SOAP", name: "Standard SOAP visit", subjective: "", objective: "", assessment: "", plan: "", copyForwardAllowed: false, guidance: "Document only what was reported or observed at this encounter." },
  { id: "TPL-FOLLOWUP", name: "Follow-up visit", subjective: "Interval history since last visit: ", objective: "Vitals reviewed: ", assessment: "", plan: "", copyForwardAllowed: true, guidance: "Copy-forward is allowed for the problem list context only. Re-verify every carried statement before signing." },
];

export const appointmentRules: AppointmentRules = {
  conflictKeys: ["provider", "date", "time"],
  minLeadMinutes: 0,
  maxDailyPerProvider: 16,
  cancellationReasons: ["Patient request", "Provider unavailable", "Weather or facility closure", "Scheduling error", "Patient no-show"],
  waitlistEnabled: true,
  noShowAfterMinutes: 15,
  reminderLeadHours: 48,
};
