import type { Appointment, EHRState, ExchangeItem, IdentityReview, ImplementationCheckpoint, Patient, PortalMessage, Task } from "./types";

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
  insurance: i % 3 === 0 ? "Medicaid" : i % 3 === 1 ? "Medicare" : "Commercial PPO",
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
    { date: "2026-09-14", name: i % 2 ? "Potassium" : "Hemoglobin A1c", value: i % 2 ? "5.7 mmol/L" : `${7.2 + (i % 3) * 0.6}%`, flag: i % 2 ? "High" : i % 3 ? "High" : "", status: "Final" },
    { date: "2026-06-02", name: "Creatinine", value: "0.9 mg/dL", flag: "", status: "Final" },
  ],
  notes: [],
  duplicateCandidate: i === 0 ? "PT-012" : i === 11 ? "PT-001" : undefined,
}));

export const appointments: Appointment[] = [
  { id: "APT-001", patientId: "PT-001", date: "2026-09-21", time: "09:00", duration: 30, provider: "Dr. Chen", visitType: "Established patient", status: "Scheduled" },
  { id: "APT-002", patientId: "PT-002", date: "2026-09-21", time: "09:30", duration: 30, provider: "Dr. Chen", visitType: "Follow-up", status: "Scheduled" },
  { id: "APT-003", patientId: "PT-003", date: "2026-09-21", time: "10:00", duration: 60, provider: "Dr. Patel", visitType: "New patient", status: "Checked in" },
  { id: "APT-004", patientId: "PT-004", date: "2026-09-21", time: "11:00", duration: 30, provider: "Dr. Patel", visitType: "Urgent", status: "Scheduled" },
];

export const tasks: Task[] = [
  { id: "TASK-001", patientId: "PT-002", title: "Call patient about high potassium and repeat test", due: "2026-09-22", complete: false },
  { id: "TASK-002", patientId: "PT-001", title: "Confirm physical therapy referral", due: "2026-09-25", complete: false },
];

export const messages: PortalMessage[] = [
  { id: "MSG-001", patientId: "PT-003", from: "Elena Garcia", subject: "Home blood pressure readings", body: "My readings this week were 148/90, 145/88, and 150/92. Should I change my medicine?", date: "2026-09-20", status: "New" },
  { id: "MSG-002", patientId: "PT-006", from: "Priya Shah", subject: "Reschedule appointment", body: "I need an evening appointment and an interpreter for my mother who will join me.", date: "2026-09-19", status: "New" },
];

