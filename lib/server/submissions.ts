import { createHash } from "node:crypto";
import type { CourseAssignment } from "../config/types";
import type { AssignmentProgressResult, ProgressEvent } from "../progress";
import type { EHRState, Patient } from "../types";
import type { AdminClient } from "./course-db";
import { ApiError } from "./errors";

export interface EvidenceItem {
  eventId: string;
  action: string;
  label: string;
  timestamp: string;
  detail: string;
  context: string | null;
  provenance: "earned" | "imported";
  patient: { id: string; name: string; mrn: string } | null;
}

export function buildEvidence(assignment: CourseAssignment, progress: AssignmentProgressResult, events: ProgressEvent[], workspace: EHRState | null): EvidenceItem[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const patients = new Map<string, Patient>((workspace?.patients ?? []).map((patient) => [patient.id, patient]));
  const evidence: EvidenceItem[] = [];
  for (const requirement of progress.requirements) {
    for (const eventId of requirement.evidenceEventIds) {
      const event = byId.get(eventId);
      if (!event) continue;
      const patient = event.patientId ? patients.get(event.patientId) : null;
      evidence.push({
        eventId: event.id,
        action: event.action,
        label: requirement.label,
        timestamp: event.timestamp,
        detail: event.detail,
        context: event.context ?? null,
        provenance: event.provenance,
        patient: patient ? { id: patient.id, name: patient.name, mrn: patient.mrn } : null,
      });
    }
  }
  return evidence;
}

export function workspaceHash(workspace: unknown): string {
  return createHash("sha256").update(JSON.stringify(workspace ?? null)).digest("hex");
}

export async function createSubmissionVersion(admin: AdminClient, input: {
  email: string;
  assignment: CourseAssignment;
  reflection: string;
  evidence: EvidenceItem[];
  progress: AssignmentProgressResult;
  configVersion: number;
  late: boolean;
  workspace: unknown;
}) {
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await admin
    .from("ehr_assignment_submissions")
    .select("id,version,status,score,feedback,graded_by,graded_at")
    .eq("email", input.email)
    .eq("assignment_id", input.assignment.id)
    .maybeSingle();
  if (existingError) throw existingError;
  const version = (existing?.version ?? 0) + 1;

  const { data: header, error: headerError } = await admin.from("ehr_assignment_submissions").upsert({
    email: input.email,
    assignment_id: input.assignment.id,
    reflection: input.reflection,
    evidence: input.evidence,
    status: "submitted",
    version,
    score: null,
    rubric_total: null,
    feedback: null,
    submitted_at: now,
    graded_at: null,
    graded_by: null,
    returned_at: null,
    returned_by: null,
    return_comment: null,
    late: input.late,
    config_version: input.configVersion,
  }, { onConflict: "email,assignment_id" }).select("id").maybeSingle();
  if (headerError) throw headerError;
  if (!header) throw new ApiError(500, "The submission could not be recorded.", "SUBMIT_FAILED");

  const { data: versionRow, error: versionError } = await admin.from("ehr_submission_versions").insert({
    submission_id: header.id,
    email: input.email,
    assignment_id: input.assignment.id,
    version,
    reflection: input.reflection,
    evidence: input.evidence,
    progress_snapshot: input.progress,
    config_version: input.configVersion,
    workspace_sha256: workspaceHash(input.workspace),
    late: input.late,
    submitted_at: now,
  }).select("id").maybeSingle();
  if (versionError) console.error("[fordms] submission version not recorded", versionError.message);
  if (versionRow) await admin.from("ehr_assignment_submissions").update({ current_version_id: versionRow.id }).eq("id", header.id);

  await admin.from("ehr_grade_events").insert({
    submission_id: header.id,
    version,
    email: input.email,
    assignment_id: input.assignment.id,
    event_type: "submitted",
    actor: input.email,
    score: existing?.score ?? null,
    feedback: existing?.status === "graded" ? `Resubmission supersedes version ${existing.version} (score ${existing.score ?? "—"}).` : null,
  });

  return { submissionId: header.id as string, version, submittedAt: now };
}

