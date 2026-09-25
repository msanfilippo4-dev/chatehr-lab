"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog, InlineAlert, PageHeader, Panel, SimulationBadge, Status, type Tone } from "@/components/ui/primitives";
import { NavLink } from "@/components/ui/NavLink";
import type { CourseData } from "@/hooks/useCourseData";
import { postJson } from "@/lib/api";
import { FORDMS_CATEGORY_SHARE } from "@/lib/assignments";
import type { View } from "@/lib/config/defaults";
import type { CourseAssignment, GuidePart, GuideStep } from "@/lib/config/types";
import { roleFromSlug, viewFromSlug, type NavTarget } from "@/lib/navigation";
import { computeProgress, matchesRequirement, toProgressEvent, type AssignmentProgressResult, type ProgressEvent } from "@/lib/progress";
import { scopedReset } from "@/lib/store/reset";
import type { CourseSubmission, EHRState, ProgressRow } from "@/lib/types";
import { formatWhen } from "./shared";

interface Props {
  state: EHRState;
  courseData: CourseData | null;
  readOnly: boolean;
  exportLearnerReport: () => void;
  refreshCourseData: () => Promise<unknown>;
  flushSync: () => Promise<unknown>;
  replaceWorkspace: (next: EHRState, message?: string) => void;
  navigate: (target: NavTarget) => void;
}

type Message = { text: string; tone: "success" | "error" };

function cutoffFor(courseData: CourseData | null, id: string) {
  return courseData?.resetMarkers?.[id] ?? courseData?.resetMarkers?.["*"] ?? null;
}

function statusFor(submission: CourseSubmission | undefined, progress: AssignmentProgressResult): { label: string; tone: Tone } {
  if (submission?.status === "graded") return { label: `Graded ${submission.score}/100`, tone: "good" };
  if (submission?.status === "revision_requested") return { label: "Returned for revision", tone: "warn" };
  if (submission) return { label: `Submitted v${submission.version}`, tone: "info" };
  if (progress.complete) return { label: "Ready to submit", tone: "good" };
  if (progress.status === "in_progress") return { label: "In progress", tone: "warn" };
  return { label: "Not started", tone: "neutral" };
}

export function Assignments(props: Props) {
  const { state, courseData, readOnly, navigate } = props;
  const assignments = courseData?.assignments ?? [];
  const [active, setActive] = useState(assignments[0]?.id ?? "FORDMS-A1");
  const [message, setMessage] = useState<Message>({ text: "", tone: "success" });
  const events = useMemo(() => state.audit.map(toProgressEvent), [state.audit]);
  const assignment = assignments.find((item) => item.id === active) ?? assignments[0];

  if (!assignment) {
    return <Panel title="Assignments"><p className="empty">Assignments are loading.</p></Panel>;
  }

  const progressFor = (item: CourseAssignment) => computeProgress(item, events, { resetCutoff: cutoffFor(courseData, item.id) });
  const progress = progressFor(assignment);
  const submission = courseData?.submissions.find((item) => item.assignment_id === assignment.id);
  const serverRow = courseData?.progress.find((row) => row.assignment_id === assignment.id);
  const cutoff = cutoffFor(courseData, assignment.id);
  const usableEvents = cutoff ? events.filter((event) => Date.parse(event.timestamp) >= Date.parse(cutoff)) : events;

  return (
    <div className="assignments-view">
      <PageHeader
        eyebrow="Clinical informatics analyst · Fordham Health"
        title="Assignments"
        subtitle={`Four FordMS assignments share ${FORDMS_CATEGORY_SHARE}% of the course grade equally. Each takes about 1–2 hours. Follow the guide; steps tick off as the EHR records your work.`}
        actions={<SimulationBadge />}
      />
      <div className="grid assignment-layout">
        <aside className="stack">
          <Panel title="Your assignments" subtitle="Select one to see its guide">
            <AssignmentList
              assignments={assignments}
              active={assignment.id}
              progressFor={progressFor}
              submissions={courseData?.submissions ?? []}
              onSelect={(id) => { setActive(id); setMessage({ text: "", tone: "success" }); }}
            />
            <div className="assignment-summary">
              <strong>Course record</strong>
              <p>Your audit events, progress, submissions, scores, and feedback are saved under your Fordham email. Progress is recalculated on the server after every save.</p>
              <div className="button-row"><button onClick={props.exportLearnerReport}>Download learner report</button></div>
            </div>
          </Panel>
        </aside>
        <div className="stack">
          <AssignmentHeader assignment={assignment} progress={progress} submission={submission} serverRow={serverRow} />
          {assignment.guide
            ? <Guide assignment={assignment} events={usableEvents} navigate={navigate} />
            : <LegacyBrief assignment={assignment} />}
          <EvidencePanel progress={progress} />
          <RubricPanel assignment={assignment} />
          <SubmitPanel {...props} assignment={assignment} progress={progress} submission={submission} message={message} setMessage={setMessage} readOnly={readOnly} />
          <ResetPanel {...props} assignment={assignment} setMessage={setMessage} />
        </div>
      </div>
    </div>
  );
}

