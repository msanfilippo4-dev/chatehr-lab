import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION } from "@/lib/actions";
import { defaultAssignments } from "@/lib/assignments";
import { AI_DRAFT_SENTENCES } from "@/lib/clinical/ai-review";
import { claimTotal, denialActionProblem, scrubClaim } from "@/lib/clinical/billing";
import { computeEws, sepsisScreen } from "@/lib/clinical/ews";
import { fiveRightsCheck, SIM_DAY, slotState } from "@/lib/clinical/mar";
import { defaultCourseConfig } from "@/lib/config/defaults";
import { mergeConfig } from "@/lib/config/merge";
import { normalizeState } from "@/lib/db";
import { computeProgress, toProgressEvent } from "@/lib/progress";
import { buildInitialState, SIMULATION_DATE } from "@/lib/seed";
import { drawerItems, marOrders, unitWristbands } from "@/lib/seeds/inpatient";
import { scoreAIReview, scoreAIReplies, scoreTickets, TICKET_KEY } from "@/lib/server/answer-keys";
import { ehrReducer, type ActionMeta } from "@/lib/store/reducer";
import { scopedReset } from "@/lib/store/reset";
import type { Claim, EHRState, SentenceClassification } from "@/lib/types";
import { legacyWorkspace } from "./fixtures/legacy-v3";

let counter = 0;
const meta: ActionMeta = { at: "2026-10-01T12:00:00.000Z", actor: "e2e@fordham.edu", role: "Analyst", makeId: (prefix) => `${prefix}-${++counter}` };
const run = (state: EHRState, ...actions: Parameters<typeof ehrReducer>[1][]) => actions.reduce((current, action) => ehrReducer(current, action, meta), state);
const byId = <T extends { id: string }>(items: T[], id: string) => items.find((item) => item.id === id)!;

describe("v3 → v4 workspace migration", () => {
  const legacy = legacyWorkspace();
  const upgraded = normalizeState(legacy, "student@fordham.edu");

  it("bumps the version and keeps every audit event, id, and collection", () => {
    expect(upgraded.version).toBe(4);
    expect(upgraded.audit.map((event) => event.id)).toEqual(["AUD-a", "AUD-b"]);
    expect(upgraded.identityReviews[0]).toMatchObject({ id: "MPI-001", status: "Resolved", decision: "Need more information" });
    expect(upgraded.registrations).toHaveLength(1);
    expect(upgraded.meta.configVersion).toBe(19);
    expect(upgraded.appointments.map((item) => item.id)).toEqual(expect.arrayContaining(["APT-001", "APT-student", "APT-006"]));
    expect(byId(upgraded.appointments, "APT-student").history).toHaveLength(2);
  });

  it("keeps identity fields and the PT-001/PT-012 duplicate signals", () => {
    const liu = byId(upgraded.patients, "PT-001");
    const dup = byId(upgraded.patients, "PT-012");
    expect(liu).toMatchObject({ mrn: "6105100", name: "Liu Huang", dob: "1984-03-19", address: "120 Example Avenue, New York, NY 10000", phone: "(212) 555-1100", duplicateCandidate: "PT-012" });
    expect(dup).toMatchObject({ mrn: "6105111", name: "Liu H.", dob: "1984-03-19", address: "120 Example Ave Apt 4B, New York, NY 10000", phone: "(917) 555-4812", duplicateCandidate: "PT-001" });
    for (const patient of legacy.patients as { id: string; mrn: string; name: string; dob: string }[]) {
      const after = byId(upgraded.patients, patient.id);
      expect([after.mrn, after.name, after.dob]).toEqual([patient.mrn, patient.name, patient.dob]);
    }
  });

  it("keeps learner notes after the seeded history and leaves registered patients alone", () => {
    const liu = byId(upgraded.patients, "PT-001");
    expect(liu.notes.map((note) => note.id)).toEqual(["NOTE-SEED-001A", "NOTE-SEED-001B", "NOTE-student-1"]);
    const registered = byId(upgraded.patients, "PT-013-abc");
    expect(registered.registeredAt).toBe("2026-09-22T15:05:00.000Z");
    expect(registered.problems[0].display).toBe("legacy");
  });

  it("replaces formula clinical data and placeholder addresses with the hand-authored charts", () => {
    const marcus = byId(upgraded.patients, "PT-002");
    expect(marcus.address).toContain("Adam Clayton Powell");
    expect(marcus.results.find((result) => result.name === "Potassium")).toMatchObject({ value: "6.1", unit: "mmol/L", loinc: "2823-3" });
    expect(byId(upgraded.patients, "PT-008").sex).toBe("Female");
    expect(byId(upgraded.patients, "PT-008").location).toContain("4 West");
  });

  it("merges new seed rows without overwriting learner changes", () => {
    expect(byId(upgraded.messages, "MSG-001").status).toBe("Routed");
    expect(upgraded.messages.map((item) => item.id)).toEqual(expect.arrayContaining(["MSG-004", "MSG-008"]));
    expect(byId(upgraded.tasks, "TASK-001").complete).toBe(true);
    expect(upgraded.marOrders.length).toBeGreaterThan(5);
    expect(upgraded.tickets).toHaveLength(10);
    expect(upgraded.claims.length).toBe(9);
    expect(upgraded.inBasket.length).toBeGreaterThan(8);
  });

  it("is idempotent and keeps A1 progress identical", () => {
    const again = normalizeState(upgraded, "student@fordham.edu");
    expect(again).toEqual(upgraded);
    const a1 = defaultAssignments[0];
    const before = computeProgress(a1, (legacy.audit as never[]).map(toProgressEvent));
    const after = computeProgress(a1, upgraded.audit.map(toProgressEvent));
    expect(after.completedUnits).toBe(before.completedUnits);
  });
});

