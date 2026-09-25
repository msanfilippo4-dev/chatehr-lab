import type { Appointment, EHRState, ExchangeItem, IdentityReview, ImplementationCheckpoint, Patient, PortalMessage, Task } from "./types";
import type { CourseConfig } from "./config/types";
import { defaultCourseConfig } from "./config/defaults";
import { claims } from "./seeds/billing";
import { inBasketItems, v4Messages } from "./seeds/inbasket";
import { flowsheets, marAdministrations, marOrders } from "./seeds/inpatient";
import { seedPatients } from "./seeds/patients";
import { tickets } from "./seeds/tickets";

/** The simulated "today" used by seed data and demonstrations. */
export const SIMULATION_DATE = "2026-09-21";

/** Hand-authored charts live in lib/seeds/patients.ts. */
export const patients: Patient[] = seedPatients;

export const appointments: Appointment[] = [
  { id: "APT-001", patientId: "PT-001", date: SIMULATION_DATE, time: "09:00", duration: 30, provider: "Dr. Chen", providerId: "PRV-CHEN", visitType: "Established patient", visitTypeId: "VT-EST", status: "Scheduled" },
  { id: "APT-002", patientId: "PT-002", date: SIMULATION_DATE, time: "09:30", duration: 30, provider: "Dr. Chen", providerId: "PRV-CHEN", visitType: "Follow-up", visitTypeId: "VT-FU", status: "Scheduled" },
  { id: "APT-003", patientId: "PT-003", date: SIMULATION_DATE, time: "10:00", duration: 60, provider: "Dr. Patel", providerId: "PRV-PATEL", visitType: "New patient", visitTypeId: "VT-NEW", status: "Checked in" },
  { id: "APT-004", patientId: "PT-004", date: SIMULATION_DATE, time: "11:00", duration: 30, provider: "Dr. Patel", providerId: "PRV-PATEL", visitType: "Urgent", visitTypeId: "VT-URG", status: "Scheduled" },
  { id: "APT-005", patientId: "PT-005", date: "2026-09-18", time: "14:00", duration: 30, provider: "Dr. Chen", providerId: "PRV-CHEN", visitType: "Established patient", visitTypeId: "VT-EST", status: "No-show" },
  // v4 additions: the rest of today's clinic.
  { id: "APT-006", patientId: "PT-010", date: SIMULATION_DATE, time: "13:00", duration: 20, provider: "Dr. Chen", providerId: "PRV-CHEN", visitType: "Telehealth", visitTypeId: "VT-TELE", status: "Scheduled" },
  { id: "APT-007", patientId: "PT-007", date: SIMULATION_DATE, time: "14:00", duration: 30, provider: "Sam Brooks, NP", providerId: "PRV-BROOKS", visitType: "Established patient", visitTypeId: "VT-EST", status: "Scheduled" },
  { id: "APT-008", patientId: "PT-011", date: SIMULATION_DATE, time: "15:30", duration: 15, provider: "Dr. Patel", providerId: "PRV-PATEL", visitType: "Follow-up", visitTypeId: "VT-FU", status: "Scheduled" },
];

export const tasks: Task[] = [
  { id: "TASK-001", patientId: "PT-002", title: "Call patient about high potassium and repeat test", due: "2026-09-22", complete: false, owner: "Clinical team" },
  { id: "TASK-002", patientId: "PT-001", title: "Confirm physical therapy referral", due: "2026-09-25", complete: false, owner: "Front desk" },
  { id: "TASK-003", patientId: "PT-005", title: "Pharmacy medication reconciliation (admission)", due: "2026-09-21", complete: false, owner: "Pharmacy" },
  { id: "TASK-004", patientId: "PT-008", title: "Repeat lactate if febrile or hypotensive", due: "2026-09-21", complete: false, owner: "4 West nursing" },
];

export const messages: PortalMessage[] = [
  { id: "MSG-001", patientId: "PT-003", from: "Elena Garcia", subject: "Home blood pressure readings", body: "My readings this week were 148/90, 145/88, and 150/92. Should I change my medicine?", date: "2026-09-20", status: "New" },
  { id: "MSG-002", patientId: "PT-006", from: "Priya Shah", subject: "Reschedule appointment", body: "I need an evening appointment and an interpreter for my mother who will join me.", date: "2026-09-19", status: "New" },
  { id: "MSG-003", patientId: "PT-009", from: "Carmen Rivera (proxy)", subject: "Vaccine record looks incorrect", body: "The portal shows a vaccine dated 2024 that Mateo never received. Can this be checked?", date: "2026-09-18", status: "New", proxy: true },
  ...v4Messages,
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
    version: 4,
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
    ...buildV4Slices(),
  };
}

/** The slices added in workspace version 4 (also used to upgrade v3 workspaces). */
export function buildV4Slices(): Pick<EHRState, "marOrders" | "marAdministrations" | "marScans" | "flowsheets" | "inBasket" | "claims" | "tickets"> {
  return {
    marOrders: clone(marOrders),
    marAdministrations: clone(marAdministrations),
    marScans: [],
    flowsheets: clone(flowsheets),
    inBasket: clone(inBasketItems),
    claims: clone(claims),
    tickets: clone(tickets),
  };
}

/** Kept for compatibility with earlier imports; prefer buildInitialState(). */
export const initialState: EHRState = buildInitialState();
