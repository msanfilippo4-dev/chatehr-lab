import { ACTION, type ActionId } from "../actions";
import type { CodeEntry } from "../config/types";
import type {
  AIReviewRecord, Appointment, AuditEvent, EHRState, EligibilityCheck, ExchangeItem, IdentityReview, ImplementationCheckpoint,
  NoteVersion, Order, Patient, QueryRun, Referral, Role, SavedQueryDefinition, Task, WaitlistEntry,
} from "../types";
import { AUDIT_LIMIT } from "../types";

export interface ActionMeta {
  at: string;
  actor: string;
  role: Role;
  makeId: (prefix: string) => string;
}

export type WorkspaceAction =
  | { type: "replace"; state: EHRState }
  | { type: "audit"; action: ActionId; detail: string; patientId?: string; context?: string }
  | { type: "openChart"; patientId: string }
  | { type: "registerPatient"; patient: Patient; duplicateCandidates: string[] }
  | { type: "verifyEligibility"; check: EligibilityCheck }
  | { type: "escalateIdentity"; patientId: string; candidateId: string }
  | { type: "resolveIdentity"; reviewId: string; decision: NonNullable<IdentityReview["decision"]>; note: string }
  | { type: "createAppointment"; appointment: Appointment }
  | { type: "rescheduleAppointment"; id: string; changes: Partial<Appointment> }
  | { type: "updateAppointmentStatus"; id: string; status: Appointment["status"]; reason?: string }
  | { type: "sendReminder"; id: string }
  | { type: "addWaitlist"; entry: WaitlistEntry }
  | { type: "createReferral"; referral: Referral }
  | { type: "useCode"; patientId: string; entry: CodeEntry }
  | { type: "saveNote"; patientId: string; note: NoteVersion }
  | { type: "cosignNote"; patientId: string; noteId: string; by: string }
  | { type: "placeOrder"; order: Order; overrideReason?: string }
  | { type: "acknowledgeResult"; orderId: string }
  | { type: "reviewResult"; orderId: string; task: Task }
  | { type: "toggleTask"; id: string }
  | { type: "routeMessage"; id: string; routedTo: string; categoryId?: string }
  | { type: "resolveMessage"; id: string }
  | { type: "reconciliationRequest"; patientId: string; detail: string }
  | { type: "reconcileExchange"; id: string; status: Exclude<ExchangeItem["status"], "Pending review"> }
  | { type: "runQuery"; run: QueryRun }
  | { type: "saveQuery"; definition: SavedQueryDefinition }
  | { type: "validateQuery"; name: string; rowCount: number; note: string }
  | { type: "recordAIReview"; record: AIReviewRecord }
  | { type: "updateReadiness"; checkpointId: string; status: ImplementationCheckpoint["status"] }
  | { type: "recordGoLive"; recommendation: string; note: string }
  | { type: "reviewAudit"; patientId: string }
  | { type: "noteExport"; kind: "workspace" | "report" };

function withAudit(state: EHRState, meta: ActionMeta, action: ActionId, detail: string, patientId?: string, context?: string): EHRState {
  const event: AuditEvent = { id: meta.makeId("AUD"), timestamp: meta.at, actor: `${meta.role} learner`, action, patientId, detail, context, provenance: "earned", actorRole: meta.role };
  return { ...state, audit: [event, ...state.audit].slice(0, AUDIT_LIMIT) };
}

function patientName(state: EHRState, id: string) {
  const patient = state.patients.find((item) => item.id === id);
  return patient ? `${patient.name} (${patient.mrn})` : id;
}

function updatePatient(state: EHRState, id: string, updater: (patient: Patient) => Patient): EHRState {
  return { ...state, patients: state.patients.map((patient) => (patient.id === id ? updater(patient) : patient)) };
}