describe("early warning score", () => {
  it("scores a stable patient low", () => {
    const result = computeEws({ rr: 16, spo2: 97, onOxygen: false, sbp: 128, hr: 76, consciousness: "Alert", temp: 36.8 });
    expect(result.total).toBe(0);
    expect(result.risk).toBe("Low");
  });

  it("flags a single red parameter as low-medium", () => {
    const result = computeEws({ rr: 16, spo2: 97, onOxygen: false, sbp: 128, hr: 76, consciousness: "Voice", temp: 36.8 });
    expect(result.total).toBe(3);
    expect(result.risk).toBe("Low-medium");
  });

  it("scores Sofia Petrov's deteriorating set as high and screens positive for sepsis", () => {
    const vitals = { temp: 38.7, hr: 118, sbp: 96, rr: 26, spo2: 91, onOxygen: false, consciousness: "New confusion" as const };
    const result = computeEws(vitals);
    expect(result.total).toBe(14);
    expect(result.risk).toBe("High");
    expect(sepsisScreen(vitals, true).positive).toBe(true);
    expect(sepsisScreen(vitals, false).positive).toBe(false);
  });

  it("reports missing parameters instead of scoring them", () => {
    const result = computeEws({ rr: 18, hr: 80 });
    expect(result.missing).toEqual(expect.arrayContaining(["SpO2", "Systolic BP", "Consciousness", "Temperature"]));
  });
});

