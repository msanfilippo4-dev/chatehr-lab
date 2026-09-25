/**
 * Canonical audit action identifiers.
 *
 * The string values are the wire format stored in `ehr_activity_events.action`
 * and in every learner workspace. Values that existed before the v3 workspace
 * schema must never change, or historical evidence stops counting.
 */
export const ACTION = {
  OPEN_CHART: "Open chart",
  REGISTER_PATIENT: "Register patient",
  VERIFY_ELIGIBILITY: "Verify eligibility",
  ESCALATE_IDENTITY_REVIEW: "Escalate identity review",
  RESOLVE_IDENTITY_REVIEW: "Resolve identity review",
  CREATE_APPOINTMENT: "Create appointment",
  RESCHEDULE_APPOINTMENT: "Reschedule appointment",
  UPDATE_APPOINTMENT: "Update appointment",
  RECORD_NO_SHOW: "Record no-show",
  ADD_WAITLIST: "Add to wait-list",
  CREATE_REFERRAL: "Create referral",
  USE_CODE_EXAMPLE: "Use code example",
  DRAFT_SOAP_NOTE: "Draft SOAP note",
  SIGNED_SOAP_NOTE: "Signed SOAP note",
  AMEND_SIGNED_NOTE: "Amend signed note",
  COSIGN_NOTE: "Co-sign note",
  PLACE_SIMULATED_ORDER: "Place simulated order",
  OVERRIDE_ALERT: "Override alert",
  ACKNOWLEDGE_RESULT: "Acknowledge result",
  REVIEW_RESULT_FOLLOWUP: "Review result and create follow-up",
  UPDATE_TASK: "Update task",
  ROUTE_PORTAL_MESSAGE: "Route portal message",
  RESOLVE_PORTAL_MESSAGE: "Resolve portal message",
  PATIENT_RECONCILIATION_REQUEST: "Patient data reconciliation request",
  RECONCILE_EXTERNAL_ITEM: "Reconcile external item",
  RUN_POPULATION_QUERY: "Run population query",
  SAVE_QUERY_DEFINITION: "Save query definition",
  VALIDATE_POPULATION_QUERY: "Validate population query",
  AI_DRAFT_REVIEW: "AI draft review",
  UPDATE_IMPLEMENTATION_READINESS: "Update implementation readiness",
  RECORD_GO_LIVE_RECOMMENDATION: "Record go-live recommendation",
  REVIEW_AUDIT_LOG: "Review audit log",
  EXPORT_WORKSPACE: "Export workspace",
  EXPORT_LEARNER_REPORT: "Export learner report",
  IMPORT_WORKSPACE: "Import workspace",
  RESET_WORKSPACE: "Reset workspace",
  // v4 (FordMS v5 clinical revamp). Append only; never rename a value above.
  MAR_SCAN: "MAR scan",
  ADMINISTER_MEDICATION: "Administer medication",
  HOLD_MEDICATION: "Hold medication",
  OVERRIDE_MAR_WARNING: "Override MAR warning",
  DOCUMENT_FLOWSHEET: "Document flowsheet",
  COMPLETE_INBASKET_ITEM: "Complete in-basket item",
  REVIEW_AI_DRAFT_REPLY: "Review AI draft reply",
  SCRUB_CLAIM: "Scrub claim",
  CORRECT_CLAIM: "Correct claim",
  SUBMIT_CLAIM: "Submit claim",
  WORK_DENIAL: "Work denial",
  TRIAGE_TICKET: "Triage ticket",
  RECORD_TICKET_EVIDENCE: "Record ticket evidence",
  RESOLVE_TICKET: "Resolve ticket",
} as const;

export type ActionId = (typeof ACTION)[keyof typeof ACTION];

export const ACTION_IDS: readonly ActionId[] = Object.values(ACTION);

export type ActionContextKind = "none" | "patient" | "entity";