export async function applyRubricGrade(admin: AdminClient, input: {
  email: string;
  assignment: CourseAssignment;
  rubric?: { criterionIndex: number; pointsAwarded: number; comment?: string }[];
  score?: number;
  feedback: string;
  finalize: boolean;
  actor: string;
}) {
  const { data: header, error } = await admin
    .from("ehr_assignment_submissions")
    .select("id,version,status,score")
    .eq("email", input.email)
    .eq("assignment_id", input.assignment.id)
    .maybeSingle();
  if (error) throw error;
  if (!header) throw new ApiError(404, "No submitted assignment was found for that student.", "NOT_FOUND");

  let score = input.score ?? null;
  let rubricRows: { submission_id: string; version: number; criterion_index: number; criterion: string; points_possible: number; points_awarded: number; comment: string | null; graded_by: string; graded_at: string }[] = [];
  const now = new Date().toISOString();
  if (input.rubric && input.rubric.length) {
    const seen = new Set<number>();
    for (const item of input.rubric) {
      const criterion = input.assignment.rubric[item.criterionIndex];
      if (!criterion) throw new ApiError(400, `Rubric criterion ${item.criterionIndex} does not exist for ${input.assignment.id}.`, "VALIDATION");
      if (seen.has(item.criterionIndex)) throw new ApiError(400, "Each rubric criterion may be scored once.", "VALIDATION");
      seen.add(item.criterionIndex);
      if (item.pointsAwarded > criterion.points) throw new ApiError(400, `${criterion.criterion} allows at most ${criterion.points} points.`, "VALIDATION");
      rubricRows.push({ submission_id: header.id, version: header.version, criterion_index: item.criterionIndex, criterion: criterion.criterion, points_possible: criterion.points, points_awarded: item.pointsAwarded, comment: item.comment ?? null, graded_by: input.actor, graded_at: now });
    }
    if (input.finalize && seen.size !== input.assignment.rubric.length) throw new ApiError(400, "Score every rubric criterion before finalizing the grade.", "VALIDATION");
    score = Math.round(rubricRows.reduce((sum, row) => sum + row.points_awarded, 0) * 100) / 100;
  }
  if (score == null) throw new ApiError(400, "Provide rubric scores or an overall score.", "VALIDATION");

  if (rubricRows.length) {
    const { error: rubricError } = await admin.from("ehr_rubric_scores").upsert(rubricRows, { onConflict: "submission_id,version,criterion_index" });
    if (rubricError) throw rubricError;
  }

  const update = input.finalize
    ? { score, rubric_total: score, feedback: input.feedback, status: "graded", graded_at: now, graded_by: input.actor, returned_at: null, returned_by: null, return_comment: null }
    : { rubric_total: score, feedback: input.feedback };
  const { data, error: updateError } = await admin.from("ehr_assignment_submissions").update(update).eq("id", header.id).select("assignment_id,status,score,rubric_total,feedback,graded_at,version").maybeSingle();
  if (updateError) throw updateError;

  await admin.from("ehr_grade_events").insert({
    submission_id: header.id,
    version: header.version,
    email: input.email,
    assignment_id: input.assignment.id,
    event_type: input.finalize ? (header.score == null ? "graded" : "regraded") : "comment",
    actor: input.actor,
    score,
    rubric: rubricRows.length ? rubricRows.map((row) => ({ criterion: row.criterion, points: row.points_awarded, possible: row.points_possible, comment: row.comment })) : null,
    feedback: input.feedback,
  });
  return data;
}

export async function returnForRevision(admin: AdminClient, input: { email: string; assignmentId: string; comment: string; actor: string }) {
  const { data: header, error } = await admin.from("ehr_assignment_submissions").select("id,version").eq("email", input.email).eq("assignment_id", input.assignmentId).maybeSingle();
  if (error) throw error;
  if (!header) throw new ApiError(404, "No submitted assignment was found for that student.", "NOT_FOUND");
  const now = new Date().toISOString();
  const { data, error: updateError } = await admin.from("ehr_assignment_submissions").update({
    status: "revision_requested",
    returned_at: now,
    returned_by: input.actor,
    return_comment: input.comment,
  }).eq("id", header.id).select("assignment_id,status,returned_at,return_comment,version").maybeSingle();
  if (updateError) throw updateError;
  await admin.from("ehr_grade_events").insert({ submission_id: header.id, version: header.version, email: input.email, assignment_id: input.assignmentId, event_type: "returned", actor: input.actor, feedback: input.comment });
  return data;
}

export async function loadSubmissionDetail(admin: AdminClient, email: string, assignmentId: string) {
  const { data: header, error } = await admin
    .from("ehr_assignment_submissions")
    .select("id,assignment_id,reflection,evidence,status,version,score,rubric_total,feedback,submitted_at,graded_at,graded_by,returned_at,returned_by,return_comment,late,config_version")
    .eq("email", email)
    .eq("assignment_id", assignmentId)
    .maybeSingle();
  if (error) throw error;
  if (!header) return null;
  const [versions, rubric, events] = await Promise.all([
    admin.from("ehr_submission_versions").select("id,version,reflection,evidence,progress_snapshot,late,submitted_at,config_version").eq("submission_id", header.id).order("version", { ascending: false }),
    admin.from("ehr_rubric_scores").select("version,criterion_index,criterion,points_possible,points_awarded,comment,graded_by,graded_at").eq("submission_id", header.id).order("version", { ascending: false }).order("criterion_index"),
    admin.from("ehr_grade_events").select("id,version,event_type,actor,score,rubric,feedback,created_at").eq("submission_id", header.id).order("created_at", { ascending: false }),
  ]);
  for (const result of [versions, rubric, events]) if (result.error) console.error("[fordms] submission detail partial", result.error.message);
  return { header, versions: versions.data ?? [], rubric: rubric.data ?? [], events: events.data ?? [] };
}
