import type { Appointment, EHRState, ExchangeItem, IdentityReview, ImplementationCheckpoint, Patient, PortalMessage, Task } from "./types";
import type { CourseConfig } from "./config/types";
import { defaultCourseConfig } from "./config/defaults";

/** The simulated "today" used by seed data and demonstrations. */
export const SIMULATION_DATE = "2026-09-21";

const names = [
  ["Liu Huang", "1984-03-19", "Mandarin", "she/her"],
  ["Marcus Reed", "1968-11-02", "English", "he/him"],
  ["Elena Garcia", "1976-07-14", "Spanish", "she/her"],
  ["Amina Yusuf", "1992-01-25", "Somali", "she/her"],
  ["James O'Brien", "1959-05-08", "English", "he/him"],
  ["Priya Shah", "1988-10-30", "Gujarati", "she/her"],
  ["Devon Brooks", "2001-06-16", "English", "they/them"],
  ["Sofia Petrov", "1947-12-09", "Russian", "she/her"],
  ["Mateo Rivera", "2012-04-04", "Spanish", "he/him"],
  ["Grace Kim", "1970-09-21", "Korean", "she/her"],
  ["Noah Williams", "1981-02-12", "English", "he/him"],
  ["Liu H.", "1984-03-19", "Mandarin", "she/her"],
] as const;

const insurerIds = ["INS-MCD", "INS-MCR", "INS-CPPO"] as const;
const insuranceLabels = ["Medicaid", "Medicare", "Commercial PPO"] as const;

export const patients: Patient[] = names.map((n, i) => ({
  id: `PT-${String(i + 1).padStart(3, "0")}`,
  mrn: `6105${String(100 + i)}`,
  name: n[0],
  dob: n[1],
  sex: i % 3 === 1 ? "Male" : "Female",
  pronouns: n[3],
  language: n[2],
  address: i === 11 ? "120 Example Ave Apt 4B, New York, NY 10000" : `${120 + i * 7} Example Avenue, New York, NY 100${String(i % 10).padStart(2, "0")}`,
  phone: i === 11 ? "(917) 555-4812" : `(212) 555-${String(1100 + i)}`,
  insurance: insuranceLabels[i % 3],
  insurerId: insurerIds[i % 3],
  memberId: `${["MCD", "MCR", "CPPO"][i % 3]}-${String(48210 + i * 37)}`,
  problems: [
    { code: i === 0 ? "M75.51" : i % 2 ? "I10" : "E11.9", display: i === 0 ? "Bursitis of right shoulder" : i % 2 ? "Essential hypertension" : "Type 2 diabetes mellitus without complications", onset: `202${i % 5}-02-14` },
    ...(i % 4 === 0 ? [{ code: "J45.20", display: "Mild intermittent asthma", onset: "2021-05-12" }] : []),
  ],
  medications: [
    { name: i % 2 ? "Lisinopril 10 mg tablet" : "Metformin 500 mg tablet", sig: i % 2 ? "Take one tablet daily" : "Take one tablet twice daily with meals", status: "Active" },
    ...(i % 4 === 0 ? [{ name: "Albuterol HFA inhaler", sig: "Two puffs every 4 to 6 hours as needed", status: "Active" }] : []),
  ],
  allergies: [{ allergen: i % 3 === 0 ? "Penicillin" : "No known drug allergies", reaction: i % 3 === 0 ? "Hives" : "", severity: i % 3 === 0 ? "Severe" : "None" }],
  vitals: [
    { date: "2026-09-14", bp: i % 2 ? "148/92" : "132/78", hr: 68 + i, weight: `${145 + i * 6} lb` },
    { date: "2026-06-02", bp: i % 2 ? "142/88" : "128/76", hr: 66 + i, weight: `${143 + i * 6} lb` },
  ],
  results: [
    { date: "2026-09-14", name: i % 2 ? "Potassium" : "Hemoglobin A1c", value: i % 2 ? "5.7 mmol/L" : `${(7.2 + (i % 3) * 0.6).toFixed(1)}%`, flag: i % 2 ? "High" : i % 3 ? "High" : "", status: "Final" },
    { date: "2026-06-02", name: "Creatinine", value: "0.9 mg/dL", flag: "", status: "Final" },
    // Patient 8 has an A1c ordered but never resulted: a missingness example for Query Studio.
    ...(i === 7 ? [{ date: "2026-09-10", name: "Hemoglobin A1c", value: "", flag: "", status: "Pending" }] : []),
  ],
  notes: [],
  duplicateCandidate: i === 0 ? "PT-012" : i === 11 ? "PT-001" : undefined,
  proxyAccess: i === 5 ? [{ name: "Anjali Shah", relationship: "Daughter", scope: "Scheduling and messages" }] : i === 8 ? [{ name: "Carmen Rivera", relationship: "Parent", scope: "Full portal access (minor)" }] : undefined,
}));

