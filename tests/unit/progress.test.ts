import { describe, expect, it } from "vitest";
import { ACTION } from "@/lib/actions";
import { defaultAssignments } from "@/lib/assignments";
import { computeProgress, mergeSavedProgress, type ProgressEvent } from "@/lib/progress";

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

describe("assignment progress from other tabs", () => {
  const codeEvents = [
    event({ id: "ICD", action: ACTION.USE_CODE_EXAMPLE, context: "ICD-10-CM:M75.51", detail: "ICD-10-CM M75.51" }),
    event({ id: "CPT", action: ACTION.USE_CODE_EXAMPLE, context: "CPT:99214", detail: "CPT 99214" }),
  ];
  const saved = (events: ProgressEvent[], updated_at = "2026-10-06T10:00:00.000Z") => ({ progress: computeProgress(a1, events), updated_at });

  it("shows both saved code requirements and their guide evidence in a tab with an older workspace", () => {
    const merged = mergeSavedProgress(computeProgress(a1, []), saved(codeEvents));
    expect(merged.completedUnits).toBe(2);
    expect(merged.requirements.filter((item) => item.action === ACTION.USE_CODE_EXAMPLE).map((item) => [item.complete, item.latestEvidence?.id])).toEqual([[true, "ICD"], [true, "CPT"]]);
  });

  it("keeps immediate local credit while a server save is still pending", () => {
    const local = computeProgress(a1, codeEvents);
    expect(mergeSavedProgress(local, saved([]))).toEqual(local);
  });

  it("does not double-count a repeated code or add local and server copies of the same action", () => {
    const local = computeProgress(a1, codeEvents);
    const repeated = [...codeEvents, { ...codeEvents[0], id: "REPEAT", timestamp: "2026-10-06T09:00:00.000Z" }];
    const result = mergeSavedProgress(local, saved(repeated));
    expect(result.completedUnits).toBe(2);
    expect(result.earnedUnits).toBe(2);
  });

  it("ignores server evidence calculated before an assignment reset", () => {
    const local = computeProgress(a1, []);
    expect(mergeSavedProgress(local, saved(codeEvents), "2026-10-06T11:00:00.000Z")).toEqual(local);
  });

  it("does not reuse a saved count after a requirement changes", () => {
    const changed = { requirements: a1.requirements.map((item) => item.contextMatch === "ICD-10-CM" ? { ...item, minimumCount: 2 } : item) };
    const result = mergeSavedProgress(computeProgress(changed, []), saved(codeEvents));
    expect(result.requirements.find((item) => item.contextMatch === "ICD-10-CM")?.completedCount).toBe(0);
    expect(result.requirements.find((item) => item.contextMatch === "CPT")?.completedCount).toBe(1);
  });

  it("prefers earned evidence to an imported copy", () => {
    const imported = computeProgress(a1, codeEvents.map((item) => ({ ...item, provenance: "imported" as const })));
    const result = mergeSavedProgress(imported, saved(codeEvents));
    expect(result.earnedUnits).toBe(2);
    expect(result.importedUnits).toBe(0);
  });

  it("preserves a saved multi-item requirement without inflating its count", () => {
    const readiness = ["IMP-01", "IMP-02", "IMP-03"].map((context) => event({ action: ACTION.UPDATE_IMPLEMENTATION_READINESS, context }));
    const result = mergeSavedProgress(computeProgress(a4, []), { progress: computeProgress(a4, readiness), updated_at: "2026-10-06T10:00:00.000Z" });
    expect(result.requirements.find((item) => item.action === ACTION.UPDATE_IMPLEMENTATION_READINESS)?.completedCount).toBe(3);
  });
});
