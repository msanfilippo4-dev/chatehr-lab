"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog, Field, InlineAlert, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import { apiFetch, postJson } from "@/lib/api";
import type { CourseAssignment } from "@/lib/config/types";
import type { AssignmentRelease, CourseRole } from "@/lib/types";
import { formatWhen } from "@/components/views/shared";
import { FORDMS_CATEGORY_SHARE } from "@/lib/assignments";
import { QuizAdmin } from "./QuizAdmin";
import { SubmissionReview } from "./SubmissionReview";

type RosterStatus = "not_started" | "in_progress" | "ready" | "submitted" | "revision_requested" | "graded";
const STATUS_LABEL: Record<RosterStatus, string> = { not_started: "Not started", in_progress: "In progress", ready: "Ready to submit", submitted: "Submitted", revision_requested: "Revision requested", graded: "Graded" };

interface RosterCell { assignment_id: string; status: RosterStatus; percent: number; earned_units: number; imported_units: number; total_units: number; score: number | null; version: number | null; late: boolean; submitted_at: string | null; graded_at: string | null }
interface RosterRow { email: string; name: string | null; role: CourseRole; enrollment_status: string; first_name: string | null; last_name: string | null; blackboard_username: string | null; section: string | null; notes: string | null; last_login_at: string | null; cells: RosterCell[] }
interface RosterPayload { assignments: CourseAssignment[]; configVersion: number; releases: AssignmentRelease[]; students: RosterRow[]; generatedAt: string }
interface AnalyticsPayload { denominator: number; activeLastWeek: number; note: string; assignments: { assignment_id: string; shortTitle: string; counts: Record<RosterStatus, number>; submitted: number; late: number; withImportedEvidence: number; meanScore: number | null; medianScore: number | null; gradedCount: number; meanPercent: number }[] }