function AssignmentList({ assignments, active, progressFor, submissions, onSelect }: {
  assignments: CourseAssignment[];
  active: string;
  progressFor: (item: CourseAssignment) => AssignmentProgressResult;
  submissions: CourseSubmission[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="assignment-list">
      {assignments.map((item) => {
        const itemProgress = progressFor(item);
        const itemSubmission = submissions.find((row) => row.assignment_id === item.id);
        const status = statusFor(itemSubmission, itemProgress);
        const chip = itemSubmission?.status === "graded"
          ? `${itemSubmission.score}/100`
          : itemSubmission?.status === "revision_requested"
            ? "Revise"
            : itemSubmission ? "Submitted" : `${itemProgress.percent}%`;
        const due = new Date(item.dueAt).toLocaleDateString([], { month: "short", day: "numeric", timeZone: "America/New_York" });
        return (
          <button
            className={item.id === active ? "selected" : ""}
            key={item.id}
            aria-current={item.id === active ? "true" : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span className="assignment-number">{item.id.replace("FORDMS-", "")}</span>
            <span>
              <strong>{item.shortTitle}</strong>
              <small>{item.estimatedMinutes} min · due {due}</small>
            </span>
            <Status tone={status.tone === "neutral" ? "warn" : status.tone}>{chip}</Status>
          </button>
        );
      })}
    </div>
  );
}

function AssignmentHeader({ assignment, progress, submission, serverRow }: {
  assignment: CourseAssignment;
  progress: AssignmentProgressResult;
  submission: CourseSubmission | undefined;
  serverRow: ProgressRow | undefined;
}) {
  const isLate = Date.now() > new Date(assignment.dueAt).getTime();
  const status = statusFor(submission, progress);
  return (
    <Panel title={assignment.title} subtitle={`${assignment.id} · about ${assignment.estimatedMinutes} minutes · individual · introduced week ${assignment.weekIntroduced}`}>
      <div className="assignment-header">
        <div>
          <span>Due</span>
          <strong>{assignment.dueLabel}</strong>
          {isLate && !submission && <small className="danger-text">Past due; submissions are marked late</small>}
        </div>
        <div>
          <span>Action progress</span>
          <strong>{progress.completedUnits}/{progress.totalUnits} · {progress.percent}%</strong>
          {serverRow && serverRow.percent_complete !== progress.percent && <small>Server: {serverRow.percent_complete}% (updates after save)</small>}
        </div>
        <div>
          <span>Status</span>
          <strong>{status.label}</strong>
        </div>
      </div>
      <div className="progress-bar" aria-label="Assignment progress">
        <i style={{ width: `${progress.percent}%` }} className={progress.hasImportedEvidence ? "imported" : ""} />
      </div>
      {progress.hasImportedEvidence && (
        <InlineAlert tone="warn" title="Imported evidence">
          <p>{progress.importedUnits} of {progress.completedUnits} completed unit(s) come from an imported workspace. Imported evidence is shown to the instructor separately. Redo those actions here if you want them counted as work done in this workspace.</p>
        </InlineAlert>
      )}
      {submission?.status === "revision_requested" && (
        <div className="return-card">
          <strong>Returned for revision {formatWhen(submission.returned_at)}</strong>
          <p>{submission.return_comment}</p>
          <p className="help">Make the requested changes, then resubmit. A new version is created; earlier versions stay on file.</p>
        </div>
      )}
    </Panel>
  );
}

function stepDone(step: GuideStep, events: ProgressEvent[]): boolean {
  if (!step.check) return false;
  return events.some((event) => matchesRequirement(step.check!, event));
}

function linkTarget(step: GuideStep): NavTarget | null {
  if (!step.link) return null;
  const view = viewFromSlug(step.link.view);
  if (!view) return null;
  return { view: view as View, patient: step.link.patient, role: roleFromSlug(step.link.role), tab: step.link.tab };
}

function Guide({ assignment, events, navigate }: { assignment: CourseAssignment; events: ProgressEvent[]; navigate: (target: NavTarget) => void }) {
  const guide = assignment.guide!;
  const checked = guide.parts.flatMap((part) => part.steps.filter((step) => step.check));
  const done = checked.filter((step) => stepDone(step, events)).length;
  return (
    <section className="panel guide-panel" aria-label="Step-by-step guide">
      <div className="panel-head">
        <div>
          <h2>Step-by-step guide</h2>
          <p>{done} of {checked.length} tracked steps done · links open the right screen, role, and patient</p>
        </div>
      </div>
      <div className="guide-body">
        <div className="guide-situation">
          <h3>Your situation</h3>
          <p>{guide.situation}</p>
        </div>
        {guide.parts.map((part, index) => (
          <GuidePartCard key={part.title} part={part} index={index} events={events} navigate={navigate} />
        ))}
      </div>
    </section>
  );
}

function GuidePartCard({ part, index, events, navigate }: { part: GuidePart; index: number; events: ProgressEvent[]; navigate: (target: NavTarget) => void }) {
  const tracked = part.steps.filter((step) => step.check);
  const complete = tracked.length > 0 && tracked.every((step) => stepDone(step, events));
  return (
    <article className={`guide-part${complete ? " complete" : ""}`}>
      <header>
        <span className="guide-part-number" aria-hidden="true">{complete ? "✓" : index + 1}</span>
        <h3>Part {index + 1}: {part.title}</h3>
        <span className="time-chip">about {part.minutes} min</span>
      </header>
      <ol className="guide-steps">
        {part.steps.map((step, stepIndex) => (
          <GuideStepRow key={stepIndex} step={step} number={stepIndex + 1} done={stepDone(step, events)} navigate={navigate} />
        ))}
      </ol>
      {part.tip && (
        <aside className="analyst-tip">
          <strong>Analyst tip</strong>
          <p>{part.tip}</p>
        </aside>
      )}
    </article>
  );
}

function GuideStepRow({ step, number, done, navigate }: { step: GuideStep; number: number; done: boolean; navigate: (target: NavTarget) => void }) {
  const target = linkTarget(step);
  const markClass = step.check ? (done ? "step-mark done" : "step-mark") : "step-mark info";
  return (
    <li className={done ? "step-done" : ""}>
      <span className={markClass} aria-label={step.check ? (done ? "Done" : "Not done yet") : "Guidance step"}>{done ? "✓" : number}</span>
      <div>
        <p className="step-text">{step.text}</p>
        {target && step.link && <NavLink target={target} navigate={navigate}>{step.link.label}</NavLink>}
        {step.expect && <p className="expect"><span>You should see:</span> {step.expect}</p>}
      </div>
    </li>
  );
}

function LegacyBrief({ assignment }: { assignment: CourseAssignment }) {
  return (
    <Panel title="Scenario and workflow">
      <div className="assignment-body">
        <h3>Scenario</h3>
        <p>{assignment.scenario}</p>
        <h3>Learning objectives</h3>
        <ol>{assignment.objectives.map((item) => <li key={item}>{item}</li>)}</ol>
        <h3>Required workflow</h3>
        <ol>{assignment.workflow.map((item) => <li key={item}>{item}</li>)}</ol>
      </div>
    </Panel>
  );
}

function EvidencePanel({ progress }: { progress: AssignmentProgressResult }) {
  return (
    <Panel title="Action evidence" subtitle="Each required action is credited once per distinct item (patient, appointment, note, order, ticket…)">
      <div className="evidence-list">
        {progress.requirements.map((requirement, index) => (
          <div className={requirement.complete ? "evidence-complete" : ""} key={`${requirement.action}-${index}`}>
            <span aria-hidden="true">{requirement.complete ? "✓" : "○"}</span>
            <span>
              <strong>{requirement.label}</strong>
              {requirement.importedCount > 0 && <span className="imported-tag">{requirement.importedCount} imported</span>}
              <small>
                {requirement.completedCount}/{requirement.minimumCount} required ·{" "}
                {requirement.latestEvidence ? `${formatWhen(requirement.latestEvidence.timestamp)} · ${requirement.latestEvidence.detail}` : "Complete this action in the relevant workspace."}
              </small>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RubricPanel({ assignment }: { assignment: CourseAssignment }) {
  return (
    <Panel title="Rubric" subtitle={`100 points · counts equally within the ${FORDMS_CATEGORY_SHARE}% FordMS share of the course grade`}>
      <table>
        <thead><tr><th>Criterion</th><th>Points</th><th>Standard</th></tr></thead>
        <tbody>
          {assignment.rubric.map((item) => (
            <tr key={item.criterion}><td>{item.criterion}</td><td>{item.points}</td><td>{item.standard}</td></tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function SubmitPanel({ assignment, progress, submission, message, setMessage, readOnly, flushSync, refreshCourseData }: Props & {
  assignment: CourseAssignment;
  progress: AssignmentProgressResult;
  submission: CourseSubmission | undefined;
  message: Message;
  setMessage: (message: Message) => void;
}) {
  const [reflection, setReflection] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const text = reflection[assignment.id] ?? "";

  async function submit() {
    setSubmitting(true);
    setMessage({ text: "", tone: "success" });
    try {
      await flushSync();
      const payload = await postJson<{ version: number; late: boolean; importedUnits: number }>("/api/course/submit", { assignmentId: assignment.id, reflection: text });
      await refreshCourseData();
      const late = payload.late ? " (recorded as late)" : "";
      const imported = payload.importedUnits ? `; ${payload.importedUnits} unit(s) rely on imported evidence` : "";
      setMessage({ text: `Submitted ${assignment.id}. Version ${payload.version} is ready for grading${late}${imported}.`, tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Submission failed.", tone: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title="Submit for grading" subtitle="You may resubmit; every version is kept and the newest one is graded">
      <div className="submission-box">
        <p>{assignment.submissionPrompt}</p>
        <label>
          Written analysis
          <textarea
            rows={9}
            value={text}
            onChange={(event) => setReflection({ ...reflection, [assignment.id]: event.target.value })}
            placeholder="Write your evidence-based analysis here. Do not include real patient information."
            disabled={readOnly}
          />
        </label>
        <div className="submission-actions">
          <span>{text.length} characters (150 minimum){progress.complete ? "" : " · complete every required action first"}</span>
          <button className="primary" disabled={!progress.complete || submitting || readOnly || text.trim().length < 150} onClick={submit}>
            {submitting ? "Submitting…" : submission ? "Resubmit assignment" : "Submit assignment"}
          </button>
        </div>
        {message.text && <p className={`form-message ${message.tone}`} role="status">{message.text}</p>}
        {submission?.feedback && submission.status === "graded" && (
          <div className="feedback-card">
            <strong>Instructor feedback · {submission.score}/100 · graded {formatWhen(submission.graded_at)}</strong>
            <p>{submission.feedback}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function ResetPanel({ state, assignment, readOnly, replaceWorkspace, refreshCourseData, setMessage }: Props & {
  assignment: CourseAssignment;
  setMessage: (message: Message) => void;
}) {
  const [confirm, setConfirm] = useState(false);

  async function resetAssignment() {
    setConfirm(false);
    try {
      const next = scopedReset(state, assignment, "learner");
      replaceWorkspace(next, `Reset ${assignment.id}. Signed notes and other assignments were kept.`);
      await postJson<{ progress: ProgressRow[] }>("/api/course/reset", { scope: "assignment", assignmentId: assignment.id, workspace: next });
      await refreshCourseData();
      setMessage({ text: `${assignment.id} was reset. Earlier evidence for this assignment no longer counts; your submissions are unchanged.`, tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Reset failed.", tone: "error" });
    }
  }

  return (
    <Panel title="Reset this assignment only" subtitle="Keeps signed notes, other assignments, and every submission">
      <p className="help">Use this if you want a clean start on {assignment.id}. Earlier evidence for this assignment stops counting; nothing else changes.</p>
      <button className="danger-button" disabled={readOnly} onClick={() => setConfirm(true)}>Reset {assignment.id}</button>
      <ConfirmDialog
        open={confirm}
        title={`Reset ${assignment.id}?`}
        body={<p>This clears the work tied to {assignment.shortTitle.toLowerCase()} and records a reset marker. Signed notes, amendments, other assignments, and submitted versions are preserved. Export your evidence first if you want a copy.</p>}
        confirmLabel="Reset assignment"
        danger
        onConfirm={resetAssignment}
        onCancel={() => setConfirm(false)}
      />
    </Panel>
  );
}