export const appointments: Appointment[] = [
  { id: "APT-001", patientId: "PT-001", date: SIMULATION_DATE, time: "09:00", duration: 30, provider: "Dr. Chen", providerId: "PRV-CHEN", visitType: "Established patient", visitTypeId: "VT-EST", status: "Scheduled" },
  { id: "APT-002", patientId: "PT-002", date: SIMULATION_DATE, time: "09:30", duration: 30, provider: "Dr. Chen", providerId: "PRV-CHEN", visitType: "Follow-up", visitTypeId: "VT-FU", status: "Scheduled" },
  { id: "APT-003", patientId: "PT-003", date: SIMULATION_DATE, time: "10:00", duration: 60, provider: "Dr. Patel", providerId: "PRV-PATEL", visitType: "New patient", visitTypeId: "VT-NEW", status: "Checked in" },
  { id: "APT-004", patientId: "PT-004", date: SIMULATION_DATE, time: "11:00", duration: 30, provider: "Dr. Patel", providerId: "PRV-PATEL", visitType: "Urgent", visitTypeId: "VT-URG", status: "Scheduled" },
  { id: "APT-005", patientId: "PT-005", date: "2026-09-18", time: "14:00", duration: 30, provider: "Dr. Chen", providerId: "PRV-CHEN", visitType: "Established patient", visitTypeId: "VT-EST", status: "No-show" },
];

export const tasks: Task[] = [
  { id: "TASK-001", patientId: "PT-002", title: "Call patient about high potassium and repeat test", due: "2026-09-22", complete: false, owner: "Clinical team" },
  { id: "TASK-002", patientId: "PT-001", title: "Confirm physical therapy referral", due: "2026-09-25", complete: false, owner: "Front desk" },
];

export const messages: PortalMessage[] = [
  { id: "MSG-001", patientId: "PT-003", from: "Elena Garcia", subject: "Home blood pressure readings", body: "My readings this week were 148/90, 145/88, and 150/92. Should I change my medicine?", date: "2026-09-20", status: "New" },
  { id: "MSG-002", patientId: "PT-006", from: "Priya Shah", subject: "Reschedule appointment", body: "I need an evening appointment and an interpreter for my mother who will join me.", date: "2026-09-19", status: "New" },
  { id: "MSG-003", patientId: "PT-009", from: "Carmen Rivera (proxy)", subject: "Vaccine record looks incorrect", body: "The portal shows a vaccine dated 2024 that Mateo never received. Can this be checked?", date: "2026-09-18", status: "New", proxy: true },
];

export const exchanges: ExchangeItem[] = [
  { id: "XCH-001", patientId: "PT-001", sourceOrganization: "Hudson Urgent Care", sourcePatientId: "HUC-44821", resourceType: "AllergyIntolerance", fhirResourceLabel: "AllergyIntolerance/HUC-44821-a1", provenance: { sourceSystem: "Hudson Urgent Care EHR", receivedVia: "HIE query (simulated FHIR R4 bundle)" }, receivedAt: "2026-09-20T14:20:00-04:00", sourceTimestamp: "2026-09-18T16:02:00-04:00", localValue: "Penicillin — hives — severe", incomingValue: "Penicillin — rash — severity not recorded", matchScore: 0.98, discrepancy: "Reaction and severity differ", status: "Pending review" },
  { id: "XCH-002", patientId: "PT-001", sourceOrganization: "Hudson Urgent Care", sourcePatientId: "HUC-44821", resourceType: "MedicationRequest", fhirResourceLabel: "MedicationRequest/HUC-44821-m7", provenance: { sourceSystem: "Hudson Urgent Care EHR", receivedVia: "HIE query (simulated FHIR R4 bundle)" }, receivedAt: "2026-09-20T14:20:00-04:00", sourceTimestamp: "2026-09-18T16:10:00-04:00", localValue: "No naproxen on active list", incomingValue: "Naproxen 500 mg twice daily for 5 days", matchScore: 0.98, discrepancy: "New short-course medication", status: "Pending review" },
  { id: "XCH-003", patientId: "PT-003", sourceOrganization: "Northside Cardiology", sourcePatientId: "NC-77210", resourceType: "Observation", fhirResourceLabel: "Observation/NC-77210-bp2", provenance: { sourceSystem: "Northside Cardiology EHR", receivedVia: "Direct message (simulated C-CDA)" }, receivedAt: "2026-09-19T10:05:00-04:00", sourceTimestamp: "2026-09-17T09:45:00-04:00", localValue: "Latest BP 132/78", incomingValue: "Office BP 168/96; repeat 162/92", matchScore: 0.94, discrepancy: "New elevated measurement", status: "Pending review" },
  { id: "XCH-004", patientId: "PT-006", sourceOrganization: "Metro Diagnostics", sourcePatientId: "MD-11028", resourceType: "DiagnosticReport", fhirResourceLabel: "DiagnosticReport/MD-11028-r1", provenance: { sourceSystem: "Metro Diagnostics RIS", receivedVia: "HIE push notification (simulated)" }, receivedAt: "2026-09-18T08:30:00-04:00", sourceTimestamp: "2026-09-18T07:55:00-04:00", localValue: "No recent imaging report", incomingValue: "Screening mammogram: BI-RADS 1, negative", matchScore: 0.99, discrepancy: "New final report", status: "Pending review" },
  { id: "XCH-005", patientId: "PT-010", sourceOrganization: "Riverside Family Practice", sourcePatientId: "RFP-3021", resourceType: "Condition", fhirResourceLabel: "Condition/RFP-3021-c4", provenance: { sourceSystem: "Riverside Family Practice EHR", receivedVia: "HIE query (simulated FHIR R4 bundle)" }, receivedAt: "2026-09-17T11:40:00-04:00", sourceTimestamp: "2024-02-02T10:00:00-05:00", localValue: "Type 2 diabetes mellitus without complications", incomingValue: "Prediabetes (R73.03)", matchScore: 0.71, discrepancy: "Older, less specific diagnosis; identity confidence is low", status: "Pending review" },
];

