"use client";

import { useCallback, useEffect, useState } from "react";
import { Field, InlineAlert, Panel, Status } from "@/components/ui/primitives";
import { apiFetch, postJson } from "@/lib/api";
import type { CourseAssignment } from "@/lib/config/types";
import { formatWhen } from "@/components/views/shared";

interface EvidenceItem { eventId: string; action: string; label: string; timestamp: string; detail: string; context: string | null; provenance: "earned" | "imported"; patient: { id: string; name: string; mrn: string } | null }
interface Detail {
  assignment: CourseAssignment & { instructorBenchmark: string[] };
  progress: { percent_complete: number; status: string; earned_units: number; imported_units: number; total_units: number; updated_at: string; progress?: { requirements?: { label: string; complete: boolean; completedCount: number; minimumCount: number; importedCount: number }[] } } | null;
  submission: {
    header: { id: string; reflection: string; evidence: EvidenceItem[]; status: string; version: number; score: number | null; rubric_total: number | null; feedback: string | null; submitted_at: string; graded_at: string | null; graded_by: string | null; returned_at: string | null; return_comment: string | null; late: boolean; config_version: number };
    versions: { id: string; version: number; reflection: string; evidence: EvidenceItem[]; late: boolean; submitted_at: string }[];
    rubric: { version: number; criterion_index: number; criterion: string; points_possible: number; points_awarded: number; comment: string | null; graded_by: string; graded_at: string }[];
    events: { id: number; version: number; event_type: string; actor: string; score: number | null; rubric: unknown; feedback: string | null; created_at: string }[];
  } | null;
}

