import { ACTION } from "../actions";
import type { CourseAssignment } from "../config/types";
import { buildInitialState } from "../seed";
import type { EHRState, NoteVersion } from "../types";

/**
 * Reset only the parts of a workspace that one assignment's workflow touches.
 * Signed notes and amendments are always preserved; drafts are removed.
 * Audit events for the assignment's required actions are removed locally
 * (server-side events are retained and excluded by a reset cutoff instead).
 */
export function scopedReset(state: EHRState, assignment: CourseAssignment, actor: string, now = new Date().toISOString()): EHRState {
  const fresh = buildInitialState(undefined, state.meta.owner);
  const required = new Set(assignment.requirements.map((item) => item.action));
  const id = assignment.id;
  let next: EHRState = { ...state };

  if (id === "FORDMS-A1") {
    next = {
      ...next,
      appointments: fresh.appointments,
      identityReviews: fresh.identityReviews,
      registrations: [],
      eligibilityChecks: [],
      waitlist: [],
      referrals: [],
      patients: next.patients.filter((patient) => !patient.registeredAt),
    };
  } else if (id === "FORDMS-A2") {
    next = {
      ...next,
      orders: [],
      tasks: fresh.tasks,
      messages: fresh.messages,
      patients: next.patients.map((patient) => ({ ...patient, notes: patient.notes.filter((note: NoteVersion) => note.kind !== "Draft") })),
    };
  } else if (id === "FORDMS-A3") {
    next = { ...next, exchanges: fresh.exchanges, queryRuns: [], savedQueries: [] };
  } else if (id === "FORDMS-A4") {
    next = { ...next, implementation: fresh.implementation, aiReviews: [] };
  }

  const audit = next.audit.filter((event) => !required.has(event.action as never));
  return {
    ...next,
    audit: [{ id: `AUD-reset-${Date.now()}`, timestamp: now, actor, action: ACTION.RESET_WORKSPACE, detail: `Reset ${id} work; signed notes and other assignments preserved`, context: id, provenance: "earned" }, ...audit],
    meta: { ...next.meta, lastResetAt: now },
  };
}

export function fullReset(state: EHRState, actor: string, now = new Date().toISOString()): EHRState {
  const fresh = buildInitialState(undefined, state.meta.owner);
  return {
    ...fresh,
    meta: { ...fresh.meta, createdAt: state.meta.createdAt, lastResetAt: now },
    audit: [{ id: `AUD-reset-${Date.now()}`, timestamp: now, actor, action: ACTION.RESET_WORKSPACE, detail: "Reset the entire workspace to the synthetic starting state", context: "all", provenance: "earned" }],
  };
}
