export type Role = "Front Desk" | "Clinical" | "HIM" | "Patient" | "Analyst" | "Implementation Lead";
export type AppointmentStatus = "Scheduled" | "Checked in" | "Canceled";
export type OrderStatus = "Draft" | "Submitted" | "Final" | "Reviewed";

export interface Appointment {
  id: string;
  patientId: string;
  date: string;
  time: string;
  duration: number;
  provider: string;
  visitType: string;
  status: AppointmentStatus;
}

export interface NoteVersion {
  id: string;
  author: string;
  recordedAt: string;
  kind: "Draft" | "Signed" | "Amendment";
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  amendmentReason?: string;
}

export interface Order {
  id: string;
  patientId: string;
  type: "Medication" | "Laboratory";
  name: string;
  details: string;
  status: OrderStatus;
  orderedAt: string;
  result?: string;
}

export interface Task {
  id: string;
  patientId: string;
  title: string;
  due: string;
  complete: boolean;
}

export interface PortalMessage {
  id: string;
  patientId: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  status: "New" | "Routed" | "Resolved";
}

export interface Patient {
  id: string;
  mrn: string;
  name: string;
  dob: string;
  sex: string;
  pronouns: string;
  language: string;
  address: string;
  phone: string;
  insurance: string;
  problems: { code: string; display: string; onset: string }[];
  medications: { name: string; sig: string; status: string }[];
  allergies: { allergen: string; reaction: string; severity: string }[];
  vitals: { date: string; bp: string; hr: number; weight: string }[];
  results: { date: string; name: string; value: string; flag: string; status: string }[];
  notes: NoteVersion[];
  duplicateCandidate?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  patientId?: string;
  detail: string;
}

export interface ExerciseAttempt {
  id: string;
  title: string;
  summary: string;
  durationMinutes: number;
  teamSize: "Individual" | "Pairs" | "3–4 learners";
  objectives: string[];
  requiredAuditActions: string[];
  completedActions: string[];
  startedAt: string;
}

export interface ExchangeItem {
  id: string;
  patientId: string;
  sourceOrganization: string;
  sourcePatientId: string;
  resourceType: "AllergyIntolerance" | "MedicationRequest" | "Condition" | "Observation" | "DiagnosticReport";
  receivedAt: string;
  sourceTimestamp: string;
  localValue: string;
  incomingValue: string;
  matchScore: number;
  discrepancy: string;
  status: "Pending review" | "Accepted" | "Kept local" | "Deferred";
  reviewerNote?: string;
}

export interface IdentityReview {
  id: string;
  patientIds: [string, string];
  signals: { label: string; first: string; second: string; strength: "Match" | "Difference" | "Unverified" }[];
  status: "Open" | "Resolved";
  decision?: "Same person — queue merge" | "Different people — retain both" | "Need more information";
  note?: string;
}

export interface QueryRun {
  id: string;
  name: string;
  definition: string;
  executedAt: string;
  rowCount: number;
  patientIds: string[];
}

export interface ImplementationCheckpoint {
  id: string;
  domain: "Governance" | "Workflow" | "Migration" | "Interfaces" | "Training" | "Downtime" | "Go-live" | "Measurement";
  requirement: string;
  owner: string;
  evidence: string;
  risk: "Low" | "Moderate" | "High";
  status: "Not started" | "In progress" | "Ready" | "Blocked";
}

export interface EHRState {
  version: 2;
  appointments: Appointment[];
  patients: Patient[];
  orders: Order[];
  tasks: Task[];
  messages: PortalMessage[];
  audit: AuditEvent[];
  exercises: ExerciseAttempt[];
  exchanges: ExchangeItem[];
  identityReviews: IdentityReview[];
  queryRuns: QueryRun[];
  implementation: ImplementationCheckpoint[];
}