export function SubmissionReview({ email, assignment, onChanged }: { email: string; assignment: CourseAssignment; onChanged: () => Promise<void> }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [scores, setScores] = useState<Record<number, { points: string; comment: string }>>({});
  const [feedback, setFeedback] = useState("");
  const [returnComment, setReturnComment] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" }>({ text: "", tone: "success" });
  const [busy, setBusy] = useState(false);
  const [showVersion, setShowVersion] = useState<number | null>(null);

  const load = useCallback(async () => {
    const payload = await apiFetch<Detail>(`/api/instructor/submissions?email=${encodeURIComponent(email)}&assignmentId=${assignment.id}`);
    setDetail(payload);
    const current = payload.submission?.header.version;
    const existing: Record<number, { points: string; comment: string }> = {};
    payload.submission?.rubric.filter((row) => row.version === current).forEach((row) => { existing[row.criterion_index] = { points: String(row.points_awarded), comment: row.comment ?? "" }; });
    setScores(existing);
    setFeedback(payload.submission?.header.feedback ?? "");
    setMessage({ text: "", tone: "success" });
  }, [email, assignment.id]);

  useEffect(() => { load().catch((caught) => setMessage({ text: caught instanceof Error ? caught.message : "Could not load the submission.", tone: "error" })); }, [load]);

  const rubric = detail?.assignment.rubric ?? assignment.rubric;
  const total = rubric.reduce((sum, item, index) => sum + Math.min(Number(scores[index]?.points ?? 0) || 0, item.points), 0);
  const allScored = rubric.every((_, index) => scores[index]?.points !== undefined && scores[index]?.points !== "");

  async function grade(finalize: boolean) {
    setBusy(true);
    try {
      await postJson("/api/instructor/grade", { email, assignmentId: assignment.id, rubric: rubric.map((_, index) => ({ criterionIndex: index, pointsAwarded: Number(scores[index]?.points ?? 0) || 0, comment: scores[index]?.comment || undefined })).filter((row) => scores[row.criterionIndex]?.points !== undefined && scores[row.criterionIndex]?.points !== ""), feedback, finalize });
      await load();
      await onChanged();
      setMessage({ text: finalize ? `Grade ${total}/100 saved and released to the student.` : "Partial scores and feedback saved (not yet released).", tone: "success" });
    } catch (caught) {
      setMessage({ text: caught instanceof Error ? caught.message : "Grade could not be saved.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function returnForRevision() {
    setBusy(true);
    try {
      await postJson("/api/instructor/return", { email, assignmentId: assignment.id, comment: returnComment });
      setReturnComment("");
      await load();
      await onChanged();
      setMessage({ text: "Returned for revision. The student sees your comment and can resubmit.", tone: "success" });
    } catch (caught) {
      setMessage({ text: caught instanceof Error ? caught.message : "Return failed.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return <Panel title={assignment.title} subtitle="Loading submission"><p className="empty">{message.text || "Loading…"}</p></Panel>;
  const header = detail.submission?.header;
  const requirements = detail.progress?.progress?.requirements ?? [];
  const versionShown = showVersion != null ? detail.submission?.versions.find((v) => v.version === showVersion) : null;

  return <>
    <Panel title={assignment.title} subtitle={`${assignment.id} · server progress ${detail.progress?.percent_complete ?? 0}% (${detail.progress?.earned_units ?? 0} earned, ${detail.progress?.imported_units ?? 0} imported of ${detail.progress?.total_units ?? "?"}) · updated ${formatWhen(detail.progress?.updated_at)}`}>
      <div className="evidence-list">{requirements.map((requirement, index) => <div key={index} className={requirement.complete ? "evidence-complete" : ""}><span aria-hidden="true">{requirement.complete ? "✓" : "○"}</span><span><strong>{requirement.label}</strong><small>{requirement.completedCount}/{requirement.minimumCount}{requirement.importedCount ? ` · ${requirement.importedCount} imported` : ""}</small></span></div>)}{!requirements.length && <p className="empty">No progress recorded yet.</p>}</div>
      <details><summary>Rubric standards and instructor benchmark</summary><div className="assignment-body"><h3>Rubric</h3><ul>{rubric.map((item) => <li key={item.criterion}><strong>{item.criterion} · {item.points}</strong><br />{item.standard}</li>)}</ul><h3>Instructor benchmark</h3><ul>{detail.assignment.instructorBenchmark.map((item) => <li key={item}>{item}</li>)}</ul></div></details>
    </Panel>

    <Panel title="Student submission" subtitle={header ? `Version ${header.version} · ${new Date(header.submitted_at).toLocaleString()}${header.late ? " · late" : ""} · status ${header.status}${header.graded_by ? ` · graded by ${header.graded_by}` : ""}` : "No submission received"}>
      {header ? <div className="submission-box">
        {header.status === "revision_requested" && <InlineAlert tone="warn" title={`Returned for revision ${formatWhen(header.returned_at)}`}><p>{header.return_comment}</p></InlineAlert>}
        <h3>Written analysis {versionShown ? `(version ${versionShown.version})` : ""}</h3>
        <p className="student-response">{versionShown ? versionShown.reflection : header.reflection}</p>
        <h3>Captured evidence</h3>
        <div className="evidence-bundle">{(versionShown ? versionShown.evidence : header.evidence).map((item, index) => <article key={`${item.eventId ?? index}`}><header><strong>{item.label ?? item.action}</strong><span>{formatWhen(item.timestamp)}{item.provenance === "imported" && <span className="imported-tag">Imported</span>}</span></header><small>{item.action}{item.patient ? ` · ${item.patient.name} (${item.patient.mrn})` : ""}{item.context ? ` · ${item.context}` : ""}</small><p>{item.detail}</p></article>)}</div>
        <h3>Version history</h3>
        <div className="version-list">{(detail.submission?.versions ?? []).map((version) => <article key={version.id}><strong>Version {version.version}</strong> · {new Date(version.submitted_at).toLocaleString()}{version.late ? " · late" : ""} <button className="text-button" onClick={() => setShowVersion(showVersion === version.version ? null : version.version)}>{showVersion === version.version ? "Show current" : "View"}</button></article>)}{!(detail.submission?.versions ?? []).length && <p className="help">Version history begins with the first submission after the course-operations update.</p>}</div>

        <h3>Rubric scoring · version {header.version}</h3>
        <table className="rubric-table"><thead><tr><th>Criterion</th><th>Possible</th><th>Awarded</th><th>Comment</th></tr></thead><tbody>{rubric.map((item, index) => <tr key={item.criterion}><td><strong>{item.criterion}</strong><small>{item.standard}</small></td><td>{item.points}</td><td><input type="number" min={0} max={item.points} step={0.5} aria-label={`Points for ${item.criterion}`} value={scores[index]?.points ?? ""} onChange={(e) => setScores({ ...scores, [index]: { points: e.target.value, comment: scores[index]?.comment ?? "" } })} /></td><td><textarea aria-label={`Comment for ${item.criterion}`} value={scores[index]?.comment ?? ""} onChange={(e) => setScores({ ...scores, [index]: { points: scores[index]?.points ?? "", comment: e.target.value } })} /></td></tr>)}</tbody></table>
        <div className="grade-total"><span>Total</span><span>{total}/100</span></div>
        <Field label="Feedback to the student (10+ characters)"><textarea rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></Field>
        <div className="button-row"><button className="primary" disabled={busy || !allScored || feedback.trim().length < 10} onClick={() => grade(true)}>Save and release grade</button><button disabled={busy || feedback.trim().length < 10} onClick={() => grade(false)}>Save partial (not released)</button></div>
        <Field label="Return for revision (comment shown to the student)"><textarea rows={3} value={returnComment} onChange={(e) => setReturnComment(e.target.value)} placeholder="What must change before the work can be graded" /></Field>
        <div className="button-row"><button disabled={busy || returnComment.trim().length < 10} onClick={returnForRevision}>Return for revision</button></div>
        {message.text && <p className={`form-message ${message.tone}`} role="status">{message.text}</p>}
        <h3>Grading log</h3>
        <ul className="grade-events">{(detail.submission?.events ?? []).map((event) => <li key={event.id} className={event.event_type}><strong>{event.event_type}</strong> · v{event.version} · {event.actor} · {new Date(event.created_at).toLocaleString()}{event.score != null ? ` · ${event.score}` : ""}{event.feedback ? <><br /><small>{event.feedback}</small></> : null}</li>)}{!(detail.submission?.events ?? []).length && <li>No grading events yet.</li>}</ul>
      </div> : <p className="empty">The student has not submitted this assignment.</p>}
      {message.text && !header && <p className={`form-message ${message.tone}`}>{message.text}</p>}
      <Status tone="neutral">Scores are 0–100 per assignment; transfer to Blackboard with the CSV export.</Status>
    </Panel>
  </>;
}
