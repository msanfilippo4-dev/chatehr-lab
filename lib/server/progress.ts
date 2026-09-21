import type { CourseAssignment } from "../config/types";
import { computeProgress, type AssignmentProgressResult, type ProgressEvent } from "../progress";
import type { AuditEvent } from "../types";
import type { AdminClient } from "./course-db";

export interface ResetMarkers { [assignmentId: string]: string }

export function resetCutoffFor(markers: ResetMarkers | null | undefined, assignmentId: string): string | null {
  if (!markers) return null;
  const candidates = [markers[assignmentId], markers["*"]].filter(Boolean) as string[];
  if (!candidates.length) return null;
  return candidates.sort().at(-1) ?? null;
}

export async function loadEventsForUser(admin: AdminClient, email: string): Promise<ProgressEvent[]> {
  const { data, error } = await admin
    .from("ehr_activity_events")
    .select("event_id,action,patient_id,context,detail,occurred_at,provenance")
    .eq("email", email)
    .order("occurred_at", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.event_id,
    action: row.action,
    patientId: row.patient_id,
    context: row.context,
    detail: row.detail ?? "",
    timestamp: row.occurred_at,
    provenance: row.provenance === "imported" ? "imported" : "earned",
  }));
}

export async function loadResetMarkers(admin: AdminClient, email: string): Promise<ResetMarkers> {
  const { data, error } = await admin.from("ehr_user_workspaces").select("reset_markers").eq("email", email).maybeSingle();
  if (error) {
    console.error("[fordms] reset markers unavailable", error.message);
    return {};
  }
  return (data?.reset_markers as ResetMarkers | null) ?? {};
}

export interface ServerProgressRow {
  email: string;
  assignment_id: string;
  progress: AssignmentProgressResult;
  percent_complete: number;
  status: string;
  earned_units: number;
  imported_units: number;
  total_units: number;
  computed_from: "server";
  config_version: number;
  completed_at: string | null;
  updated_at: string;
}

export function buildProgressRows(email: string, assignments: CourseAssignment[], events: ProgressEvent[], markers: ResetMarkers, configVersion: number, now = new Date().toISOString()): ServerProgressRow[] {
  return assignments.map((assignment) => {
    const progress = computeProgress(assignment, events, { resetCutoff: resetCutoffFor(markers, assignment.id) });
    return {
      email,
      assignment_id: assignment.id,
      progress,
      percent_complete: progress.percent,
      status: progress.status,
      earned_units: progress.earnedUnits,
      imported_units: progress.importedUnits,
      total_units: progress.totalUnits,
      computed_from: "server",
      config_version: configVersion,
      completed_at: progress.complete ? now : null,
      updated_at: now,
    };
  });
}

export async function computeServerProgress(admin: AdminClient, email: string, assignments: CourseAssignment[], configVersion: number) {
  const [events, markers] = await Promise.all([loadEventsForUser(admin, email), loadResetMarkers(admin, email)]);
  const rows = buildProgressRows(email, assignments, events, markers, configVersion);
  const { error } = await admin.from("ehr_assignment_progress").upsert(rows, { onConflict: "email,assignment_id" });
  if (error) throw error;
  return { rows, events, markers };
}

/** Map workspace audit events to activity-event rows for the mirror table. */
export function toEventRows(email: string, audit: AuditEvent[], now: string) {
  return audit
    .filter((event) => event && event.id && event.action)
    .map((event) => ({
      email,
      event_id: String(event.id).slice(0, 64),
      action: String(event.action).slice(0, 80),
      patient_id: event.patientId ? String(event.patientId).slice(0, 40) : null,
      detail: String(event.detail ?? "").slice(0, 600),
      context: event.context ? String(event.context).slice(0, 200) : null,
      provenance: event.provenance === "imported" ? "imported" : "earned",
      actor_role: event.actorRole ? String(event.actorRole).slice(0, 40) : null,
      occurred_at: typeof event.timestamp === "string" && !Number.isNaN(Date.parse(event.timestamp)) ? event.timestamp : now,
    }));
}