export const exchanges: ExchangeItem[] = [
  { id: "XCH-001", patientId: "PT-001", sourceOrganization: "Hudson Urgent Care", sourcePatientId: "HUC-44821", resourceType: "AllergyIntolerance", receivedAt: "2026-09-20T14:20:00-04:00", sourceTimestamp: "2026-09-18T16:02:00-04:00", localValue: "Penicillin — hives — severe", incomingValue: "Penicillin — rash — severity not recorded", matchScore: 0.98, discrepancy: "Reaction and severity differ", status: "Pending review" },
  { id: "XCH-002", patientId: "PT-001", sourceOrganization: "Hudson Urgent Care", sourcePatientId: "HUC-44821", resourceType: "MedicationRequest", receivedAt: "2026-09-20T14:20:00-04:00", sourceTimestamp: "2026-09-18T16:10:00-04:00", localValue: "No naproxen on active list", incomingValue: "Naproxen 500 mg twice daily for 5 days", matchScore: 0.98, discrepancy: "New short-course medication", status: "Pending review" },
  { id: "XCH-003", patientId: "PT-003", sourceOrganization: "Northside Cardiology", sourcePatientId: "NC-77210", resourceType: "Observation", receivedAt: "2026-09-19T10:05:00-04:00", sourceTimestamp: "2026-09-17T09:45:00-04:00", localValue: "Latest BP 132/78", incomingValue: "Office BP 168/96; repeat 162/92", matchScore: 0.94, discrepancy: "New elevated measurement", status: "Pending review" },
  { id: "XCH-004", patientId: "PT-006", sourceOrganization: "Metro Diagnostics", sourcePatientId: "MD-11028", resourceType: "DiagnosticReport", receivedAt: "2026-09-18T08:30:00-04:00", sourceTimestamp: "2026-09-18T07:55:00-04:00", localValue: "No recent imaging report", incomingValue: "Screening mammogram: BI-RADS 1, negative", matchScore: 0.99, discrepancy: "New final report", status: "Pending review" },
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

export const initialState: EHRState = {
  version: 2,
  appointments,
  patients,
  orders: [],
  tasks,
  messages,
  audit: [],
  exercises: [
    { id: "ehr-v3-week-01", title: "Chart orientation and evidence", summary: "Trace a synthetic patient's longitudinal record and locate evidence across chart sections.", durationMinutes: 30, teamSize: "Pairs", objectives: ["Use identifiers before interpreting the chart", "Find a problem, medication, result, and note", "Explain how structured data supports reuse"], requiredAuditActions: ["Open chart"], completedActions: [], startedAt: "2026-09-21T18:00:00-04:00" },
    { id: "ehr-v3-week-02", title: "Master patient index adjudication", summary: "Compare conflicting identifiers and record a defensible identity decision without merging records directly.", durationMinutes: 30, teamSize: "3–4 learners", objectives: ["Distinguish strong and weak match signals", "Document uncertainty", "Protect both safety and privacy"], requiredAuditActions: ["Resolve identity review"], completedActions: [], startedAt: "2026-09-28T18:00:00-04:00" },
    { id: "ehr-v3-week-03", title: "Scheduling and access", summary: "Create and reschedule visits, resolve a provider conflict, and connect transactions to access measures.", durationMinutes: 30, teamSize: "Pairs", objectives: ["Create a valid appointment", "Preserve appointment history during rescheduling", "Interpret third-next-available access"], requiredAuditActions: ["Create appointment", "Reschedule appointment"], completedActions: [], startedAt: "2026-10-05T18:00:00-04:00" },
    { id: "ehr-v3-week-04", title: "Orders, warnings, and follow-up", summary: "Respond to an allergy alert, submit a simulated laboratory order, and close the result loop.", durationMinutes: 30, teamSize: "Pairs", objectives: ["Interpret warning context", "Avoid unsafe overrides", "Assign follow-up responsibility"], requiredAuditActions: ["Place simulated order", "Review result and create follow-up"], completedActions: [], startedAt: "2026-10-12T18:00:00-04:00" },
    { id: "ehr-v3-week-05", title: "SOAP note integrity", summary: "Create a supported SOAP note, sign it, and amend it while preserving the signed history.", durationMinutes: 30, teamSize: "Pairs", objectives: ["Separate reported and observed evidence", "Sign a supported note", "Amend without overwriting history"], requiredAuditActions: ["Signed SOAP note", "Amend signed note"], completedActions: [], startedAt: "2026-10-19T18:00:00-04:00" },
    { id: "ehr-v3-week-06", title: "Portal message triage", summary: "Route a patient message with attention to urgency, ownership, language, and accessibility.", durationMinutes: 30, teamSize: "3–4 learners", objectives: ["Identify a clinical escalation", "Assign an accountable team", "Use patient-centered language"], requiredAuditActions: ["Route portal message"], completedActions: [], startedAt: "2026-10-26T18:00:00-04:00" },
    { id: "ehr-v3-week-07", title: "Privacy and downtime tabletop", summary: "Use audit evidence and an implementation checkpoint to respond to a downtime risk.", durationMinutes: 30, teamSize: "3–4 learners", objectives: ["Identify minimum necessary access", "Preserve continuity during downtime", "Document a readiness decision"], requiredAuditActions: ["Update implementation readiness"], completedActions: [], startedAt: "2026-11-02T18:00:00-05:00" },
    { id: "ehr-v3-week-08", title: "AI draft safety review", summary: "Compare a scripted AI draft with chart evidence and document a human review decision.", durationMinutes: 30, teamSize: "Pairs", objectives: ["Detect unsupported content", "Identify safety-relevant omissions", "Record accountable human review"], requiredAuditActions: ["AI draft review"], completedActions: [], startedAt: "2026-11-09T18:00:00-05:00" },
    { id: "ehr-v3-week-09", title: "HIE reconciliation and population query", summary: "Reconcile an external clinical item, then define and run a reproducible cohort query.", durationMinutes: 30, teamSize: "3–4 learners", objectives: ["Use provenance and match confidence", "Resolve a discrepancy", "Validate a computable denominator"], requiredAuditActions: ["Reconcile external item", "Run population query"], completedActions: [], startedAt: "2026-11-16T18:00:00-05:00" },
    { id: "ehr-v3-week-10", title: "Implementation readiness decision", summary: "Review evidence across eight implementation domains and update a risk-based readiness decision.", durationMinutes: 30, teamSize: "3–4 learners", objectives: ["Connect evidence to readiness", "Assign ownership", "Identify a go-live blocker"], requiredAuditActions: ["Update implementation readiness"], completedActions: [], startedAt: "2026-11-23T18:00:00-05:00" },
  ],
  exchanges,
  identityReviews,
  queryRuns: [],
  implementation,
};

export const codeExamples = [
  { system: "ICD-10-CM FY2027", code: "M75.51", display: "Bursitis of right shoulder", use: "Diagnosis / condition" },
  { system: "ICD-10-CM FY2027", code: "I10", display: "Essential hypertension", use: "Diagnosis / condition" },
  { system: "ICD-10-CM FY2027", code: "E11.9", display: "Type 2 diabetes mellitus without complications", use: "Diagnosis / condition" },
  { system: "ICD-10-CM FY2027", code: "Z79.84", display: "Long term use of oral hypoglycemic drugs", use: "Status / context" },
  { system: "CPT example", code: "99213", display: "Established patient office or other outpatient service", use: "Procedure / service" },
  { system: "CPT example", code: "83036", display: "Hemoglobin A1c", use: "Laboratory procedure" },
  { system: "CPT example", code: "36415", display: "Collection of venous blood by venipuncture", use: "Procedure / service" },
];
