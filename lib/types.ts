import type { ActionId } from "./actions";

/**
 * Simulated roles. "Clinical" is the pre-v5 combined clinical role; it stays valid in
 * stored audit events and older published configurations, and maps to Nurse and Physician/APP.
 */
export type Role =
  | "Analyst"
  | "Front Desk"
  | "Nurse"
  | "Physician/APP"
  | "HIM"
  | "Revenue Cycle"
  | "Implementation Lead"
  | "Patient"
  | "Clinical";
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
  /** Seeded history: who wrote it and how the content was produced. */
  source?: "Typed" | "Copied forward" | "AI scribe draft accepted";
  /** Adolescent confidential note: must not be visible to a parent proxy. */
  confidential?: boolean;
  encounterId?: string;
  /** Co-signature requested from this provider (seeded NP notes). */
  cosignRequestedFrom?: string;
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

export interface PatientProblem { code: string; display: string; onset: string; status?: "Active" | "Resolved" }
export interface PatientMedication {
  name: string;
  sig: string;
  status: string;
  dose?: string;
  route?: string;
  frequency?: string;
  prescriber?: string;
  indication?: string;
}
export interface PatientAllergy {
  allergen: string;
  reaction: string;
  severity: string;
  type?: "Allergy" | "Intolerance";
  verified?: string;
}
export interface PatientVital {
  date: string;
  bp: string;
  hr: number;
  weight: string;
  temp?: string;
  rr?: number;
  spo2?: number;
  bmi?: string;
}
export interface PatientResult {
  date: string;
  name: string;
  value: string;
  flag: string;
  status: string;
  unit?: string;
  range?: string;
  loinc?: string;
  orderedBy?: string;
}
export interface CareTeamMember { name: string; role: string }
export interface PatientEncounter {
  id: string;
  date: string;
  type: "Office visit" | "Telehealth" | "Inpatient" | "Emergency" | "Urgent care (external)" | "Nurse visit";
  provider: string;
  department: string;
  reason: string;
  status: "Completed" | "Active admission" | "Scheduled" | "No-show";
  location?: string;
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
  /** v4 chart context (optional so registered patients and v3 workspaces stay valid). */
  preferredName?: string;
  legalNameOnCoverage?: string;
  genderIdentity?: string;
  sexAssignedAtBirth?: string;
  interpreterNeeded?: boolean;
  pcp?: string;
  careTeam?: CareTeamMember[];
  encounters?: PatientEncounter[];
  codeStatus?: string;
  flags?: string[];
  location?: string;
  admittedAt?: string;
  weightKg?: number;
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

export type SentenceLabel = "Supported" | "Unsupported" | "Contradicts source" | "Wrong patient detail" | "Omission";

export interface SentenceClassification {
  sentenceId: string;
  label: SentenceLabel;
  /** Source line id (e.g. "S5") or "none" when no source supports the sentence. */
  citation: string;
  comment?: string;
}

export interface AIReviewRecord {
  id: string;
  patientId: string;
  findings: string[];
  disposition: string;
  note: string;
  reviewedAt: string;
  /** v4: sentence-level review of a fixed draft. Scored only on the server. */
  draftId?: string;
  classifications?: SentenceClassification[];
}

/* ---------------------------------------------------------------- v4 clinical slices */

export interface MarOrder {
  id: string;
  patientId: string;
  drug: string;
  /** Generic drug key used for five-rights matching, e.g. "metoprolol tartrate". */
  drugKey: string;
  doseMg: number;
  doseLabel: string;
  route: "PO" | "IV" | "SC" | "INH";
  frequency: string;
  /** Scheduled times (HH:MM) on the simulated day; empty for PRN-only orders. */
  times: string[];
  prn?: { indication: string; minHoursBetween: number; requiresPainScore: boolean };
  parameters?: string;
  orderedBy: string;
  notes?: string;
}

export interface DrawerItem {
  id: string;
  patientId: string;
  label: string;
  drugKey: string;
  strengthMg: number;
  route: "PO" | "IV" | "SC" | "INH";
  barcode: string;
  /** Teaching note shown after a mismatch, never before. */
  pitfall?: "wrong-dose" | "look-alike" | "wrong-patient";
}

export interface WristbandOption {
  id: string;
  label: string;
  mrn: string;
  dob: string;
}

export interface MarAdministration {
  id: string;
  orderId: string;
  patientId: string;
  /** Scheduled slot "HH:MM" or "PRN". */
  slot: string;
  /** Calendar date of the administration; omitted means SIMULATION_DATE. */
  date?: string;
  outcome: "Given" | "Held" | "Given with override";
  recordedAt: string;
  /** Simulated clock time of the administration (HH:MM). */
  simTime: string;
  performer: string;
  itemId?: string;
  wristbandMrn?: string;
  warnings?: string[];
  reason?: string;
  painScore?: number;
  late?: boolean;
  seeded?: boolean;
}

export interface MarScanRecord {
  id: string;
  orderId: string;
  patientId: string;
  slot: string;
  wristbandId: string;
  itemId: string;
  scannedAt: string;
  warnings: string[];
  blocking: boolean;
}

export interface FlowsheetEntry {
  id: string;
  patientId: string;
  /** ISO local time on the simulated timeline, e.g. "2026-09-21T08:00". */
  time: string;
  temp?: number;
  hr?: number;
  sbp?: number;
  dbp?: number;
  rr?: number;
  spo2?: number;
  onOxygen?: boolean;
  consciousness?: "Alert" | "New confusion" | "Voice" | "Pain" | "Unresponsive";
  pain?: number;
  intake?: number;
  output?: number;
  fallRiskReassessed?: boolean;
  recordedBy: string;
  seeded?: boolean;
  ews?: number;
  escalation?: string;
}

export type InBasketKind = "Result" | "Advice request" | "Refill request" | "Co-sign" | "AI draft reply";

export interface InBasketItem {
  id: string;
  kind: InBasketKind;
  pool: "Physician/APP" | "Nurse";
  patientId: string;
  subject: string;
  body: string;
  from: string;
  receivedAt: string;
  recipient: string;
  priority: "Routine" | "High" | "Critical";
  status: "Open" | "Done";
  /** Links back to existing workspace records. */
  messageId?: string;
  noteId?: string;
  result?: { name: string; value: string; unit: string; range: string; flag: string; collectedAt: string; orderedBy: string };
  refill?: { medication: string; pharmacy: string; lastFilled: string; note?: string };
  aiDraft?: { text: string; generatedAt: string; model: string };
  routingNote?: string;
  completedAt?: string;
  outcome?: string;
  reply?: string;
  taskId?: string;
  reviewIssues?: string[];
}

export interface ClaimLine {
  line: number;
  cpt: string;
  description: string;
  modifiers: string[];
  dxPointers: string[];
  units: number;
  charge: number;
  orderingProvider?: string;
}

export interface ClaimDenial {
  group: "CO" | "PR" | "OA";
  carc: string;
  plain: string;
  rarc?: string;
  deniedAt: string;
  amount: number;
  line?: number;
}

export interface Claim {
  id: string;
  patientId: string;
  dos: string;
  provider: string;
  department: string;
  insurerId: string;
  payer: string;
  memberId: string;
  diagnoses: { code: string; display: string }[];
  lines: ClaimLine[];
  eligibility: "Active" | "Inactive" | "Needs verification";
  requiresReferral: boolean;
  referralNumber?: string;
  requiresPriorAuth?: boolean;
  priorAuthNumber?: string;
  /** Documentation that supports a significant, separately identifiable E/M (modifier 25). */
  separateEmDocumented?: boolean;
  status: "Charge review" | "Ready to submit" | "Submitted" | "Denied" | "Denial worked";
  denial?: ClaimDenial;
  denialWork?: { action: string; note: string; workedAt: string };
  history: { at: string; change: string }[];
  scrubbedAt?: string;
}

export type TicketCategory = "Break-fix" | "Safety" | "Enhancement" | "Training" | "Data request";
export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";

export interface Ticket {
  id: string;
  /** Assignment that uses this ticket ("A2"…), or "GEN" for practice tickets. */
  assignment: "A1" | "A2" | "A3" | "A4" | "GEN";
  requester: string;
  requesterRole: string;
  subject: string;
  body: string;
  openedAt: string;
  patientId?: string;
  links: { label: string; view: string; patientId?: string; role?: string }[];
  evidenceOptions: { id: string; label: string }[];
  rootCauseOptions: string[];
  notifyOptions: string[];
  status: "New" | "Triaged" | "Resolved";
  triage?: { category: TicketCategory; priority: TicketPriority; owner: string; at: string };
  evidence: { id: string; note: string; at: string }[];
  resolution?: { rootCause: string; detail: string; fix: string; notify: string[]; communication: string; at: string };
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
  version: 4;
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
  /* v4 slices */
  marOrders: MarOrder[];
  marAdministrations: MarAdministration[];
  marScans: MarScanRecord[];
  flowsheets: FlowsheetEntry[];
  inBasket: InBasketItem[];
  claims: Claim[];
  tickets: Ticket[];
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
