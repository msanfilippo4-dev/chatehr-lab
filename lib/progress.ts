import { ACTION_CONTEXT, isActionId } from "./actions";
import type { AssignmentProgressStatus, AuditEvent, Provenance } from "./types";

export interface AssignmentRequirement {
  action: string;
  label: string;
  minimumCount: number;
  /** When set, only events whose context (or legacy detail) starts with this prefix count. */
  contextMatch?: string;
}

export interface ProgressEvent {
  id: string;
  action: string;
  patientId?: string | null;
  context?: string | null;
  detail: string;
  timestamp: string;
  provenance: Provenance;
}

export interface RequirementProgress extends AssignmentRequirement {
  earnedCount: number;
  importedCount: number;
  completedCount: number;
  complete: boolean;
  evidenceEventIds: string[];
  latestEvidence?: ProgressEvent;
}

export interface AssignmentProgressResult {
  requirements: RequirementProgress[];
  earnedUnits: number;
  importedUnits: number;
  completedUnits: number;
  totalUnits: number;
  percent: number;
  complete: boolean;
  status: AssignmentProgressStatus;
  hasImportedEvidence: boolean;
}

export interface ProgressOptions {
  /** ISO timestamp; events strictly before it are ignored (scoped reset). */
  resetCutoff?: string | null;
}

export function toProgressEvent(event: AuditEvent): ProgressEvent {
  return {
    id: event.id,
    action: event.action,
    patientId: event.patientId ?? null,
    context: event.context ?? null,
    detail: event.detail ?? "",
    timestamp: event.timestamp,
    provenance: event.provenance ?? "earned",
  };
}

function dedupKey(event: ProgressEvent): string {
  const kind = isActionId(event.action) ? ACTION_CONTEXT[event.action] : "entity";
  if (kind === "none") return `${event.action}|${event.id}`;
  if (kind === "patient") return `${event.action}|${event.patientId ?? event.detail}`;
  if (event.context) return `${event.action}|${event.context}`;
  // Legacy events (recorded before contexts existed) fall back to patient + detail.
  return `${event.action}|${event.patientId ?? ""}|${event.detail}`;
}

function matchesRequirement(requirement: AssignmentRequirement, event: ProgressEvent): boolean {
  if (event.action !== requirement.action) return false;
  if (!requirement.contextMatch) return true;
  const prefix = requirement.contextMatch.toLowerCase();
  return (event.context ?? "").toLowerCase().startsWith(prefix) || event.detail.toLowerCase().startsWith(prefix);
}

export function computeProgress(
  assignment: { requirements: AssignmentRequirement[] },
  events: ProgressEvent[],
  options: ProgressOptions = {},
): AssignmentProgressResult {
  const cutoff = options.resetCutoff ? Date.parse(options.resetCutoff) : null;
  const usable = events
    .filter((event) => event.id && event.action)
    .filter((event) => cutoff === null || Number.isNaN(cutoff) || Date.parse(event.timestamp) >= cutoff)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const requirements: RequirementProgress[] = assignment.requirements.map((requirement) => {
    const seen = new Map<string, ProgressEvent>();
    for (const event of usable) {
      if (!matchesRequirement(requirement, event)) continue;
      const key = dedupKey(event);
      const existing = seen.get(key);
      // Earned evidence outranks imported evidence for the same entity.
      if (!existing || (existing.provenance === "imported" && event.provenance === "earned")) seen.set(key, event);
    }
    const credited = Array.from(seen.values());
    const earnedCount = credited.filter((event) => event.provenance === "earned").length;
    const importedCount = credited.length - earnedCount;
    const completedCount = Math.min(credited.length, requirement.minimumCount);
    const evidence = credited.slice(0, requirement.minimumCount);
    return {
      ...requirement,
      earnedCount,
      importedCount,
      completedCount,
      complete: credited.length >= requirement.minimumCount,
      evidenceEventIds: evidence.map((event) => event.id),
      latestEvidence: credited[credited.length - 1],
    };
  });

  const totalUnits = requirements.reduce((sum, item) => sum + item.minimumCount, 0);
  const completedUnits = requirements.reduce((sum, item) => sum + item.completedCount, 0);
  const importedUnits = requirements.reduce((sum, item) => sum + Math.min(item.importedCount, item.minimumCount), 0);
  const earnedUnits = completedUnits - importedUnits;
  const complete = requirements.every((item) => item.complete);
  const status: AssignmentProgressStatus = complete ? "ready" : completedUnits > 0 ? "in_progress" : "not_started";
  return {
    requirements,
    earnedUnits,
    importedUnits,
    completedUnits,
    totalUnits,
    percent: totalUnits ? Math.round((completedUnits / totalUnits) * 100) : 0,
    complete,
    status,
    hasImportedEvidence: importedUnits > 0,
  };
}