export const identityReviews: IdentityReview[] = [{
  id: "MPI-001",
  patientIds: ["PT-001", "PT-012"],
  signals: [
    { label: "Legal name", first: "Liu Huang", second: "Liu H.", strength: "Unverified" },
    { label: "Date of birth", first: "1984-03-19", second: "1984-03-19", strength: "Match" },
    { label: "Address", first: "120 Example Avenue, New York, NY 10000", second: "120 Example Ave Apt 4B, New York, NY 10000", strength: "Unverified" },
    { label: "Phone", first: "(212) 555-1100", second: "(917) 555-4812", strength: "Difference" },
    { label: "Preferred language", first: "Mandarin", second: "Mandarin", strength: "Match" },
    { label: "MRN", first: "6105100", second: "6105111", strength: "Difference" },
  ],
  status: "Open",
}];

export const implementation: ImplementationCheckpoint[] = [
  { id: "IMP-01", domain: "Governance", requirement: "Executive sponsor and clinical decision rights documented", owner: "Steering committee", evidence: "Charter approved; escalation path incomplete", risk: "Moderate", status: "In progress" },
  { id: "IMP-02", domain: "Workflow", requirement: "Current and future medication-administration workflows validated", owner: "Nursing informatics", evidence: "Two units observed; emergency workflow outstanding", risk: "High", status: "Blocked" },
  { id: "IMP-03", domain: "Migration", requirement: "Patient, allergy, medication, and problem data quality thresholds met", owner: "HIM + data team", evidence: "Mock conversion 2 shows 98.7% required-field completeness", risk: "Moderate", status: "In progress" },
  { id: "IMP-04", domain: "Interfaces", requirement: "Laboratory, pharmacy, ADT, and device interfaces tested end to end", owner: "Integration lead", evidence: "ADT and laboratory passed; pharmacy retest scheduled", risk: "High", status: "In progress" },
  { id: "IMP-05", domain: "Training", requirement: "Role-based curriculum and competency checks complete", owner: "Training lead", evidence: "Super-user cohort complete; staff completion 71%", risk: "Moderate", status: "In progress" },
  { id: "IMP-06", domain: "Downtime", requirement: "Planned and unplanned downtime procedures exercised", owner: "Operations", evidence: "Tabletop complete; recovery drill scheduled", risk: "High", status: "Not started" },
  { id: "IMP-07", domain: "Go-live", requirement: "Command center, issue triage, and staffing plan approved", owner: "Program manager", evidence: "Draft coverage grid and severity definitions", risk: "Moderate", status: "In progress" },
  { id: "IMP-08", domain: "Measurement", requirement: "Baseline safety, burden, adoption, and outcome measures captured", owner: "Analytics lead", evidence: "Baseline dashboard signed off", risk: "Low", status: "Ready" },
];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function buildInitialState(config: CourseConfig = defaultCourseConfig, owner = ""): EHRState {
  return {
    version: 3,
    meta: { owner, createdAt: new Date().toISOString(), configVersion: config.meta.version },
    appointments: clone(appointments),
    patients: clone(patients),
    orders: [],
    tasks: clone(tasks),
    messages: clone(messages),
    audit: [],
    exchanges: clone(exchanges),
    identityReviews: clone(identityReviews),
    queryRuns: [],
    savedQueries: [],
    implementation: clone(implementation),
    registrations: [],
    eligibilityChecks: [],
    referrals: [],
    waitlist: [],
    aiReviews: [],
  };
}

/** Kept for compatibility with earlier imports; prefer buildInitialState(). */
export const initialState: EHRState = buildInitialState();