describe("barcode five-rights check", () => {
  const state = buildInitialState();
  const sofia = byId(state.patients, "PT-008");
  const metoprolol = byId(marOrders, "MAR-008-1");
  const wristband = (id: string) => byId(unitWristbands, id);
  const item = (id: string) => byId(drawerItems, id);

  it("hard-stops the wrong patient", () => {
    const result = fiveRightsCheck({ order: metoprolol, slot: "09:00", patient: sofia, wristband: wristband("WB-ROOMMATE"), item: item("DRW-008-1"), administrations: [] });
    expect(result.blocking).toBe(true);
    expect(result.checks.find((check) => check.right === "Patient")?.message).toContain("WRONG PATIENT");
  });

  it("hard-stops a look-alike drug", () => {
    const result = fiveRightsCheck({ order: metoprolol, slot: "09:00", patient: sofia, wristband: wristband("WB-PT-008"), item: item("DRW-008-2"), administrations: [] });
    expect(result.blocking).toBe(true);
    expect(result.warnings.join(" ")).toContain("LOOK-ALIKE");
  });

  it("warns on a dose mismatch and a late dose and requires an override", () => {
    const result = fiveRightsCheck({ order: metoprolol, slot: "09:00", patient: sofia, wristband: wristband("WB-PT-008"), item: item("DRW-008-1"), administrations: [] });
    expect(result.blocking).toBe(false);
    expect(result.needsOverride).toBe(true);
    expect(result.late).toBe(true);
    expect(result.warnings.join(" ")).toContain("DOSE MISMATCH");
  });

  it("passes a correct scan inside the window", () => {
    const ceftriaxone = byId(marOrders, "MAR-008-2");
    const result = fiveRightsCheck({ order: ceftriaxone, slot: "10:00", patient: sofia, wristband: wristband("WB-PT-008"), item: item("DRW-008-3"), administrations: [] });
    expect(result.checks.every((check) => check.ok)).toBe(true);
    expect(result.needsOverride).toBe(false);
  });

  it("catches a PRN dose given too soon", () => {
    const prn = byId(marOrders, "MAR-008-5");
    const result = fiveRightsCheck({ order: prn, slot: "PRN", patient: sofia, wristband: wristband("WB-PT-008"), item: item("DRW-008-6"), administrations: [{ id: "x", orderId: prn.id, patientId: "PT-008", slot: "PRN", outcome: "Given", recordedAt: "", simTime: "07:00", performer: "RN" }] });
    expect(result.needsOverride).toBe(true);
  });

  it("uses the same simulated day as the seed", () => {
    expect(SIM_DAY).toBe(SIMULATION_DATE);
  });

  it("ignores earlier days' administrations for today's slots", () => {
    // The seeded 9/19–9/20 overrides must not mark today's 09:00 and 21:00 metoprolol doses as done.
    expect(slotState(metoprolol, "09:00", state.marAdministrations)).toBe("Overdue");
    expect(slotState(metoprolol, "21:00", state.marAdministrations)).toBe("Future");
    expect(slotState(byId(marOrders, "MAR-005-4"), "09:00", state.marAdministrations)).toBe("Overdue");
  });

  it("derives slot states from the simulated clock", () => {
    expect(slotState(metoprolol, "09:00", [])).toBe("Overdue");
    expect(slotState(byId(marOrders, "MAR-008-2"), "10:00", [])).toBe("Due");
    expect(slotState(metoprolol, "21:00", [])).toBe("Future");
    expect(slotState(byId(marOrders, "MAR-008-4"), "09:00", state.marAdministrations)).toBe("Given");
  });
});

describe("eMAR reducer", () => {
  it("records a scan, a hold, and an override with distinct audit actions", () => {
    let state = buildInitialState();
    state = run(state,
      { type: "marScan", scan: { id: "SCAN-1", orderId: "MAR-008-1", patientId: "PT-008", slot: "09:00", wristbandId: "WB-PT-008", itemId: "DRW-008-1", scannedAt: meta.at, warnings: ["DOSE MISMATCH"], blocking: false } },
      { type: "holdMedication", administration: { id: "MADM-1", orderId: "MAR-008-1", patientId: "PT-008", slot: "09:00", outcome: "Held", recordedAt: meta.at, simTime: "10:15", performer: "Nurse learner", reason: "Wrong strength dispensed; pharmacy notified" } },
      { type: "administerMedication", administration: { id: "MADM-2", orderId: "MAR-005-3", patientId: "PT-005", slot: "10:00", outcome: "Given with override", recordedAt: meta.at, simTime: "10:15", performer: "Nurse learner", reason: "Provider at bedside approved", warnings: ["x"] } },
    );
    expect(state.audit.map((event) => event.action)).toEqual([ACTION.OVERRIDE_MAR_WARNING, ACTION.ADMINISTER_MEDICATION, ACTION.HOLD_MEDICATION, ACTION.MAR_SCAN]);
    const a2 = defaultAssignments[1];
    const progress = computeProgress(a2, state.audit.map(toProgressEvent));
    expect(progress.requirements.find((r) => r.action === ACTION.MAR_SCAN)?.complete).toBe(true);
    expect(progress.requirements.find((r) => r.action === ACTION.ADMINISTER_MEDICATION)?.completedCount).toBe(1);
  });

  it("credits a hold alone through anyOf", () => {
    const state = run(buildInitialState(), { type: "holdMedication", administration: { id: "MADM-9", orderId: "MAR-008-1", patientId: "PT-008", slot: "09:00", outcome: "Held", recordedAt: meta.at, simTime: "10:15", performer: "RN", reason: "Held per provider order" } });
    const requirement = computeProgress(defaultAssignments[1], state.audit.map(toProgressEvent)).requirements.find((r) => r.action === ACTION.ADMINISTER_MEDICATION)!;
    expect(requirement.complete).toBe(true);
  });
});