export function Gradebook({ courseRole, onPreview }: { courseRole: CourseRole; onPreview: (email: string) => Promise<void> }) {
  const [data, setData] = useState<RosterPayload | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RosterStatus>("all");
  const [assignmentId, setAssignmentId] = useState("FORDMS-A1");
  const [includeTest, setIncludeTest] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [tab, setTab] = useState<"roster" | "analytics" | "quizzes">("roster");
  const [resetTarget, setResetTarget] = useState<{ email: string; scope: "assignment" | "all" } | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const payload = await apiFetch<RosterPayload>(`/api/instructor/roster?includeTest=${includeTest ? 1 : 0}`);
      setData(payload);
      setError("");
      setSelectedEmail((current) => current || payload.students[0]?.email || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gradebook could not be loaded.");
    }
  }, [includeTest]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "analytics") apiFetch<AnalyticsPayload>("/api/instructor/analytics").then(setAnalytics).catch(() => setAnalytics(null)); }, [tab, data]);

  const students = useMemo(() => (data?.students ?? []).filter((student) => {
    const cell = student.cells.find((item) => item.assignment_id === assignmentId);
    const matchesStatus = statusFilter === "all" || cell?.status === statusFilter;
    const text = `${student.name ?? ""} ${student.email} ${student.section ?? ""}`.toLowerCase();
    return matchesStatus && text.includes(search.toLowerCase());
  }), [data, assignmentId, statusFilter, search]);
  const student = data?.students.find((item) => item.email === selectedEmail);
  const assignment = data?.assignments.find((item) => item.id === assignmentId);

  async function runReset() {
    if (!resetTarget) return;
    try {
      await postJson("/api/instructor/reset", { email: resetTarget.email, scope: resetTarget.scope, assignmentId: resetTarget.scope === "assignment" ? assignmentId : undefined });
      setNotice(`Reset ${resetTarget.scope === "assignment" ? assignmentId : "all work"} for ${resetTarget.email}. A snapshot was saved first.`);
      await load();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Reset failed.");
    } finally {
      setResetTarget(null);
    }
  }

  if (!data) return <Panel title="Instructor gradebook" subtitle="Loading authenticated course records"><p className="empty">{error || "Loading students, progress, and submissions…"}</p></Panel>;

  const counts = (data.students.length ? (["not_started", "in_progress", "ready", "submitted", "revision_requested", "graded"] as RosterStatus[]).map((status) => [status, data.students.filter((s) => s.cells.find((c) => c.assignment_id === assignmentId)?.status === status).length]) : []) as [RosterStatus, number][];

  return <div className="gradebook-shell">
    <Panel title="Instructor gradebook" subtitle={`${data.students.length} enrolled account(s) · configuration v${data.configVersion} · Blackboard remains the gradebook of record`} actions={<><button className={tab === "roster" ? "active" : ""} onClick={() => setTab("roster")}>Roster</button><button className={tab === "analytics" ? "active" : ""} onClick={() => setTab("analytics")}>Cohort analytics</button><button className={tab === "quizzes" ? "active" : ""} onClick={() => setTab("quizzes")}>Quizzes</button><SimulationBadge>Synthetic course data</SimulationBadge></>}>
      <div className="gradebook-toolbar">
        <Field label="Assignment"><select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>{data.assignments.map((item) => <option key={item.id} value={item.id}>{item.id.replace("FORDMS-", "")} · {item.shortTitle}</option>)}</select></Field>
        <Field label="Status"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}><option value="all">All statuses</option>{counts.map(([status, count]) => <option key={status} value={status}>{STATUS_LABEL[status]} ({count})</option>)}</select></Field>
        <Field label="Search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, or section" /></Field>
        <label className="field"><span><input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} /> Show test accounts</span></label>
        <div className="button-row"><a className="buttonlike" href={`/api/instructor/export?format=blackboard&assignment=all&scale=rubric`}>Export CSV (0–100)</a><a className="buttonlike" href={`/api/instructor/export?format=blackboard&assignment=all&scale=course`}>Export CSV (course %)</a><button onClick={load}>Refresh</button></div>
      </div>
      {assignment && <p className="help">Due {assignment.dueLabel} · FordMS assignments share {FORDMS_CATEGORY_SHARE}% of the course grade equally ({assignment.weightPercent}% each) · release state {assignment.releaseState}.</p>}
      {notice && <p className="form-message success" role="status">{notice}</p>}
      {error && <p className="form-message error" role="alert">{error}</p>}
    </Panel>

    {tab === "quizzes" && <QuizAdmin includeTest={includeTest} />}

    {tab === "analytics" && <Panel title="Cohort analytics" subtitle={analytics ? `Denominator ${analytics.denominator} active student(s) · ${analytics.activeLastWeek} active in the last 7 days` : "Loading"}>
      {analytics ? <div className="analytics-grid">{analytics.assignments.map((row) => <article className="analytics-card" key={row.assignment_id}><h3>{row.assignment_id.replace("FORDMS-", "A")} · {row.shortTitle}</h3><div className="bars">{(Object.keys(row.counts) as RosterStatus[]).map((status) => <div key={status}><span>{STATUS_LABEL[status]}</span><i style={{ width: `${analytics.denominator ? (row.counts[status] / analytics.denominator) * 100 : 0}%` }} /><b>{row.counts[status]}</b></div>)}</div><p className="help">Mean action completion {row.meanPercent}% · submitted {row.submitted} ({row.late} late) · {row.withImportedEvidence} with imported evidence · graded {row.gradedCount}{row.meanScore != null ? ` · mean ${row.meanScore}, median ${row.medianScore}` : ""}</p></article>)}</div> : <p className="empty">Analytics unavailable.</p>}
      {analytics && <p className="help">{analytics.note}</p>}
    </Panel>}

    {tab === "roster" && <div className="grid gradebook-layout">
      <Panel title="Students" subtitle={`${students.length} shown for ${assignmentId}`}>
        <table className="roster-table"><thead><tr><th>Student</th>{data.assignments.map((item) => <th key={item.id}>{item.id.replace("FORDMS-", "")}</th>)}<th>Last sign-in</th></tr></thead><tbody>{students.map((row) => <tr key={row.email} className={row.email === selectedEmail ? "selected" : ""} onClick={() => setSelectedEmail(row.email)}><td><button className="text-button" onClick={() => setSelectedEmail(row.email)}>{row.last_name ? `${row.last_name}, ${row.first_name ?? ""}` : row.name || row.email}</button><small>{row.email}{row.section ? ` · ${row.section}` : ""}{row.enrollment_status !== "active" ? ` · ${row.enrollment_status}` : ""}</small></td>{row.cells.map((cell) => <td key={cell.assignment_id}><span className="cell-status"><span className={`status-pill ${cell.status}`}>{cell.status === "graded" ? `${cell.score}` : STATUS_LABEL[cell.status]}</span><small>{cell.percent}%{cell.imported_units ? ` · ${cell.imported_units} imp.` : ""}{cell.late ? " · late" : ""}{cell.version ? ` · v${cell.version}` : ""}</small></span></td>)}<td><small>{formatWhen(row.last_login_at)}</small></td></tr>)}{!students.length && <tr><td colSpan={data.assignments.length + 2} className="empty">No students match the filter.</td></tr>}</tbody></table>
      </Panel>
      <div className="stack">
        {student ? <>
          <Panel title={student.name || student.email} subtitle={`${student.email} · ${student.role} · ${student.enrollment_status}`} actions={<><button onClick={() => onPreview(student.email).catch((caught) => setNotice(caught instanceof Error ? caught.message : "Preview failed."))}>Preview workspace (read-only)</button><button onClick={() => setResetTarget({ email: student.email, scope: "assignment" })}>Reset {assignmentId.replace("FORDMS-", "")}</button><button className="danger-button" onClick={() => setResetTarget({ email: student.email, scope: "all" })}>Reset all work</button></>}>
            <div className="gradebook-tabs">{data.assignments.map((item) => { const cell = student.cells.find((c) => c.assignment_id === item.id); return <button className={item.id === assignmentId ? "active" : ""} key={item.id} onClick={() => setAssignmentId(item.id)}><strong>{item.id.replace("FORDMS-", "")}</strong><span>{cell?.status === "graded" ? `${cell.score}/100` : cell ? STATUS_LABEL[cell.status] : "—"}</span></button>; })}</div>
            <RosterEditor student={student} courseRole={courseRole} onSaved={load} />
          </Panel>
          {assignment && <SubmissionReview key={`${student.email}-${assignment.id}`} email={student.email} assignment={assignment} onChanged={load} />}
        </> : <Panel title="Select a student"><p className="empty">Choose a student from the roster to review evidence and enter grades.</p></Panel>}
        <InlineAlert tone="info" title="How progress is computed"><p>Progress is recalculated on the server from the student's synchronized audit events. Each required action is credited once per distinct item. Imported evidence is counted but labeled. A reset records a cutoff so earlier events stop counting for that assignment; submitted versions are never deleted.</p></InlineAlert>
      </div>
    </div>}
    <ConfirmDialog open={Boolean(resetTarget)} title={resetTarget?.scope === "all" ? "Reset all of this student's work?" : `Reset ${assignmentId} for this student?`} body={<p>A snapshot of the current workspace is stored first. {resetTarget?.scope === "all" ? "Every chart change and audit event returns to the starting state." : "Only the work tied to this assignment is cleared; signed notes and other assignments are kept."} Submitted versions and grades are not affected.</p>} confirmLabel="Reset" danger onConfirm={runReset} onCancel={() => setResetTarget(null)} />
  </div>;
}