export function ehrReducer(state: EHRState, action: WorkspaceAction, meta: ActionMeta): EHRState {
  switch (action.type) {
    case "replace":
      return action.state;
    case "audit":
      return withAudit(state, meta, action.action, action.detail, action.patientId, action.context);
    case "openChart":
      return withAudit(state, meta, ACTION.OPEN_CHART, patientName(state, action.patientId), action.patientId, action.patientId);
    case "registerPatient": {
      const patient = { ...action.patient, registeredAt: meta.at };
      const next: EHRState = {
        ...state,
        patients: [...state.patients, patient],
        registrations: [...state.registrations, { id: meta.makeId("REG"), patientId: patient.id, createdAt: meta.at, duplicateCandidates: action.duplicateCandidates, decision: action.duplicateCandidates.length ? "Possible duplicate escalated" : "No match found" }],
      };
      return withAudit(next, meta, ACTION.REGISTER_PATIENT, `${patient.name} (${patient.mrn}); duplicate check: ${action.duplicateCandidates.length ? `${action.duplicateCandidates.length} candidate(s) flagged` : "no match"}`, patient.id, patient.id);
    }
    case "verifyEligibility": {
      const next = { ...state, eligibilityChecks: [action.check, ...state.eligibilityChecks] };
      return withAudit(next, meta, ACTION.VERIFY_ELIGIBILITY, `${action.check.status} · ${action.check.planType} · member ${action.check.memberId} · ${action.check.source}`, action.check.patientId, action.check.id);
    }
    case "escalateIdentity":
      return withAudit(state, meta, ACTION.ESCALATE_IDENTITY_REVIEW, `Compare ${action.patientId} with ${action.candidateId}`, action.patientId, action.patientId);
    case "resolveIdentity": {
      const next = { ...state, identityReviews: state.identityReviews.map((review) => (review.id === action.reviewId ? { ...review, status: "Resolved" as const, decision: action.decision, note: action.note, decidedAt: meta.at } : review)) };
      const review = state.identityReviews.find((item) => item.id === action.reviewId);
      return withAudit(next, meta, ACTION.RESOLVE_IDENTITY_REVIEW, `${action.reviewId}: ${action.decision}. ${action.note}`, review?.patientIds[0], action.reviewId);
    }
    case "createAppointment": {
      const appointment = { ...action.appointment, createdAt: meta.at, history: [{ at: meta.at, change: "Created" }] };
      const next = { ...state, appointments: [...state.appointments, appointment] };
      return withAudit(next, meta, ACTION.CREATE_APPOINTMENT, `${appointment.date} ${appointment.time} ${appointment.provider} · ${appointment.visitType}`, appointment.patientId, appointment.id);
    }
    case "rescheduleAppointment": {
      const existing = state.appointments.find((item) => item.id === action.id);
      if (!existing) return state;
      const updated: Appointment = { ...existing, ...action.changes, status: "Scheduled", history: [...(existing.history ?? []), { at: meta.at, change: `Rescheduled from ${existing.date} ${existing.time} ${existing.provider}` }] };
      const next = { ...state, appointments: state.appointments.map((item) => (item.id === action.id ? updated : item)) };
      return withAudit(next, meta, ACTION.RESCHEDULE_APPOINTMENT, `${updated.date} ${updated.time} ${updated.provider}`, updated.patientId, updated.id);
    }
    case "updateAppointmentStatus": {
      const existing = state.appointments.find((item) => item.id === action.id);
      if (!existing) return state;
      const updated: Appointment = { ...existing, status: action.status, cancellationReason: action.status === "Canceled" ? action.reason : existing.cancellationReason, history: [...(existing.history ?? []), { at: meta.at, change: `${action.status}${action.reason ? ` · ${action.reason}` : ""}` }] };
      const next = { ...state, appointments: state.appointments.map((item) => (item.id === action.id ? updated : item)) };
      const auditAction = action.status === "No-show" ? ACTION.RECORD_NO_SHOW : ACTION.UPDATE_APPOINTMENT;
      return withAudit(next, meta, auditAction, `${action.id} to ${action.status}${action.reason ? ` (${action.reason})` : ""}`, existing.patientId, action.id);
    }
    case "sendReminder": {
      const existing = state.appointments.find((item) => item.id === action.id);
      if (!existing) return state;
      const next = { ...state, appointments: state.appointments.map((item) => (item.id === action.id ? { ...item, reminderSentAt: meta.at, history: [...(item.history ?? []), { at: meta.at, change: "Reminder sent (simulated)" }] } : item)) };
      return withAudit(next, meta, ACTION.UPDATE_APPOINTMENT, `${action.id} reminder sent`, existing.patientId, `${action.id}:reminder`);
    }
    case "addWaitlist": {
      const next = { ...state, waitlist: [...state.waitlist, action.entry] };
      return withAudit(next, meta, ACTION.ADD_WAITLIST, `${action.entry.visitType} · ${action.entry.preferredWindow}`, action.entry.patientId, action.entry.id);
    }
    case "createReferral": {
      const next = { ...state, referrals: [...state.referrals, action.referral] };
      return withAudit(next, meta, ACTION.CREATE_REFERRAL, `${action.referral.specialty} · ${action.referral.priority} · authorization ${action.referral.authorizationStatus}`, action.referral.patientId, action.referral.id);
    }
    case "useCode":
      return withAudit(state, meta, ACTION.USE_CODE_EXAMPLE, `${action.entry.system} ${action.entry.code}: ${action.entry.display} (${action.entry.version})`, action.patientId, `${action.entry.system}:${action.entry.code}`);
    case "saveNote": {
      const next = updatePatient(state, action.patientId, (patient) => ({ ...patient, notes: [...patient.notes, action.note] }));
      const auditAction = action.note.kind === "Amendment" ? ACTION.AMEND_SIGNED_NOTE : action.note.kind === "Signed" ? ACTION.SIGNED_SOAP_NOTE : ACTION.DRAFT_SOAP_NOTE;
      return withAudit(next, meta, auditAction, `${action.note.id}${action.note.copiedForwardFrom ? " · copied forward from " + action.note.copiedForwardFrom : ""}`, action.patientId, action.note.id);
    }
    case "cosignNote": {
      const next = updatePatient(state, action.patientId, (patient) => ({ ...patient, notes: patient.notes.map((note) => (note.id === action.noteId ? { ...note, cosignedBy: action.by, cosignedAt: meta.at } : note)) }));
      return withAudit(next, meta, ACTION.COSIGN_NOTE, `${action.noteId} co-signed by ${action.by}`, action.patientId, action.noteId);
    }
    case "placeOrder": {
      const order = { ...action.order, overrideReason: action.overrideReason };
      let next: EHRState = { ...state, orders: [...state.orders, order] };
      next = withAudit(next, meta, ACTION.PLACE_SIMULATED_ORDER, `${order.name}${order.warnings?.length ? ` · warnings: ${order.warnings.join("; ")}` : ""}${action.overrideReason ? " · override recorded" : ""}`, order.patientId, order.id);
      if (action.overrideReason) next = withAudit(next, meta, ACTION.OVERRIDE_ALERT, `${order.name}: ${action.overrideReason}`, order.patientId, order.id);
      return next;
    }
    case "acknowledgeResult": {
      const order = state.orders.find((item) => item.id === action.orderId);
      if (!order) return state;
      const next = { ...state, orders: state.orders.map((item) => (item.id === action.orderId ? { ...item, acknowledgedAt: meta.at, acknowledgedBy: meta.actor } : item)) };
      return withAudit(next, meta, ACTION.ACKNOWLEDGE_RESULT, `${order.name}: ${order.result ?? "result"}`, order.patientId, order.id);
    }
    case "reviewResult": {
      const order = state.orders.find((item) => item.id === action.orderId);
      if (!order) return state;
      const next = {
        ...state,
        orders: state.orders.map((item) => (item.id === action.orderId ? { ...item, status: "Reviewed" as const, acknowledgedAt: item.acknowledgedAt ?? meta.at, acknowledgedBy: item.acknowledgedBy ?? meta.actor } : item)),
        tasks: [...state.tasks, { ...action.task, sourceOrderId: order.id }],
      };
      return withAudit(next, meta, ACTION.REVIEW_RESULT_FOLLOWUP, `${order.name} → task "${action.task.title}" owned by ${action.task.owner ?? "unassigned"}`, order.patientId, order.id);
    }
    case "toggleTask": {
      const task = state.tasks.find((item) => item.id === action.id);
      const next = { ...state, tasks: state.tasks.map((item) => (item.id === action.id ? { ...item, complete: !item.complete } : item)) };
      return withAudit(next, meta, ACTION.UPDATE_TASK, `${action.id} ${task?.complete ? "reopened" : "completed"}`, task?.patientId, action.id);
    }
    case "routeMessage": {
      const message = state.messages.find((item) => item.id === action.id);
      const next = { ...state, messages: state.messages.map((item) => (item.id === action.id ? { ...item, status: "Routed" as const, routedTo: action.routedTo, categoryId: action.categoryId } : item)) };
      return withAudit(next, meta, ACTION.ROUTE_PORTAL_MESSAGE, `${action.id} → ${action.routedTo}`, message?.patientId, action.id);
    }
    case "resolveMessage": {
      const message = state.messages.find((item) => item.id === action.id);
      const next = { ...state, messages: state.messages.map((item) => (item.id === action.id ? { ...item, status: "Resolved" as const } : item)) };
      return withAudit(next, meta, ACTION.RESOLVE_PORTAL_MESSAGE, action.id, message?.patientId, action.id);
    }
    case "reconciliationRequest":
      return withAudit(state, meta, ACTION.PATIENT_RECONCILIATION_REQUEST, action.detail, action.patientId, action.patientId);
    case "reconcileExchange": {
      const item = state.exchanges.find((row) => row.id === action.id);
      if (!item) return state;
      const reviewerNote = action.status === "Accepted" ? "Accepted into the longitudinal record after provenance review." : action.status === "Kept local" ? "Local value retained; external source remains visible in history." : "Deferred for source verification.";
      const next = { ...state, exchanges: state.exchanges.map((row) => (row.id === action.id ? { ...row, status: action.status, reviewerNote, decidedAt: meta.at } : row)) };
      return withAudit(next, meta, ACTION.RECONCILE_EXTERNAL_ITEM, `${item.resourceType} from ${item.sourceOrganization}: ${action.status}`, item.patientId, item.id);
    }
    case "runQuery": {
      const next = { ...state, queryRuns: [action.run, ...state.queryRuns].slice(0, 50) };
      return withAudit(next, meta, ACTION.RUN_POPULATION_QUERY, `${action.run.name}: ${action.run.rowCount} of ${action.run.denominator ?? state.patients.length} patient(s)`, undefined, action.run.name);
    }
    case "saveQuery": {
      const next = { ...state, savedQueries: [action.definition, ...state.savedQueries.filter((item) => item.id !== action.definition.id)] };
      return withAudit(next, meta, ACTION.SAVE_QUERY_DEFINITION, `${action.definition.name}: ${action.definition.note}`, undefined, action.definition.id);
    }
    case "validateQuery":
      return withAudit(state, meta, ACTION.VALIDATE_POPULATION_QUERY, `${action.name}: ${action.rowCount} patient(s). ${action.note}`, undefined, action.name);
    case "recordAIReview": {
      const next = { ...state, aiReviews: [action.record, ...state.aiReviews] };
      return withAudit(next, meta, ACTION.AI_DRAFT_REVIEW, `${action.record.disposition}; ${action.record.findings.length} finding(s): ${action.record.findings.join(", ") || "none"}`, action.record.patientId, action.record.patientId);
    }
    case "updateReadiness": {
      const checkpoint = state.implementation.find((item) => item.id === action.checkpointId);
      if (!checkpoint) return state;
      const next = { ...state, implementation: state.implementation.map((item) => (item.id === action.checkpointId ? { ...item, status: action.status, updatedAt: meta.at } : item)) };
      return withAudit(next, meta, ACTION.UPDATE_IMPLEMENTATION_READINESS, `${checkpoint.domain}: ${action.status}; evidence: ${checkpoint.evidence}`, undefined, checkpoint.id);
    }
    case "recordGoLive":
      return withAudit(state, meta, ACTION.RECORD_GO_LIVE_RECOMMENDATION, `${action.recommendation}. ${action.note}`, undefined, "go-live");
    case "reviewAudit":
      return withAudit(state, meta, ACTION.REVIEW_AUDIT_LOG, `Reviewed access history for ${patientName(state, action.patientId)}`, action.patientId, action.patientId);
    case "noteExport": {
      const next = { ...state, meta: { ...state.meta, lastExportAt: meta.at } };
      return withAudit(next, meta, action.kind === "workspace" ? ACTION.EXPORT_WORKSPACE : ACTION.EXPORT_LEARNER_REPORT, action.kind === "workspace" ? "Downloaded versioned JSON workspace" : "Downloaded action-based evidence report");
    }
    default:
      return state;
  }
}