describe("flowsheets and In Basket", () => {
  it("documents a flowsheet row and creates the escalation task", () => {
    const state = run(buildInitialState(), { type: "documentFlowsheet", entry: { id: "FS-new", patientId: "PT-008", time: "2026-09-21T10:15", temp: 38.7, hr: 118, sbp: 96, rr: 26, spo2: 91, consciousness: "New confusion", recordedBy: "RN", ews: 14, escalation: "Sepsis screen positive · rapid response called" }, task: { id: "TASK-RRT", patientId: "PT-008", title: "Rapid response", due: "2026-09-21", complete: false, owner: "Rapid response team" } });
    expect(state.flowsheets.at(-1)?.id).toBe("FS-new");
    expect(state.tasks.at(-1)?.owner).toBe("Rapid response team");
    expect(state.audit[0]).toMatchObject({ action: ACTION.DOCUMENT_FLOWSHEET, context: "FS-new" });
  });

  it("closes a critical result with a follow-up task and credits A2 loop closure", () => {
    const state = run(buildInitialState(), { type: "completeInBasket", itemId: "IB-001", outcome: "Acknowledge and create follow-up task", task: { id: "TASK-K", patientId: "PT-002", title: "Repeat BMP today", due: "2026-09-21", complete: false, owner: "Dr. Lin Chen" } });
    expect(byId(state.inBasket, "IB-001").status).toBe("Done");
    expect(state.audit.map((event) => event.action)).toEqual([ACTION.COMPLETE_INBASKET_ITEM, ACTION.REVIEW_RESULT_FOLLOWUP]);
  });

  it("records AI reply review and resolves the linked portal message", () => {
    const state = run(buildInitialState(), { type: "completeInBasket", itemId: "IB-008", outcome: "Discard and route to clinician", reviewIssues: ["Unsafe or incorrect clinical advice"] });
    expect(state.audit.map((event) => event.action)).toContain(ACTION.REVIEW_AI_DRAFT_REPLY);
    expect(state.audit.map((event) => event.action)).toContain(ACTION.ROUTE_PORTAL_MESSAGE);
    expect(byId(state.messages, "MSG-006").status).toBe("Routed");
    const scores = scoreAIReplies(state.inBasket);
    expect(scores[0]).toMatchObject({ itemId: "IB-008", safe: true, issuesFound: 1 });
  });

  it("co-signs the linked note from the In Basket", () => {
    const state = run(buildInitialState(), { type: "completeInBasket", itemId: "IB-007", outcome: "Co-sign note", cosigner: "Dr. Chen" });
    expect(byId(byId(state.patients, "PT-011").notes, "NOTE-SEED-011A").cosignedBy).toBe("Dr. Chen");
  });
});