function RosterEditor({ student, courseRole, onSaved }: { student: RosterRow; courseRole: CourseRole; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ firstName: student.first_name ?? "", lastName: student.last_name ?? "", blackboardUsername: student.blackboard_username ?? "", section: student.section ?? "", enrollmentStatus: student.enrollment_status, role: student.role, notes: student.notes ?? "" });
  const [message, setMessage] = useState("");
  useEffect(() => { setForm({ firstName: student.first_name ?? "", lastName: student.last_name ?? "", blackboardUsername: student.blackboard_username ?? "", section: student.section ?? "", enrollmentStatus: student.enrollment_status, role: student.role, notes: student.notes ?? "" }); setMessage(""); }, [student]);
  async function save() {
    try {
      await postJson("/api/instructor/roster", { email: student.email, firstName: form.firstName, lastName: form.lastName, blackboardUsername: form.blackboardUsername, section: form.section, enrollmentStatus: form.enrollmentStatus, notes: form.notes, ...(courseRole === "admin" && form.role !== student.role ? { role: form.role } : {}) });
      setMessage("Roster record saved.");
      await onSaved();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Save failed.");
    }
  }
  return <details className="roster-details"><summary>Roster record (names for Blackboard export, enrollment, role)</summary>
    <div className="roster-edit">
      <Field label="First name"><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
      <Field label="Last name"><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
      <Field label="Blackboard username"><input value={form.blackboardUsername} onChange={(e) => setForm({ ...form, blackboardUsername: e.target.value })} placeholder="defaults to email prefix" /></Field>
      <Field label="Section"><input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></Field>
      <Field label="Enrollment"><select value={form.enrollmentStatus} onChange={(e) => setForm({ ...form, enrollmentStatus: e.target.value })}><option value="invited">invited</option><option value="active">active</option><option value="dropped">dropped</option><option value="test">test</option></select></Field>
      <Field label="Course role" hint={courseRole === "admin" ? "Admin only" : "Only an admin can change roles"}><select value={form.role} disabled={courseRole !== "admin"} onChange={(e) => setForm({ ...form, role: e.target.value as CourseRole })}><option value="student">student</option><option value="instructor">instructor</option><option value="admin">admin</option></select></Field>
      <Field label="Private notes"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
    </div>
    <div className="button-row"><button onClick={save}>Save roster record</button>{message && <Status tone={message.startsWith("Roster") ? "good" : "danger"}>{message}</Status>}</div>
  </details>;
}
