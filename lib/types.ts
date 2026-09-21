import type { ActionId } from "./actions";

export type Role = "Front Desk" | "Clinical" | "HIM" | "Patient" | "Analyst" | "Implementation Lead";
export type AppointmentStatus = "Scheduled" | "Checked in" | "Completed" | "Canceled" | "No-show";
export type OrderStatus = "Draft" | "Submitted" | "Final" | "Reviewed";
export type Provenance = "earned" | "imported";

export interface Appointment {
  id: string;
  patientId: string;
  date: string;
  time: string;
  duration: number;
  provider: string;
  visitType: string;
  status: AppointmentStatus;
  providerId?: string;
  visitTypeId?: string;
  cancellationReason?: string;
  reminderSentAt?: string;
  createdAt?: string;
  history?: { at: string; change: string }[];
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
  templateId?: string;
  copiedForwardFrom?: string;
  cosignedBy?: string;
  cosignedAt?: string;
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
  warnings?: string[];
  overrideReason?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface Task {
  id: string;
  patientId: string;
  title: string;
  due: string;
  complete: boolean;
  owner?: string;
  sourceOrderId?: string;
}

export interface PortalMessage {
  id: string;
  patientId: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  status: "New" | "Routed" | "Resolved";
  categoryId?: string;
  routedTo?: string;
  proxy?: boolean;
}

export interface PatientProblem { code: string; display: string; onset: string }
export interface PatientMedication { name: string; sig: string; status: string }
export interface PatientAllergy { allergen: string; reaction: string; severity: string }
export interface PatientVital { date: string; bp: string; hr: number; weight: string }
export interface PatientResult { date: string; name: string; value: string; flag: string; status: string }

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
  problems: PatientProblem[];
  medications: PatientMedication[];
  allergies: PatientAllergy[];
  vitals: PatientVital[];
  results: PatientResult[];
  notes: NoteVersion[];
  duplicateCandidate?: string;
  insurerId?: string;
  memberId?: string;
  proxyAccess?: { name: string; relationship: string; scope: string }[];
  registeredAt?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: ActionId | string;
  patientId?: string;
  detail: string;
  /** Entity identifier used for progress de-duplication (appointment id, note id, code, checkpoint id…). */
  context?: string;
  provenance?: Provenance;
  actorRole?: Role;
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
  fhirResourceLabel?: string;
  provenance?: { sourceSystem: string; receivedVia: string };
  decidedAt?: string;
}

export interface IdentityReview {
  id: string;
  patientIds: [string, string];
  signals: { label: string; first: string; second: string; strength: "Match" | "Difference" | "Unverified" }[];
  status: "Open" | "Resolved";
  decision?: "Same person — queue merge" | "Different people — retain both" | "Need more information";
  note?: string;
  decidedAt?: string;
}

export interface QueryRun {
  id: string;
  name: string;
  definition: string;
  executedAt: string;
  rowCount: number;
  patientIds: string[];
  denominator?: number;
  missing?: number;
  stratification?: { label: string; count: number }[];
}

export interface SavedQueryDefinition {
  id: string;
  name: string;
  baseQuery: string;
  note: string;
  createdAt: string;
}

export interface ImplementationCheckpoint {
  id: string;
  domain: "Governance" | "Workflow" | "Migration" | "Interfaces" | "Training" | "Downtime" | "Go-live" | "Measurement";
  requirement: string;
  owner: string;
  evidence: string;
  risk: "Low" | "Moderate" | "High";
  status: "Not started" | "In progress" | "Ready" | "Blocked";
  updatedAt?: string;
}

export interface RegistrationRecord {
  id: string;
  patientId: string;
  createdAt: string;
  duplicateCandidates: string[];
  decision: "No match found" | "Possible duplicate escalated";
}

export interface EligibilityCheck {
  id: string;
  patientId: string;
  insurerId: string;
  planType: string;
  memberId: string;
  coverageStart: string;
  coverageEnd: string;
  status: "Active" | "Inactive" | "Needs verification";
  copay: string;
  deductibleMet: string;
  cobOrder: string;
  source: string;
  checkedAt: string;
}

export interface Referral {
  id: string;
  patientId: string;
  specialty: string;
  reason: string;
  priority: "Routine" | "Urgent";
  authorizationStatus: "Not required" | "Pending" | "Approved" | "Denied";
  authorizationNumber?: string;
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  patientId: string;
  visitType: string;
  preferredWindow: string;
  provider?: string;
  createdAt: string;
  status: "Waiting" | "Offered" | "Booked" | "Removed";
}

export interface AIReviewRecord {
  id: string;
  patientId: string;
  findings: string[];
  disposition: string;
  note: string;
  reviewedAt: string;
}

export interface WorkspaceMeta {
  owner: string;
  createdAt: string;
  configVersion: number;
  lastExportAt?: string;
  lastImportAt?: string;
  lastResetAt?: string;
}

export interface EHRState {
  version: 3;
  meta: WorkspaceMeta;
  appointments: Appointment[];
  patients: Patient[];
  orders: Order[];
  tasks: Task[];
  messages: PortalMessage[];
  audit: AuditEvent[];
  exchanges: ExchangeItem[];
  identityReviews: IdentityReview[];
  queryRuns: QueryRun[];
  savedQueries: SavedQueryDefinition[];
  implementation: ImplementationCheckpoint[];
  registrations: RegistrationRecord[];
  eligibilityChecks: EligibilityCheck[];
  referrals: Referral[];
  waitlist: WaitlistEntry[];
  aiReviews: AIReviewRecord[];
}

/** Maximum number of audit events retained in a workspace. */
export const AUDIT_LIMIT = 1000;

export type CourseRole = "student" | "instructor" | "admin";
export type SubmissionStatus = "submitted" | "graded" | "returned" | "revision_requested";
export type AssignmentProgressStatus = "not_started" | "in_progress" | "ready";
export type ReleaseState = "hidden" | "released" | "closed";

export interface CourseSubmission {
  assignment_id: string;
  status: SubmissionStatus;
  version: number;
  score: number | null;
  rubric_total: number | null;
  feedback: string | null;
  submitted_at: string;
  graded_at: string | null;
  graded_by?: string | null;
  return_comment?: string | null;
  returned_at?: string | null;
  late?: boolean;
}

export interface AssignmentRelease {
  assignment_id: string;
  state: ReleaseState;
  release_at: string | null;
  due_at: string | null;
  close_at: string | null;
  accept_late: boolean;
}

export interface ProgressRow {
  assignment_id: string;
  percent_complete: number;
  status: AssignmentProgressStatus;
  earned_units: number;
  imported_units: number;
  total_units: number;
  updated_at: string;
  completed_at?: string | null;
  progress?: unknown;
}
