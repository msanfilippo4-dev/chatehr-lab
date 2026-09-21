import { describe, expect, it } from "vitest";
import { ACTION } from "@/lib/actions";
import { defaultAssignments } from "@/lib/assignments";
import { exportEnvelope, importEnvelope, normalizeState } from "@/lib/db";
import { buildInitialState } from "@/lib/seed";
import { ehrReducer, type ActionMeta } from "@/lib/store/reducer";
import { fullReset, scopedReset } from "@/lib/store/reset";
import type { NoteVersion } from "@/lib/types";

let counter = 0;
const meta: ActionMeta = { at: "2026-10-01T12:00:00.000Z", actor: "e2e-student@fordham.edu", role: "Clinical", makeId: (prefix) => `${prefix}-${++counter}` };

describe("normalizeState", () => {
  it("upgrades a version 2 workspace", () => {
    const legacy = { version: 2, patients: buildInitialState().patients, audit: [{ id: "AUD-1", timestamp: "2026-09-21T10:00:00.000Z", actor: "Clinical learner", action: "Open chart", detail: "Liu Huang", patientId: "PT-001" }], exercises: [] };
    const state = normalizeState(legacy, "someone@fordham.edu");
    expect(state.version).toBe(3);
    expect(state.meta.owner).toBe("someone@fordham.edu");
    expect(state.registrations).toEqual([]);
    expect(state.audit[0].action).toBe("Open chart");
    expect("exercises" in state).toBe(false);
  });

  it("rejects unknown versions and empty patients", () => {
    expect(() => normalizeState({ version: 9, patients: [{}] })).toThrow();
    expect(() => normalizeState({ version: 3, patients: [] })).toThrow();
  });

  it("marks imported audit events and preserves the export envelope", () => {
    const state = buildInitialState(undefined, "a@fordham.edu");
    const withEvent = ehrReducer(state, { type: "openChart", patientId: "PT-001" }, meta);
    const text = JSON.stringify(exportEnvelope(withEvent, "a@fordham.edu"));
    const imported = importEnvelope(text, "b@fordham.edu");
    expect(imported.state.meta.owner).toBe("b@fordham.edu");
    expect(imported.state.audit.every((event) => event.provenance === "imported")).toBe(true);
    expect(imported.exportedBy).toBe("a@fordham.edu");
  });
});

describe("ehrReducer", () => {
  it("records audit events with context for entity-scoped actions", () => {
    const state = buildInitialState();
    const next = ehrReducer(state, { type: "createAppointment", appointment: { id: "APT-T", patientId: "PT-002", date: "2026-09-28", time: "10:00", duration: 30, provider: "Dr. Chen", visitType: "Follow-up", status: "Scheduled" } }, meta);
    expect(next.appointments.at(-1)?.id).toBe("APT-T");
    expect(next.audit[0].action).toBe(ACTION.CREATE_APPOINTMENT);
    expect(next.audit[0].context).toBe("APT-T");
    expect(next.audit[0].provenance).toBe("earned");
  });

  it("keeps signed notes when amending and emits a distinct action", () => {
    let state = buildInitialState();
    const signed: NoteVersion = { id: "NOTE-1", author: "Student", recordedAt: meta.at, kind: "Signed", subjective: "s", objective: "o", assessment: "a", plan: "p" };
    state = ehrReducer(state, { type: "saveNote", patientId: "PT-001", note: signed }, meta);
    const amendment: NoteVersion = { ...signed, id: "NOTE-2", kind: "Amendment", amendmentReason: "Correct laterality" };
    state = ehrReducer(state, { type: "saveNote", patientId: "PT-001", note: amendment }, meta);
    const notes = state.patients[0].notes;
    expect(notes.map((note) => note.kind)).toEqual(["Signed", "Amendment"]);
    expect(state.audit[0].action).toBe(ACTION.AMEND_SIGNED_NOTE);
    expect(state.audit[1].action).toBe(ACTION.SIGNED_SOAP_NOTE);
  });

  it("emits an override event when an alert is overridden", () => {
    const state = buildInitialState();
    const next = ehrReducer(state, { type: "placeOrder", order: { id: "ORD-1", patientId: "PT-001", type: "Medication", name: "Amoxicillin 500 mg capsule", details: "", status: "Submitted", orderedAt: meta.at, warnings: ["Critical: allergy"] }, overrideReason: "Documented tolerance in 2024" }, meta);
    expect(next.audit.map((event) => event.action)).toEqual([ACTION.OVERRIDE_ALERT, ACTION.PLACE_SIMULATED_ORDER]);
    expect(next.orders[0].overrideReason).toBe("Documented tolerance in 2024");
  });

  it("caps the audit trail at the configured limit", () => {
    let state = buildInitialState();
    for (let i = 0; i < 1100; i += 1) state = ehrReducer(state, { type: "openChart", patientId: "PT-001" }, meta);
    expect(state.audit.length).toBe(1000);
  });
});

describe("scoped reset", () => {
  it("clears A2 work but keeps signed notes and other assignments", () => {
    let state = buildInitialState(undefined, "a@fordham.edu");
    state = ehrReducer(state, { type: "createAppointment", appointment: { id: "APT-T", patientId: "PT-002", date: "2026-09-28", time: "10:00", duration: 30, provider: "Dr. Chen", visitType: "Follow-up", status: "Scheduled" } }, meta);
    state = ehrReducer(state, { type: "saveNote", patientId: "PT-001", note: { id: "NOTE-S", author: "S", recordedAt: meta.at, kind: "Signed", subjective: "s", objective: "o", assessment: "a", plan: "p" } }, meta);
    state = ehrReducer(state, { type: "saveNote", patientId: "PT-001", note: { id: "NOTE-D", author: "S", recordedAt: meta.at, kind: "Draft", subjective: "", objective: "", assessment: "", plan: "" } }, meta);
    state = ehrReducer(state, { type: "placeOrder", order: { id: "ORD-1", patientId: "PT-001", type: "Laboratory", name: "Basic metabolic panel", details: "", status: "Final", orderedAt: meta.at, result: "5.9" } }, meta);
    const reset = scopedReset(state, defaultAssignments[1], "learner", "2026-10-05T00:00:00.000Z");
    expect(reset.orders).toEqual([]);
    expect(reset.patients[0].notes.map((note) => note.kind)).toEqual(["Signed"]);
    expect(reset.appointments.some((item) => item.id === "APT-T")).toBe(true);
    expect(reset.audit.some((event) => event.action === ACTION.CREATE_APPOINTMENT)).toBe(true);
    expect(reset.audit.some((event) => event.action === ACTION.PLACE_SIMULATED_ORDER)).toBe(false);
    expect(reset.audit[0].action).toBe(ACTION.RESET_WORKSPACE);
    expect(reset.audit[0].context).toBe("FORDMS-A2");
  });

  it("full reset returns to the seed with a single reset event", () => {
    let state = buildInitialState(undefined, "a@fordham.edu");
    state = ehrReducer(state, { type: "openChart", patientId: "PT-001" }, meta);
    const reset = fullReset(state, "learner");
    expect(reset.audit.length).toBe(1);
    expect(reset.meta.owner).toBe("a@fordham.edu");
    expect(reset.patients.length).toBe(12);
  });
});