describe("claim scrubber", () => {
  const state = buildInitialState();
  const claim = (id: string) => byId(state.claims, id);

  it("finds exactly one edit on each seeded charge-review claim except the clean one", () => {
    expect(scrubClaim(claim("CLM-26-0412")).map((edit) => edit.rule)).toEqual(["MISSING_DX_POINTER"]);
    expect(scrubClaim(claim("CLM-26-0415")).map((edit) => edit.rule)).toEqual(["MOD25_DOCUMENTATION"]);
    expect(scrubClaim(claim("CLM-26-0410")).map((edit) => edit.rule)).toEqual(["ELIGIBILITY_INACTIVE"]);
    expect(scrubClaim(claim("CLM-26-0418")).map((edit) => edit.rule)).toEqual(["REFERRAL_MISSING"]);
    expect(scrubClaim(claim("CLM-26-0402"))).toEqual([]);
  });

  it("clears the edit after correction", () => {
    const fixed: Claim = { ...claim("CLM-26-0412"), lines: claim("CLM-26-0412").lines.map((line) => (line.line === 2 ? { ...line, dxPointers: ["E11.9"] } : line)) };
    expect(scrubClaim(fixed)).toEqual([]);
    expect(scrubClaim({ ...claim("CLM-26-0415"), separateEmDocumented: true })).toEqual([]);
    expect(scrubClaim({ ...claim("CLM-26-0418"), referralNumber: "REF-1" })).toEqual([]);
    expect(claimTotal(claim("CLM-26-0412"))).toBe(342);
  });

  it("blocks billing the patient for a CO denial", () => {
    expect(denialActionProblem("CO", "Transfer balance to patient")).toMatch(/contractual/);
    expect(denialActionProblem("CO", "Correct and resubmit as a corrected claim")).toBeNull();
  });

  it("records correct, submit, and denial work in the audit trail", () => {
    const next = run(state,
      { type: "scrubClaim", claimId: "CLM-26-0412", editCount: 1, summary: "Missing pointer" },
      { type: "correctClaim", claimId: "CLM-26-0412", changes: { lines: [] }, description: "Pointed line 2 to E11.9" },
      { type: "submitClaim", claimId: "CLM-26-0412" },
      { type: "workDenial", claimId: "CLM-26-0388", action: "Correct and resubmit as a corrected claim", note: "Added E78.5 / R73.03 pointers" },
    );
    expect(byId(next.claims, "CLM-26-0412").status).toBe("Submitted");
    expect(byId(next.claims, "CLM-26-0388").status).toBe("Denial worked");
    const progress = computeProgress(defaultAssignments[2], next.audit.map(toProgressEvent));
    for (const action of [ACTION.CORRECT_CLAIM, ACTION.SUBMIT_CLAIM, ACTION.WORK_DENIAL]) expect(progress.requirements.find((r) => r.action === action)?.complete).toBe(true);
  });
});

describe("analyst tickets", () => {
  const resolve = (state: EHRState, id: string, rootIndex = 1) => {
    const ticket = byId(state.tickets, id);
    return run(state,
      { type: "triageTicket", ticketId: id, category: "Safety", priority: "High", owner: "Me (clinical informatics analyst)" },
      { type: "recordTicketEvidence", ticketId: id, evidenceId: "E1", note: "" },
      { type: "recordTicketEvidence", ticketId: id, evidenceId: "E4", note: "" },
      { type: "resolveTicket", ticketId: id, resolution: { rootCause: ticket.rootCauseOptions[rootIndex], detail: "detail", fix: "fix", notify: [ticket.notifyOptions[0]], communication: "message" } },
    );
  };

  it("credits only the assignment's own tickets", () => {
    let state = buildInitialState();
    state = resolve(state, "TKT-1041");
    state = resolve(state, "TKT-1044");
    const a2 = computeProgress(defaultAssignments[1], state.audit.map(toProgressEvent)).requirements.find((r) => r.action === ACTION.RESOLVE_TICKET)!;
    const a3 = computeProgress(defaultAssignments[2], state.audit.map(toProgressEvent)).requirements.find((r) => r.action === ACTION.RESOLVE_TICKET)!;
    expect(a2.completedCount).toBe(1);
    expect(a3.completedCount).toBe(1);
    state = resolve(state, "TKT-1042");
    expect(computeProgress(defaultAssignments[1], state.audit.map(toProgressEvent)).requirements.find((r) => r.action === ACTION.RESOLVE_TICKET)!.complete).toBe(true);
  });

  it("scores root cause, evidence, triage, and notification on the server", () => {
    let state = resolve(buildInitialState(), "TKT-1041");
    state = resolve(state, "TKT-1042", 0);
    const [first, second] = scoreTickets(state.tickets, "A2");
    expect(first).toMatchObject({ id: "TKT-1041", rootCauseCorrect: true, evidenceHits: 1, distractorsCited: 1, categoryOk: true, priorityOk: true });
    expect(first.notifyMissing).toEqual(TICKET_KEY["TKT-1041"].mustNotify);
    expect(second.rootCauseCorrect).toBe(false);
  });

  it("keeps other assignments' ticket evidence during a scoped reset", () => {
    let state = resolve(buildInitialState(), "TKT-1041");
    state = resolve(state, "TKT-1044");
    const reset = scopedReset(state, defaultAssignments[1], "learner");
    expect(byId(reset.tickets, "TKT-1041").status).toBe("New");
    expect(byId(reset.tickets, "TKT-1044").status).toBe("Resolved");
    expect(reset.audit.some((event) => event.action === ACTION.RESOLVE_TICKET && event.context === "A3:TKT-1044")).toBe(true);
    expect(reset.audit.some((event) => event.action === ACTION.RESOLVE_TICKET && event.context === "A2:TKT-1041")).toBe(false);
  });

  it("has an answer key for every seeded ticket with the key option present", () => {
    for (const ticket of buildInitialState().tickets) {
      const key = TICKET_KEY[ticket.id];
      expect(key, ticket.id).toBeDefined();
      expect(ticket.rootCauseOptions[key.rootCauseIndex]).toBeTruthy();
      for (const evidence of key.evidence) expect(ticket.evidenceOptions.some((option) => option.id === evidence)).toBe(true);
      for (const name of key.mustNotify) expect(ticket.notifyOptions, ticket.id).toContain(name);
    }
  });
});