/**
 * How repeated events for the same action are de-duplicated when counting
 * assignment progress.
 *
 * - `entity`: one credit per distinct `context` (appointment id, note id, code, checkpoint id, query name…)
 * - `patient`: one credit per distinct patient
 * - `none`: every event counts once (used for one-time actions)
 */
export const ACTION_CONTEXT: Record<ActionId, ActionContextKind> = {
  [ACTION.OPEN_CHART]: "patient",
  [ACTION.REGISTER_PATIENT]: "entity",
  [ACTION.VERIFY_ELIGIBILITY]: "patient",
  [ACTION.ESCALATE_IDENTITY_REVIEW]: "patient",
  [ACTION.RESOLVE_IDENTITY_REVIEW]: "entity",
  [ACTION.CREATE_APPOINTMENT]: "entity",
  [ACTION.RESCHEDULE_APPOINTMENT]: "entity",
  [ACTION.UPDATE_APPOINTMENT]: "entity",
  [ACTION.RECORD_NO_SHOW]: "entity",
  [ACTION.ADD_WAITLIST]: "entity",
  [ACTION.CREATE_REFERRAL]: "entity",
  [ACTION.USE_CODE_EXAMPLE]: "entity",
  [ACTION.DRAFT_SOAP_NOTE]: "entity",
  [ACTION.SIGNED_SOAP_NOTE]: "entity",
  [ACTION.AMEND_SIGNED_NOTE]: "entity",
  [ACTION.COSIGN_NOTE]: "entity",
  [ACTION.PLACE_SIMULATED_ORDER]: "entity",
  [ACTION.OVERRIDE_ALERT]: "entity",
  [ACTION.ACKNOWLEDGE_RESULT]: "entity",
  [ACTION.REVIEW_RESULT_FOLLOWUP]: "entity",
  [ACTION.UPDATE_TASK]: "entity",
  [ACTION.ROUTE_PORTAL_MESSAGE]: "entity",
  [ACTION.RESOLVE_PORTAL_MESSAGE]: "entity",
  [ACTION.PATIENT_RECONCILIATION_REQUEST]: "patient",
  [ACTION.RECONCILE_EXTERNAL_ITEM]: "entity",
  [ACTION.RUN_POPULATION_QUERY]: "entity",
  [ACTION.SAVE_QUERY_DEFINITION]: "entity",
  [ACTION.VALIDATE_POPULATION_QUERY]: "entity",
  [ACTION.AI_DRAFT_REVIEW]: "patient",
  [ACTION.UPDATE_IMPLEMENTATION_READINESS]: "entity",
  [ACTION.RECORD_GO_LIVE_RECOMMENDATION]: "none",
  [ACTION.REVIEW_AUDIT_LOG]: "patient",
  [ACTION.EXPORT_WORKSPACE]: "none",
  [ACTION.EXPORT_LEARNER_REPORT]: "none",
  [ACTION.IMPORT_WORKSPACE]: "none",
  [ACTION.RESET_WORKSPACE]: "none",
  [ACTION.MAR_SCAN]: "entity",
  [ACTION.ADMINISTER_MEDICATION]: "entity",
  [ACTION.HOLD_MEDICATION]: "entity",
  [ACTION.OVERRIDE_MAR_WARNING]: "entity",
  [ACTION.DOCUMENT_FLOWSHEET]: "entity",
  [ACTION.COMPLETE_INBASKET_ITEM]: "entity",
  [ACTION.REVIEW_AI_DRAFT_REPLY]: "entity",
  [ACTION.SCRUB_CLAIM]: "entity",
  [ACTION.CORRECT_CLAIM]: "entity",
  [ACTION.SUBMIT_CLAIM]: "entity",
  [ACTION.WORK_DENIAL]: "entity",
  [ACTION.TRIAGE_TICKET]: "entity",
  [ACTION.RECORD_TICKET_EVIDENCE]: "entity",
  [ACTION.RESOLVE_TICKET]: "entity",
};

export function isActionId(value: unknown): value is ActionId {
  return typeof value === "string" && (ACTION_IDS as readonly string[]).includes(value);
}
