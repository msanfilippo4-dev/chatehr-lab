import { describe, expect, it } from "vitest";
import { ACTION } from "@/lib/actions";
import { defaultAssignments } from "@/lib/assignments";
import { computeProgress, type ProgressEvent } from "@/lib/progress";

function event(partial: Partial<ProgressEvent> & { action: string }): ProgressEvent {
  return { id: partial.id ?? Math.random().toString(36).slice(2), timestamp: partial.timestamp ?? "2026-10-01T12:00:00.000Z", detail: partial.detail ?? "", provenance: partial.provenance ?? "earned", patientId: partial.patientId ?? null, context: partial.context ?? null, action: partial.action };
}

const a1 = defaultAssignments[0];
const a4 = defaultAssignments[3];

describe("computeProgress", () => {
  it("starts at zero", () => {
    const result = computeProgress(a1, []);
    expect(result.percent).toBe(0);
    expect(result.status).toBe("not_started");
    expect(result.totalUnits).toBe(7);
  });

  it("does not credit the same code example twice but credits both systems", () => {
    const events = [
      event({ action: ACTION.USE_CODE_EXAMPLE, context: "ICD-10-CM:M75.51", detail: "ICD-10-CM M75.51" }),
      event({ action: ACTION.USE_CODE_EXAMPLE, context: "ICD-10-CM:M75.51", detail: "ICD-10-CM M75.51" }),
    ];
    const once = computeProgress(a1, events);
    expect(once.requirements.find((r) => r.contextMatch === "ICD-10-CM")?.completedCount).toBe(1);
    expect(once.requirements.find((r) => r.contextMatch === "CPT")?.completedCount).toBe(0);
    const both = computeProgress(a1, [...events, event({ action: ACTION.USE_CODE_EXAMPLE, context: "CPT:99213", detail: "CPT 99213" })]);
    expect(both.requirements.find((r) => r.contextMatch === "CPT")?.completedCount).toBe(1);
  });

  it("requires three distinct readiness checkpoints", () => {
    const same = [1, 2, 3].map(() => event({ action: ACTION.UPDATE_IMPLEMENTATION_READINESS, context: "IMP-01" }));
    const readiness = (result: ReturnType<typeof computeProgress>) => result.requirements.find((r) => r.action === ACTION.UPDATE_IMPLEMENTATION_READINESS)!;
    expect(readiness(computeProgress(a4, same)).completedCount).toBe(1);
    const distinct = ["IMP-01", "IMP-02", "IMP-03"].map((context) => event({ action: ACTION.UPDATE_IMPLEMENTATION_READINESS, context }));
    expect(readiness(computeProgress(a4, distinct)).complete).toBe(true);
  });

  it("falls back to patient + detail for legacy events without context", () => {
    const events = [
      event({ action: ACTION.CREATE_APPOINTMENT, patientId: "PT-001", detail: "2026-09-28 09:00 Dr. Chen" }),
      event({ action: ACTION.CREATE_APPOINTMENT, patientId: "PT-001", detail: "2026-09-28 09:00 Dr. Chen" }),
      event({ action: ACTION.CREATE_APPOINTMENT, patientId: "PT-001", detail: "2026-09-29 09:00 Dr. Chen" }),
    ];
    const result = computeProgress(a1, events);
    expect(result.requirements.find((r) => r.action === ACTION.CREATE_APPOINTMENT)?.earnedCount).toBe(2);
  });

  it("splits imported from earned evidence and prefers earned", () => {
    const events = [
      event({ id: "a", action: ACTION.OPEN_CHART, patientId: "PT-001", provenance: "imported" }),
      event({ id: "b", action: ACTION.OPEN_CHART, patientId: "PT-001", provenance: "earned", timestamp: "2026-10-02T12:00:00.000Z" }),
      event({ id: "c", action: ACTION.ESCALATE_IDENTITY_REVIEW, patientId: "PT-001", provenance: "imported" }),
    ];
    const result = computeProgress(a1, events);
    expect(result.requirements[0].importedCount).toBe(0);
    expect(result.requirements[0].earnedCount).toBe(1);
    expect(result.requirements[1].importedCount).toBe(1);
    expect(result.importedUnits).toBe(1);
    expect(result.hasImportedEvidence).toBe(true);
  });

  it("ignores events before a reset cutoff", () => {
    const events = [event({ action: ACTION.OPEN_CHART, patientId: "PT-001", timestamp: "2026-10-01T00:00:00.000Z" })];
    expect(computeProgress(a1, events, { resetCutoff: "2026-10-02T00:00:00.000Z" }).completedUnits).toBe(0);
    expect(computeProgress(a1, events, { resetCutoff: "2026-09-30T00:00:00.000Z" }).completedUnits).toBe(1);
  });

  it("marks A1 ready when all seven units are met", () => {
    const events = [
      event({ action: ACTION.OPEN_CHART, patientId: "PT-001" }),
      event({ action: ACTION.ESCALATE_IDENTITY_REVIEW, patientId: "PT-001" }),
      event({ action: ACTION.RESOLVE_IDENTITY_REVIEW, context: "MPI-001" }),
      event({ action: ACTION.CREATE_APPOINTMENT, context: "APT-x" }),
      event({ action: ACTION.RESCHEDULE_APPOINTMENT, context: "APT-x" }),
      event({ action: ACTION.USE_CODE_EXAMPLE, context: "ICD-10-CM:I10" }),
      event({ action: ACTION.USE_CODE_EXAMPLE, context: "CPT:99213" }),
    ];
    const result = computeProgress(a1, events);
    expect(result.complete).toBe(true);
    expect(result.percent).toBe(100);
    expect(result.status).toBe("ready");
  });
});