describe("AI draft review scoring", () => {
  const classify = (labels: Record<string, SentenceClassification["label"]>, citation = "S1"): SentenceClassification[] =>
    AI_DRAFT_SENTENCES.map((sentence) => ({ sentenceId: sentence.id, label: labels[sentence.id] ?? "Supported", citation }));

  it("counts planted errors found, exact classes, and false flags", () => {
    const record = { id: "R", patientId: "PT-001", findings: [], disposition: "Reject and redraft from the source", note: "", reviewedAt: meta.at, classifications: classify({ D2: "Contradicts source", D6: "Unsupported", D7: "Omission", D9: "Unsupported", D1: "Unsupported" }) };
    const score = scoreAIReview(record)!;
    expect(score.plantedTotal).toBe(6);
    expect(score.plantedFound).toBe(4);
    expect(score.exactClass).toBe(3);
    expect(score.falseFlags).toBe(1);
    expect(score.missed).toEqual(["D10", "D12"]);
  });

  it("records a sentence-level summary in the audit trail without the key", () => {
    const state = run(buildInitialState(), { type: "recordAIReview", record: { id: "R2", patientId: "PT-001", findings: [], disposition: "Edit and retain with corrections", note: "n", reviewedAt: meta.at, draftId: "AIDRAFT-LIU-0921", classifications: classify({ D2: "Contradicts source" }) } });
    expect(state.audit[0].action).toBe(ACTION.AI_DRAFT_REVIEW);
    expect(state.audit[0].detail).toContain("reviewed 12 sentences, flagged 1");
  });
});

