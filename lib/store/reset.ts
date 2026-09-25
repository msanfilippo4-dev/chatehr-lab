import { ACTION } from "../actions";
import type { CourseAssignment } from "../config/types";
import { matchesRequirement } from "../progress";
import { buildInitialState } from "../seed";
import type { EHRState, InBasketItem, NoteVersion, Ticket } from "../types";

function resetTickets(current: Ticket[], fresh: Ticket[], code: string): Ticket[] {
  return current.map((ticket) => (ticket.assignment === code ? fresh.find((item) => item.id === ticket.id) ?? ticket : ticket));
}

function resetInBasket(current: InBasketItem[], fresh: InBasketItem[], predicate: (item: InBasketItem) => boolean): InBasketItem[] {
  return current.map((item) => (predicate(item) ? fresh.find((row) => row.id === item.id) ?? item : item));
}

/**
 * Reset only the parts of a workspace that one assignment's workflow touches.
 * Signed notes and amendments are always preserved; drafts are removed.
 * Audit events that satisfy one of the assignment's requirements are removed locally
 * (server-side events are retained and excluded by a reset cutoff instead). Events
 * for the same action that count toward a different assignment (e.g. another
 * assignment's tickets) are kept.
 */
export function scopedReset(state: EHRState, assignment: CourseAssignment, actor: string, now = new Date().toISOString()): EHRState {
  const fresh = buildInitialState(undefined, state.meta.owner);
  const id = assignment.id;
  const code = id.replace("FORDMS-", "");
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
      tickets: resetTickets(next.tickets, fresh.tickets, code),
    };
  } else if (id === "FORDMS-A2") {
    next = {
      ...next,
      orders: [],
      tasks: fresh.tasks,
      messages: fresh.messages,
      patients: next.patients.map((patient) => ({ ...patient, notes: patient.notes.filter((note: NoteVersion) => note.kind !== "Draft") })),
      marAdministrations: fresh.marAdministrations,
      marScans: [],
      inBasket: resetInBasket(next.inBasket, fresh.inBasket, (item) => item.kind !== "AI draft reply"),
      tickets: resetTickets(next.tickets, fresh.tickets, code),
    };
  } else if (id === "FORDMS-A3") {
    next = { ...next, exchanges: fresh.exchanges, queryRuns: [], savedQueries: [], claims: fresh.claims, tickets: resetTickets(next.tickets, fresh.tickets, code) };
  } else if (id === "FORDMS-A4") {
    next = {
      ...next,
      implementation: fresh.implementation,
      aiReviews: [],
      inBasket: resetInBasket(next.inBasket, fresh.inBasket, (item) => item.kind === "AI draft reply"),
      tickets: resetTickets(next.tickets, fresh.tickets, code),
    };
  }

  const audit = next.audit.filter((event) => !assignment.requirements.some((requirement) => matchesRequirement(requirement, event)));
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
