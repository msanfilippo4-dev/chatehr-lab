"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog, InlineAlert, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import type { CourseData } from "@/hooks/useCourseData";
import { postJson } from "@/lib/api";
import type { CourseAssignment } from "@/lib/config/types";
import { computeProgress, toProgressEvent } from "@/lib/progress";
import { scopedReset } from "@/lib/store/reset";
import { FORDMS_CATEGORY_SHARE } from "@/lib/assignments";
import type { EHRState, ProgressRow } from "@/lib/types";
import { formatWhen } from "./shared";

interface Props {
  state: EHRState;
  courseData: CourseData | null;
  readOnly: boolean;
  exportLearnerReport: () => void;
  refreshCourseData: () => Promise<unknown>;
  flushSync: () => Promise<unknown>;
  replaceWorkspace: (next: EHRState, message?: string) => void;
}

export function Assignments({ state, courseData, readOnly, exportLearnerReport, refreshCourseData, flushSync, replaceWorkspace }: Props) {
  const assignments = courseData?.assignments ?? [];
  const [active, setActive] = useState(assignments[0]?.id ?? "FORDMS-A1");
  const [reflection, setReflection] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" }>({ text: "", tone: "success" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const assignment = assignments.find((item) => item.id === active) ?? assignments[0];
  const events = useMemo(() => state.audit.map(toProgressEvent), [state.audit]);
  const localProgress = (item: CourseAssignment) => computeProgress(item, events, { resetCutoff: courseData?.resetMarkers?.[item.id] ?? courseData?.resetMarkers?.["*"] ?? null });
  if (!assignment) return <Panel title="Assignments"><p className="empty">Assignments are loading.</p></Panel>;
  const serverRow: ProgressRow | undefined = courseData?.progress.find((row) => row.assignment_id === assignment.id);
  const progress = localProgress(assignment);
  const submission = courseData?.submissions.find((item) => item.assignment_id === assignment.id);
  const dueDate = new Date(assignment.dueAt);
  const isLate = Date.now() > dueDate.getTime();
  const reflectionText = reflection[assignment.id] ?? "";

  async function submit() {
    setSubmitting(true);
    setMessage({ text: "", tone: "success" });
    try {
      await flushSync();
      const payload = await postJson<{ version: number; late: boolean; importedUnits: number }>("/api/course/submit", { assignmentId: assignment!.id, reflection: reflectionText });
      await refreshCourseData();
      setMessage({ text: `Submitted ${assignment!.id}. Version ${payload.version} is ready for grading${payload.late ? " (recorded as late)" : ""}${payload.importedUnits ? `; ${payload.importedUnits} unit(s) rely on imported evidence` : ""}.`, tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Submission failed.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function resetAssignment() {
    setConfirmReset(false);
    try {
      const next = scopedReset(state, assignment!, "learner");
      replaceWorkspace(next, `Reset ${assignment!.id}. Signed notes and other assignments were kept.`);
      const payload = await postJson<{ progress: ProgressRow[] }>("/api/course/reset", { scope: "assignment", assignmentId: assignment!.id, workspace: next });
      await refreshCourseData();
      setMessage({ text: `${assignment!.id} was reset. Earlier evidence for this assignment no longer counts; your submissions are unchanged.`, tone: "success" });
      void payload;
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Reset failed.", tone: "error" });
    }
  }

  const statusLabel = submission?.status === "graded" ? `Graded ${submission.score}/100` : submission?.status === "revision_requested" ? "Returned for revision" : submission ? `Submitted v${submission.version}` : progress.complete ? "Ready to submit" : progress.status === "in_progress" ? "In progress" : "Not started";

  return <div className="grid assignment-layout">
    <Panel title="FordMS assignments" subtitle={`Applied EHR activities · the four assignments share ${FORDMS_CATEGORY_SHARE}% of the course grade equally · each takes about 1–2 hours`} actions={<SimulationBadge />}>
      <div className="assignment-list">{assignments.map((item) => { const itemProgress = localProgress(item); const itemSubmission = courseData?.submissions.find((row) => row.assignment_id === item.id); const tone = itemSubmission?.status === "graded" ? "good" : itemSubmission?.status === "revision_requested" ? "warn" : itemSubmission ? "info" : itemProgress.complete ? "good" : "warn"; return <button className={item.id === active ? "selected" : ""} key={item.id} onClick={() => { setActive(item.id); setMessage({ text: "", tone: "success" }); }}><span className="assignment-number">{item.id.replace("FORDMS-", "")}</span><span><strong>{item.shortTitle}</strong><small>{item.estimatedMinutes} min · due {new Date(item.dueAt).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "America/New_York" })}</small></span><Status tone={tone}>{itemSubmission?.status === "graded" ? `${itemSubmission.score}/100` : itemSubmission?.status === "revision_requested" ? "Revise" : itemSubmission ? "Submitted" : `${itemProgress.percent}%`}</Status></button>; })}</div>
      <div className="assignment-summary"><strong>Course record</strong><p>Your audit events, progress, submissions, scores, and feedback are saved under your Fordham email. Progress is recalculated on the server after every save.</p><div className="button-row"><button onClick={exportLearnerReport}>Download learner report</button></div></div>
    </Panel>
    <div className="stack">
      <Panel title={assignment.title} subtitle={`${assignment.id} · ${assignment.estimatedMinutes} minutes · Individual · introduced Week ${assignment.weekIntroduced}`}>
        <div className="assignment-header"><div><span>Due</span><strong>{assignment.dueLabel}</strong>{isLate && !submission && <small className="danger-text">Past due; submissions are marked late</small>}</div><div><span>Action progress</span><strong>{progress.completedUnits}/{progress.totalUnits} · {progress.percent}%</strong>{serverRow && serverRow.percent_complete !== progress.percent && <small>Server: {serverRow.percent_complete}% (updates after save)</small>}</div><div><span>Status</span><strong>{statusLabel}</strong></div></div>
        <div className="progress-bar" aria-label="Assignment progress"><i style={{ width: `${progress.percent}%` }} className={progress.hasImportedEvidence ? "imported" : ""} /></div>
        {progress.hasImportedEvidence && <InlineAlert tone="warn" title="Imported evidence"><p>{progress.importedUnits} of {progress.completedUnits} completed unit(s) come from an imported workspace. Imported evidence is shown to the instructor separately. Redo those actions here if you want them counted as work done in this workspace.</p></InlineAlert>}
        {submission?.status === "revision_requested" && <div className="return-card"><strong>Returned for revision {formatWhen(submission.returned_at)}</strong><p>{submission.return_comment}</p><p className="help">Make the requested changes, then resubmit. A new version is created; earlier versions stay on file.</p></div>}
        <div className="assignment-body"><h3>Scenario</h3><p>{assignment.scenario}</p><h3>Learning objectives</h3><ol>{assignment.objectives.map((item) => <li key={item}>{item}</li>)}</ol><h3>Required workflow</h3><ol>{assignment.workflow.map((item) => <li key={item}>{item}</li>)}</ol></div>
      </Panel>
      <Panel title="Action evidence" subtitle="Each required action is credited once per distinct item (patient, appointment, note, order, query…)">
        <div className="evidence-list">{progress.requirements.map((requirement, index) => <div className={requirement.complete ? "evidence-complete" : ""} key={`${requirement.action}-${index}`}><span aria-hidden="true">{requirement.complete ? "✓" : "○"}</span><span><strong>{requirement.label}</strong>{requirement.importedCount > 0 && <span className="imported-tag">{requirement.importedCount} imported</span>}<small>{requirement.completedCount}/{requirement.minimumCount} required · {requirement.latestEvidence ? `${formatWhen(requirement.latestEvidence.timestamp)} · ${requirement.latestEvidence.detail}` : "Complete this action in the relevant workspace."}</small></span></div>)}</div>
      </Panel>
      <Panel title="Rubric" subtitle={`100 points · counts equally within the ${FORDMS_CATEGORY_SHARE}% FordMS share of the course grade`}><table><thead><tr><th>Criterion</th><th>Points</th><th>Standard</th></tr></thead><tbody>{assignment.rubric.map((item) => <tr key={item.criterion}><td>{item.criterion}</td><td>{item.points}</td><td>{item.standard}</td></tr>)}</tbody></table></Panel>
      <Panel title="Submit for grading" subtitle="You may resubmit; every version is kept and the newest one is graded">
        <div className="submission-box"><p>{assignment.submissionPrompt}</p><label>Written analysis<textarea rows={9} value={reflectionText} onChange={(event) => setReflection({ ...reflection, [assignment.id]: event.target.value })} placeholder="Write your evidence-based analysis here. Do not include real patient information." disabled={readOnly} /></label><div className="submission-actions"><span>{reflectionText.length} characters (150 minimum)</span><button className="primary" disabled={!progress.complete || submitting || readOnly || reflectionText.trim().length < 150} onClick={submit}>{submitting ? "Submitting…" : submission ? "Resubmit assignment" : "Submit assignment"}</button></div>{message.text && <p className={`form-message ${message.tone}`} role="status">{message.text}</p>}{submission?.feedback && submission.status === "graded" && <div className="feedback-card"><strong>Instructor feedback · {submission.score}/100 · graded {formatWhen(submission.graded_at)}</strong><p>{submission.feedback}</p></div>}</div>
      </Panel>
      <Panel title="Reset this assignment only" subtitle="Keeps signed notes, other assignments, and every submission">
        <p className="help">Use this if you want a clean start on {assignment.id}. Earlier evidence for this assignment stops counting; nothing else changes.</p>
        <button className="danger-button" disabled={readOnly} onClick={() => setConfirmReset(true)}>Reset {assignment.id}</button>
        <ConfirmDialog open={confirmReset} title={`Reset ${assignment.id}?`} body={<p>This clears the work tied to {assignment.shortTitle.toLowerCase()} and records a reset marker. Signed notes, amendments, other assignments, and submitted versions are preserved. Export your evidence first if you want a copy.</p>} confirmLabel="Reset assignment" danger onConfirm={resetAssignment} onCancel={() => setConfirmReset(false)} />
      </Panel>
    </div>
  </div>;
}