describe("published configuration upgrade", () => {
  const legacyConfig = JSON.parse(JSON.stringify(defaultCourseConfig));
  delete legacyConfig.meta.contentRevision;
  legacyConfig.meta.version = 19;
  legacyConfig.simulatedRoles = [
    { role: "Front Desk", views: ["Worklist", "Schedule", "Registration", "Patients", "MPI", "Assignments"] },
    { role: "Clinical", views: ["Worklist", "Patients", "Encounter", "Orders & Results", "Portal", "HIE", "AI Review", "Assignments"] },
    { role: "HIM", views: ["Worklist", "Patients", "MPI", "HIE", "Audit Review", "Analytics", "Assignments"] },
    { role: "Patient", views: ["Portal", "Assignments"] },
    { role: "Analyst", views: ["Worklist", "Analytics", "Query Studio", "HIE", "Assignments"] },
    { role: "Implementation Lead", views: ["Worklist", "Analytics", "Implementation", "AI Review", "Assignments"] },
  ];
  legacyConfig.organizations = [{ id: "ORG-CH", name: "Crescent Health", type: "Integrated delivery network (fictional)" }];
  legacyConfig.insurers = legacyConfig.insurers.filter((item: { id: string }) => ["INS-MCD", "INS-MCR", "INS-CPPO", "INS-SELF"].includes(item.id));
  legacyConfig.icd10Catalog.push({ ...legacyConfig.icd10Catalog[0], code: "Z99.16", display: "Teaching example added in test" });
  legacyConfig.assignments = legacyConfig.assignments.map((assignment: { id: string; guide?: unknown; contentRevision?: number; requirements: unknown[]; dueAt: string }) => {
    const copy = { ...assignment, guide: undefined, contentRevision: undefined };
    if (assignment.id === "FORDMS-A2") return { ...copy, requirements: [{ action: ACTION.SIGNED_SOAP_NOTE, label: "old", minimumCount: 1 }], dueAt: "2026-11-03T23:59:00-05:00" };
    return copy;
  });

  it("adds the new views and roles, mapping Clinical to Nurse and Physician/APP", () => {
    const { config } = mergeConfig(defaultCourseConfig, legacyConfig);
    const views = (role: string) => config.simulatedRoles.find((item) => item.role === role)?.views ?? [];
    expect(views("Analyst")).toEqual(expect.arrayContaining(["Tickets", "Query Studio"]));
    expect(views("Nurse")).toEqual(expect.arrayContaining(["eMAR", "Flowsheets", "In Basket", "Portal"]));
    expect(views("Physician/APP")).toEqual(expect.arrayContaining(["Encounter", "In Basket", "AI Review"]));
    expect(views("Revenue Cycle")).toContain("Billing");
    expect(config.meta.contentRevision).toBe(5);
    expect(config.meta.version).toBe(19);
  });

  it("upgrades assignment content but keeps published scheduling fields", () => {
    const { config } = mergeConfig(defaultCourseConfig, legacyConfig);
    const a2 = config.assignments.find((item) => item.id === "FORDMS-A2")!;
    expect(a2.dueAt).toBe("2026-11-03T23:59:00-05:00");
    expect(a2.requirements.map((item) => item.action)).toContain(ACTION.MAR_SCAN);
    expect(a2.guide?.parts.length).toBeGreaterThan(2);
    const a1 = config.assignments.find((item) => item.id === "FORDMS-A1")!;
    expect(a1.requirements).toEqual(defaultAssignments[0].requirements);
  });

  it("unions catalogs and renames legacy defaults while keeping published rows", () => {
    const { config } = mergeConfig(defaultCourseConfig, legacyConfig);
    expect(config.organizations[0].name).toBe("Fordham Health");
    expect(config.insurers.map((item) => item.id)).toEqual(expect.arrayContaining(["INS-MMC", "INS-MA", "INS-CHMO"]));
    expect(config.icd10Catalog.some((item) => item.code === "Z99.16")).toBe(true);
  });

  it("leaves a revision-5 config exactly as published", () => {
    const current = JSON.parse(JSON.stringify(defaultCourseConfig));
    current.simulatedRoles = [{ role: "Analyst", views: ["Tickets", "Assignments"] }];
    const { config } = mergeConfig(defaultCourseConfig, current);
    expect(config.simulatedRoles).toEqual([{ role: "Analyst", views: ["Tickets", "Assignments"] }]);
  });

  it("keeps every assignment at 100 rubric points and within the 1–2 hour budget", () => {
    for (const assignment of defaultAssignments) {
      expect(assignment.rubric.reduce((sum, item) => sum + item.points, 0)).toBe(100);
      const minutes = assignment.guide!.parts.reduce((sum, part) => sum + part.minutes, 0);
      expect(minutes).toBe(assignment.estimatedMinutes);
      expect(minutes).toBeGreaterThanOrEqual(60);
      expect(minutes).toBeLessThanOrEqual(120);
    }
  });
});

describe("answer-key isolation", () => {
  it("is never imported by browser code", () => {
    const root = join(__dirname, "../..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|mjs)$/.test(name) && readFileSync(path, "utf8").includes("answer-keys")) offenders.push(path);
      }
    };
    for (const dir of ["components", "hooks"]) walk(join(root, dir));
    expect(offenders).toEqual([]);
  });
});
