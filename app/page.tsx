"use client";

import "./accessibility.css";
import "./advanced.css";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { loadState, normalizeState, saveState } from "@/lib/db";
import { codeExamples, initialState } from "@/lib/seed";
import { assignmentProgress, courseAssignments, type CourseAssignment } from "@/lib/assignments";
import type { Appointment, EHRState, NoteVersion, Order, Patient, Role } from "@/lib/types";
import { HIEReconciliation, ImplementationReadiness, MPIWorkbench, QueryStudio } from "./advanced";

type View = "Worklist" | "Schedule" | "Patients" | "MPI" | "Encounter" | "Orders & Results" | "Portal" | "HIE" | "Analytics" | "Query Studio" | "AI Review" | "Implementation" | "Assignments" | "Gradebook";

const views: View[] = ["Worklist", "Schedule", "Patients", "MPI", "Encounter", "Orders & Results", "Portal", "HIE", "Analytics", "Query Studio", "AI Review", "Implementation", "Assignments", "Gradebook"];
const roles: Role[] = ["Front Desk", "Clinical", "HIM", "Patient", "Analyst", "Implementation Lead"];
const roleViews: Record<Role, View[]> = {
  "Front Desk": ["Worklist", "Schedule", "Patients", "MPI", "Assignments"],
  Clinical: ["Worklist", "Patients", "Encounter", "Orders & Results", "Portal", "HIE", "AI Review", "Assignments"],
  HIM: ["Worklist", "Patients", "MPI", "HIE", "Analytics", "Assignments"],
  Patient: ["Portal", "Assignments"],
  Analyst: ["Worklist", "Analytics", "Query Studio", "HIE", "Assignments"],
  "Implementation Lead": ["Worklist", "Analytics", "Implementation", "Assignments"],
};

interface CourseSubmission {
  assignment_id: string;
  status: "submitted" | "graded" | "returned";
  version: number;
  score: number | null;
  feedback: string | null;
  submitted_at: string;
  graded_at: string | null;
}

interface CourseData {
  user: { email: string; name?: string; role: "student" | "instructor" | "admin" };
  assignments: CourseAssignment[];
  progress: Array<{ assignment_id: string; percent_complete: number; updated_at: string }>;
  submissions: CourseSubmission[];
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function download(name: string, value: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Panel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</section>;
}

function Status({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "danger" }) {
  return <span className={`status ${tone}`}>{children}</span>;
}

function PatientBanner({ patient }: { patient: Patient }) {
  return <div className="patient-banner" aria-label="Selected patient summary">
    <div><strong>{patient.name}</strong><span>{patient.pronouns}</span></div>
    <div><label>MRN</label><strong>{patient.mrn}</strong></div>
    <div><label>DOB</label><strong>{patient.dob}</strong></div>
    <div><label>Language</label><strong>{patient.language}</strong></div>
    <div><label>Allergies</label><strong className={patient.allergies[0].severity === "Severe" ? "danger-text" : ""}>{patient.allergies[0].allergen}</strong></div>
  </div>;
}

export default function PracticeEHR() {
  const { data: session, status: sessionStatus } = useSession();
  const [state, setState] = useState<EHRState>(initialState);
  const [ready, setReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState("Loading your Fordham course workspace...");
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [role, setRole] = useState<Role>("Clinical");
  const [view, setView] = useState<View>("Worklist");
  const [selectedPatientId, setSelectedPatientId] = useState("PT-001");
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function refreshCourseData() {
    const response = await fetch("/api/course/bootstrap", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load course records.");
    const payload = await response.json();
    setCourseData(payload);
    return payload as CourseData & { workspace?: unknown };
  }

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    let cancelled = false;
    Promise.allSettled([loadState(), fetch("/api/course/bootstrap", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Course account could not be loaded.");
      return response.json();
    })]).then(([localResult, cloudResult]) => {
      if (cancelled) return;
      const local = localResult.status === "fulfilled" ? localResult.value : null;
      const cloud = cloudResult.status === "fulfilled" ? cloudResult.value : null;
      if (cloud) setCourseData(cloud);
      if (cloud?.workspace) {
        setState(normalizeState(cloud.workspace));
        setStorageMessage("Your saved Fordham course workspace was restored.");
      } else if (local) {
        setState(local);
        setStorageMessage("Your browser workspace was restored and will now sync to your Fordham account.");
      } else {
        setStorageMessage("A new Fordham course workspace was created.");
      }
    }).catch(() => setStorageMessage("The cloud workspace is unavailable. Export evidence before leaving.")).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [sessionStatus]);

  useEffect(() => {
    if (!ready) return;
    saveState(state).catch(() => setStorageMessage("Browser storage is unavailable. Course sync will continue."));
    if (sessionStatus !== "authenticated") return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setStorageMessage("Saving to your Fordham course account…");
    syncTimer.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/course/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace: state }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Sync failed");
        setCourseData((current) => current ? { ...current, progress: payload.progress.map((row: { assignment_id: string; percent_complete: number; updated_at: string }) => row) } : current);
        setStorageMessage(`Saved to your Fordham course account at ${new Date(payload.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
      } catch {
        setStorageMessage("Cloud save failed. Work remains in this browser; export evidence before leaving.");
      }
    }, 900);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [state, ready, sessionStatus]);

  const courseRole = courseData?.user.role ?? ((session?.user as { courseRole?: "student" | "instructor" | "admin" } | undefined)?.courseRole ?? "student");

  const patient = state.patients.find((p) => p.id === selectedPatientId) ?? state.patients[0];
  const selectedName = patient.name;

  function audit(action: string, detail: string, patientId?: string) {
    setState((old) => ({ ...old, audit: [{ id: makeId("AUD"), timestamp: nowIso(), actor: `${role} learner`, action, patientId, detail }, ...old.audit].slice(0, 100) }));
  }

  function replacePatient(updated: Patient, auditAction?: string) {
    setState((old) => ({ ...old, patients: old.patients.map((p) => p.id === updated.id ? updated : p) }));
    if (auditAction) audit(auditAction, `${updated.name} (${updated.mrn})`, updated.id);
  }

  function exportWorkspace() {
    download("fordham-ehr-practice-workspace-v2.json", JSON.stringify(state, null, 2));
    audit("Export workspace", "Downloaded versioned JSON evidence");
  }

  function exportLearnerReport() {
    const report = {
      generatedAt: nowIso(),
      course: "HINF 6105 Electronic Health Records",
      learner: session?.user?.email,
      workspaceVersion: state.version,
      progress: courseAssignments.map((assignment) => ({ id: assignment.id, title: assignment.title, ...assignmentProgress(assignment, state.audit.map((event) => event.action)) })),
      auditEvidence: state.audit,
    };
    download("fordham-ehr-learner-evidence.json", JSON.stringify(report, null, 2));
    audit("Export learner report", "Downloaded action-based exercise evidence");
  }

  function importWorkspace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const parsed = normalizeState(JSON.parse(text));
      setState(parsed);
      setStorageMessage("Imported workspace and normalized it to schema version 2.");
    }).catch(() => setStorageMessage("Import failed. Choose a compatible version 1 or version 2 practice EHR workspace JSON file."));
  }

  function resetWorkspace() {
    if (!window.confirm("Reset all practice work in this browser? Export first if you need evidence.")) return;
    setState(initialState);
    setSelectedPatientId("PT-001");
    setView("Worklist");
    setStorageMessage("Course workspace reset to the synthetic starting state.");
  }

  return <div className="app-shell">
    <a className="skip-link" href="#practice-ehr-main" onClick={() => document.getElementById("practice-ehr-main")?.focus()}>Skip to main content</a>
    <header className="topbar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">F</span><div><span className="brand-university">Fordham University</span><strong>FordMS EHR</strong><small>HINF 6105 · Electronic Health Records</small></div></div>
      <div className="top-actions">
        <div className="account-chip"><strong>{session?.user?.name ?? "Fordham learner"}</strong><span>{session?.user?.email} · {courseRole}</span></div>
        <label className="role-label">Role<select aria-label="Select simulated role" value={role} onChange={(e) => { const next = e.target.value as Role; setRole(next); setView(next === "Front Desk" ? "Schedule" : next === "HIM" ? "MPI" : next === "Patient" ? "Portal" : next === "Analyst" ? "Query Studio" : next === "Implementation Lead" ? "Implementation" : "Worklist"); }}>{roles.map((r) => <option key={r}>{r}</option>)}</select></label>
        <button onClick={exportWorkspace}>Export evidence</button>
        <label className="buttonlike">Import<input aria-label="Import workspace" type="file" accept="application/json" onChange={importWorkspace} /></label>
        <button className="danger-button" onClick={resetWorkspace}>Reset</button>
        <button onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
      </div>
    </header>
    <div className="storage-line"><span className={storageMessage.includes("unavailable") || storageMessage.includes("failed") ? "storage-error" : "storage-ok"} />{storageMessage}</div>
    <nav className="nav-tabs" aria-label="FordMS EHR modules">{views.filter((item) => roleViews[role].includes(item) || (item === "Gradebook" && courseRole !== "student")).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</nav>
    <PatientBanner patient={patient} />
    <main id="practice-ehr-main" tabIndex={-1}>
      {view === "Worklist" && <Worklist state={state} patient={patient} selectPatient={(id) => { setSelectedPatientId(id); setView("Patients"); }} completeTask={(id) => { setState((old) => ({ ...old, tasks: old.tasks.map((t) => t.id === id ? { ...t, complete: !t.complete } : t) })); audit("Update task", id); }} />}
      {view === "Schedule" && <Schedule state={state} setState={setState} selectPatient={setSelectedPatientId} audit={audit} />}
      {view === "Patients" && <Patients state={state} selectedPatientId={selectedPatientId} setSelectedPatientId={setSelectedPatientId} patient={patient} replacePatient={replacePatient} audit={audit} />}
      {view === "MPI" && <MPIWorkbench state={state} setState={setState} audit={audit} selectPatient={(id) => { setSelectedPatientId(id); }} />}
      {view === "Encounter" && <Encounter patient={patient} replacePatient={replacePatient} audit={audit} />}
      {view === "Orders & Results" && <OrdersResults state={state} setState={setState} patient={patient} audit={audit} />}
      {view === "Portal" && <Portal state={state} setState={setState} patient={patient} audit={audit} />}
      {view === "HIE" && <HIEReconciliation state={state} setState={setState} audit={audit} />}
      {view === "Analytics" && <Analytics state={state} />}
      {view === "Query Studio" && <QueryStudio state={state} setState={setState} audit={audit} />}
      {view === "AI Review" && <AIReview patient={patient} audit={audit} />}
      {view === "Implementation" && <ImplementationReadiness state={state} setState={setState} audit={audit} />}
      {view === "Assignments" && <Assignments state={state} courseData={courseData} exportLearnerReport={exportLearnerReport} refreshCourseData={refreshCourseData} />}
      {view === "Gradebook" && courseRole !== "student" && <Gradebook />}
    </main>
    <footer><span>Fordham University · Applied Health Informatics</span><span>All names and clinical data are fictional · no clinical use</span><button onClick={() => window.print()}>Print current view</button></footer>
  </div>;
}

function Worklist({ state, patient, selectPatient, completeTask }: { state: EHRState; patient: Patient; selectPatient: (id: string) => void; completeTask: (id: string) => void }) {
  const todays = state.appointments.filter((a) => a.date === "2026-09-21" && a.status !== "Canceled");
  return <div className="grid two-one">
    <div className="stack">
      <Panel title="Today's schedule" subtitle="Monday, September 21, 2026 · Lincoln Center teaching clinic">
        <table><thead><tr><th>Time</th><th>Patient</th><th>Visit</th><th>Provider</th><th>Status</th></tr></thead><tbody>{todays.map((a) => { const p = state.patients.find((x) => x.id === a.patientId)!; return <tr key={a.id} onClick={() => selectPatient(p.id)} tabIndex={0}><td>{a.time}</td><td><button className="text-button" onClick={() => selectPatient(p.id)}>{p.name}</button><small>{p.mrn}</small></td><td>{a.visitType}</td><td>{a.provider}</td><td><Status tone={a.status === "Checked in" ? "good" : "neutral"}>{a.status}</Status></td></tr>; })}</tbody></table>
      </Panel>
      <Panel title="Results requiring action" subtitle="Acknowledgment and patient follow-up are tracked separately">
        <table><thead><tr><th>Patient</th><th>Result</th><th>Value</th><th>State</th></tr></thead><tbody>{state.patients.flatMap((p) => p.results.filter((r) => r.flag).map((r) => <tr key={`${p.id}-${r.name}`}><td>{p.name}</td><td>{r.name}</td><td className="danger-text">{r.value}</td><td><Status tone="warn">Final · not reviewed</Status></td></tr>)).slice(0, 5)}</tbody></table>
      </Panel>
    </div>
    <div className="stack">
      <Panel title="My tasks" subtitle="Close the loop after reviewing the result">
        <ul className="task-list">{state.tasks.map((t) => <li key={t.id}><label><input type="checkbox" checked={t.complete} onChange={() => completeTask(t.id)} /><span className={t.complete ? "done" : ""}>{t.title}<small>Due {t.due}</small></span></label></li>)}</ul>
      </Panel>
      <Panel title="Patient context" subtitle={patient.name}>
        <dl className="facts"><div><dt>Active problems</dt><dd>{patient.problems.map((p) => p.display).join("; ")}</dd></div><div><dt>Active medications</dt><dd>{patient.medications.map((m) => m.name).join("; ")}</dd></div><div><dt>Latest BP</dt><dd>{patient.vitals[0].bp}</dd></div></dl>
      </Panel>
    </div>
  </div>;
}

function Schedule({ state, setState, selectPatient, audit }: { state: EHRState; setState: React.Dispatch<React.SetStateAction<EHRState>>; selectPatient: (id: string) => void; audit: (a: string, d: string, p?: string) => void }) {
  const [form, setForm] = useState({ patientId: "PT-001", date: "2026-09-28", time: "09:00", provider: "Dr. Chen", visitType: "Established patient", duration: 30 });
  const [message, setMessage] = useState("");
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  function submit(e: FormEvent) {
    e.preventDefault();
    const conflict = state.appointments.find((a) => a.id !== rescheduleId && a.date === form.date && a.time === form.time && a.provider === form.provider && a.status !== "Canceled");
    if (conflict) { setMessage(`Conflict: ${form.provider} already has ${conflict.visitType} at ${form.time}. Choose another time or provider.`); return; }
    if (rescheduleId) {
      setState((old) => ({ ...old, appointments: old.appointments.map((a) => a.id === rescheduleId ? { ...a, ...form, status: "Scheduled" } : a) }));
      setMessage("Appointment rescheduled. The original appointment identifier and audit history are preserved.");
      audit("Reschedule appointment", `${form.date} ${form.time} ${form.provider}`, form.patientId);
      setRescheduleId(null);
      selectPatient(form.patientId);
      return;
    }
    const appointment: Appointment = { id: makeId("APT"), ...form, status: "Scheduled" };
    setState((old) => ({ ...old, appointments: [...old.appointments, appointment] }));
    setMessage("Appointment created. The schedule and patient record now show the new visit.");
    selectPatient(form.patientId); audit("Create appointment", `${form.date} ${form.time} ${form.provider}`, form.patientId);
  }
  function updateStatus(id: string, status: Appointment["status"]) {
    setState((old) => ({ ...old, appointments: old.appointments.map((a) => a.id === id ? { ...a, status } : a) }));
    const appt = state.appointments.find((a) => a.id === id); audit("Update appointment", `${id} to ${status}`, appt?.patientId);
  }
  function beginReschedule(appointment: Appointment) {
    setForm({ patientId: appointment.patientId, date: appointment.date, time: appointment.time, provider: appointment.provider, visitType: appointment.visitType, duration: appointment.duration });
    setRescheduleId(appointment.id);
    setMessage("Choose a new date, time, provider, or duration, then save the reschedule.");
    selectPatient(appointment.patientId);
  }
  return <div className="grid two-one">
    <Panel title="Schedule" subtitle="Conflicts are checked by provider, date, and start time">
      <table><thead><tr><th>Date</th><th>Time</th><th>Patient</th><th>Provider</th><th>Visit</th><th>Actions</th></tr></thead><tbody>{[...state.appointments].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((a) => <tr key={a.id}><td>{a.date}</td><td>{a.time}</td><td>{state.patients.find((p) => p.id === a.patientId)?.name}</td><td>{a.provider}</td><td>{a.visitType}<small>{a.duration} min · {a.status}</small></td><td className="button-row"><button onClick={() => beginReschedule(a)}>Reschedule</button><button onClick={() => updateStatus(a.id, "Checked in")}>Check in</button><button onClick={() => updateStatus(a.id, "Canceled")}>Cancel</button></td></tr>)}</tbody></table>
    </Panel>
    <Panel title="Create appointment" subtitle="Teaching simulation">
      <form className="form-stack" onSubmit={submit}>
        <label>Patient<select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>{state.patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.mrn}</option>)}</select></label>
        <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
        <label>Time<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
        <label>Provider<select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}><option>Dr. Chen</option><option>Dr. Patel</option></select></label>
        <label>Visit type<select value={form.visitType} onChange={(e) => setForm({ ...form, visitType: e.target.value })}><option>Established patient</option><option>New patient</option><option>Follow-up</option><option>Urgent</option></select></label>
        <label>Duration<select value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></label>
        <button className="primary" type="submit">{rescheduleId ? "Save reschedule" : "Create appointment"}</button>
        {rescheduleId && <button type="button" onClick={() => { setRescheduleId(null); setMessage("Reschedule canceled. No appointment data changed."); }}>Cancel reschedule</button>}
        {message && <p className={message.startsWith("Conflict") ? "form-message error" : "form-message success"}>{message}</p>}
      </form>
    </Panel>
  </div>;
}

function Patients({ state, selectedPatientId, setSelectedPatientId, patient, replacePatient, audit }: { state: EHRState; selectedPatientId: string; setSelectedPatientId: (id: string) => void; patient: Patient; replacePatient: (p: Patient, action?: string) => void; audit: (a: string, d: string, p?: string) => void }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Summary");
  const filtered = state.patients.filter((p) => `${p.name} ${p.mrn} ${p.dob}`.toLowerCase().includes(query.toLowerCase()));
  const tabs = ["Summary", "Problems", "Medications", "Allergies", "Vitals", "Results", "Notes", "Audit", "Coding"];
  return <div className="grid directory">
    <Panel title="Patient search" subtitle="Search before creating a record">
      <input className="search" placeholder="Name, MRN, or date of birth" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="patient-list">{filtered.map((p) => <button className={p.id === selectedPatientId ? "selected" : ""} key={p.id} onClick={() => { setSelectedPatientId(p.id); audit("Open chart", p.name, p.id); }}><strong>{p.name}</strong><span>{p.mrn} · {p.dob}</span>{p.duplicateCandidate && <Status tone="warn">Possible duplicate</Status>}</button>)}</div>
    </Panel>
    <Panel title={patient.name} subtitle={`${patient.mrn} · ${patient.dob} · ${patient.pronouns}`}>
      {patient.duplicateCandidate && <div className="inline-alert warn"><strong>Possible duplicate record</strong><p>Compare identifiers with {state.patients.find((p) => p.id === patient.duplicateCandidate)?.name}. Do not merge based on name alone.</p><button onClick={() => audit("Escalate identity review", `Compare ${patient.id} with ${patient.duplicateCandidate}`, patient.id)}>Send to HIM identity queue</button></div>}
      <div className="subtabs">{tabs.map((t) => <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === "Summary" && <div className="summary-grid"><dl className="facts"><div><dt>Address</dt><dd>{patient.address}</dd></div><div><dt>Phone</dt><dd>{patient.phone}</dd></div><div><dt>Preferred language</dt><dd>{patient.language}</dd></div><div><dt>Coverage</dt><dd>{patient.insurance}</dd></div></dl><div><h3>Clinical snapshot</h3><p><strong>Problems:</strong> {patient.problems.map((p) => p.display).join(", ")}</p><p><strong>Medications:</strong> {patient.medications.map((m) => m.name).join(", ")}</p><p><strong>Allergies:</strong> {patient.allergies.map((a) => `${a.allergen}${a.reaction ? ` (${a.reaction})` : ""}`).join(", ")}</p></div></div>}
      {tab === "Problems" && <SimpleTable heads={["Code", "Problem", "Onset"]} rows={patient.problems.map((p) => [p.code, p.display, p.onset])} />}
      {tab === "Medications" && <SimpleTable heads={["Medication", "Instructions", "Status"]} rows={patient.medications.map((m) => [m.name, m.sig, m.status])} />}
      {tab === "Allergies" && <SimpleTable heads={["Allergen", "Reaction", "Severity"]} rows={patient.allergies.map((a) => [a.allergen, a.reaction || "Not recorded", a.severity])} />}
      {tab === "Vitals" && <SimpleTable heads={["Date", "Blood pressure", "Heart rate", "Weight"]} rows={patient.vitals.map((v) => [v.date, v.bp, String(v.hr), v.weight])} />}
      {tab === "Results" && <SimpleTable heads={["Date", "Test", "Value", "Flag", "Status"]} rows={patient.results.map((r) => [r.date, r.name, r.value, r.flag || "Normal", r.status])} />}
      {tab === "Notes" && <div className="timeline">{patient.notes.length ? patient.notes.map((n) => <article key={n.id}><header><strong>{n.kind}</strong><span>{n.recordedAt} · {n.author}</span></header><p><b>S:</b> {n.subjective}</p><p><b>O:</b> {n.objective}</p><p><b>A:</b> {n.assessment}</p><p><b>P:</b> {n.plan}</p>{n.amendmentReason && <p><b>Reason:</b> {n.amendmentReason}</p>}</article>) : <p className="empty">No notes have been created in this practice workspace.</p>}</div>}
      {tab === "Audit" && <SimpleTable heads={["Time", "Actor", "Action", "Detail"]} rows={state.audit.filter((a) => !a.patientId || a.patientId === patient.id).slice(0, 20).map((a) => [a.timestamp, a.actor, a.action, a.detail])} />}
      {tab === "Coding" && <CodeSearch patient={patient} audit={audit} />}
    </Panel>
  </div>;
}

function CodeSearch({ patient, audit }: { patient: Patient; audit: (a: string, d: string, p?: string) => void }) {
  const [query, setQuery] = useState("");
  const rows = codeExamples.filter((c) => `${c.system} ${c.code} ${c.display}`.toLowerCase().includes(query.toLowerCase()));
  return <div><div className="inline-alert info"><strong>Teaching code list</strong><p>Examples only. Verify the official code set effective on the date of service. FY2027 ICD-10-CM applies beginning October 1, 2026.</p></div><input className="search" placeholder="Search code or term" value={query} onChange={(e) => setQuery(e.target.value)} /><table><thead><tr><th>System</th><th>Code</th><th>Display</th><th>Represents</th><th>Evidence</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.system}-${row.code}`}><td>{row.system}</td><td><strong>{row.code}</strong></td><td>{row.display}</td><td>{row.use}</td><td><button onClick={() => audit("Use code example", `${row.system} ${row.code}: ${row.display}`, patient.id)}>Record use</button></td></tr>)}</tbody></table></div>;
}

function Encounter({ patient, replacePatient, audit }: { patient: Patient; replacePatient: (p: Patient, action?: string) => void; audit: (a: string, d: string, p?: string) => void }) {
  const [note, setNote] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [reason, setReason] = useState("");
  const signed = [...patient.notes].reverse().find((n) => n.kind === "Signed");
  useEffect(() => setNote({ subjective: "", objective: "", assessment: "", plan: "" }), [patient.id]);
  function save(kind: NoteVersion["kind"]) {
    if (kind === "Signed" && Object.values(note).some((v) => !v.trim())) return alert("Complete all four SOAP sections before signing.");
    if (kind === "Amendment" && (!signed || !reason.trim())) return alert("A signed note and amendment reason are required.");
    const version: NoteVersion = { id: makeId("NOTE"), author: "Student Clinician", recordedAt: nowIso(), kind, ...note, ...(kind === "Amendment" ? { amendmentReason: reason } : {}) };
    replacePatient({ ...patient, notes: [...patient.notes, version] });
    audit(kind === "Amendment" ? "Amend signed note" : `${kind} SOAP note`, version.id, patient.id);
  }
  return <div className="grid two-one">
    <Panel title="SOAP note" subtitle="Document only information supplied by the encounter">
      <div className="soap-grid">
        {(["subjective", "objective", "assessment", "plan"] as const).map((key) => <label key={key}><span>{key[0].toUpperCase()} · {key}</span><textarea rows={5} value={note[key]} onChange={(e) => setNote({ ...note, [key]: e.target.value })} placeholder={key === "subjective" ? "Patient-reported symptoms, history, and concerns" : key === "objective" ? "Observed or measured findings actually obtained" : key === "assessment" ? "Clinical interpretation and supported diagnoses" : "Orders, treatment, education, and follow-up"} /></label>)}
      </div>
      <div className="form-actions"><button onClick={() => save("Draft")}>Save draft</button><button className="primary" onClick={() => save("Signed")}>Sign note</button></div>
    </Panel>
    <div className="stack">
      <Panel title="Chart evidence" subtitle="Use these facts; do not invent findings">
        <p><strong>Reason for visit:</strong> Follow-up for right shoulder pain after increased lifting.</p><p><strong>Reported:</strong> Pain improves with rest. No fall, fever, weakness, or numbness.</p><p><strong>Observed:</strong> BP {patient.vitals[0].bp}; tenderness over right lateral shoulder; active range limited by pain. Neurologic exam not performed.</p><p><strong>Known allergy:</strong> {patient.allergies[0].allergen} {patient.allergies[0].reaction && `· ${patient.allergies[0].reaction}`}</p>
      </Panel>
      <Panel title="Amendment" subtitle="Signed content remains in history">
        <textarea rows={3} placeholder="Reason for amendment" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button onClick={() => save("Amendment")}>Add amendment</button>
        {!signed && <p className="help">Sign a complete note before creating an amendment.</p>}
      </Panel>
    </div>
  </div>;
}

function OrdersResults({ state, setState, patient, audit }: { state: EHRState; setState: React.Dispatch<React.SetStateAction<EHRState>>; patient: Patient; audit: (a: string, d: string, p?: string) => void }) {
  const [type, setType] = useState<Order["type"]>("Medication");
  const [name, setName] = useState("Amoxicillin 500 mg capsule");
  const [details, setDetails] = useState("Take one capsule three times daily for 7 days");
  const existing = state.orders.filter((o) => o.patientId === patient.id);
  const allergyWarning = type === "Medication" && /amoxicillin|penicillin/i.test(name) && patient.allergies.some((a) => /penicillin/i.test(a.allergen));
  const duplicateWarning = existing.some((o) => o.name.toLowerCase() === name.toLowerCase() && o.status !== "Reviewed");
  function place() {
    if (allergyWarning && !window.confirm("Severe penicillin allergy documented. This teaching order is unsafe. Continue only to record an override example?")) return;
    const order: Order = { id: makeId("ORD"), patientId: patient.id, type, name, details, status: type === "Laboratory" ? "Final" : "Submitted", orderedAt: nowIso(), ...(type === "Laboratory" ? { result: "5.9 mmol/L · High" } : {}) };
    setState((old) => ({ ...old, orders: [...old.orders, order] })); audit("Place simulated order", `${name}${allergyWarning ? " · allergy override" : ""}`, patient.id);
  }
  function review(id: string) {
    const order = state.orders.find((o) => o.id === id)!;
    setState((old) => ({ ...old, orders: old.orders.map((o) => o.id === id ? { ...o, status: "Reviewed" } : o), tasks: [...old.tasks, { id: makeId("TASK"), patientId: patient.id, title: `Follow up ${order.name}: ${order.result ?? "order"}`, due: "2026-09-23", complete: false }] })); audit("Review result and create follow-up", order.name, patient.id);
  }
  return <div className="grid two-one">
    <Panel title="Orders and results" subtitle={patient.name}>
      <table><thead><tr><th>Type</th><th>Order</th><th>Status</th><th>Result</th><th>Action</th></tr></thead><tbody>{existing.map((o) => <tr key={o.id}><td>{o.type}</td><td>{o.name}<small>{o.details}</small></td><td><Status tone={o.status === "Reviewed" ? "good" : o.status === "Final" ? "warn" : "neutral"}>{o.status}</Status></td><td>{o.result ?? "—"}</td><td>{o.status === "Final" && <button onClick={() => review(o.id)}>Review + follow-up</button>}</td></tr>)}</tbody></table>
      {!existing.length && <p className="empty">No orders in this practice workspace for {patient.name}.</p>}
    </Panel>
    <Panel title="Enter simulated order" subtitle="Warnings use this chart and current practice state">
      <div className="form-stack"><label>Order type<select value={type} onChange={(e) => { const v = e.target.value as Order["type"]; setType(v); setName(v === "Medication" ? "Amoxicillin 500 mg capsule" : "Basic metabolic panel"); setDetails(v === "Medication" ? "Take one capsule three times daily for 7 days" : "Routine outpatient collection"); }}><option>Medication</option><option>Laboratory</option></select></label><label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Details<textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
        {allergyWarning && <div className="inline-alert danger"><strong>Drug-allergy warning</strong><p>Severe penicillin allergy: hives. Verify reaction and choose an appropriate alternative unless a documented clinical reason supports an override.</p></div>}
        {duplicateWarning && <div className="inline-alert warn"><strong>Possible duplicate order</strong><p>An active order with the same name already exists.</p></div>}
        <button className="primary" onClick={place}>Submit simulated order</button>
      </div>
    </Panel>
  </div>;
}

function Portal({ state, setState, patient, audit }: { state: EHRState; setState: React.Dispatch<React.SetStateAction<EHRState>>; patient: Patient; audit: (a: string, d: string, p?: string) => void }) {
  const patientMessages = state.messages.filter((m) => m.patientId === patient.id);
  function route(id: string) { setState((old) => ({ ...old, messages: old.messages.map((m) => m.id === id ? { ...m, status: "Routed" } : m) })); audit("Route portal message", id, patient.id); }
  return <div className="grid two-one">
    <Panel title="Portal inbox" subtitle="Messages need an owner, priority, and response expectation">
      {patientMessages.map((m) => <article className="message" key={m.id}><header><div><strong>{m.subject}</strong><span>{m.from} · {m.date}</span></div><Status tone={m.status === "New" ? "warn" : "good"}>{m.status}</Status></header><p>{m.body}</p><div className="button-row"><button onClick={() => route(m.id)}>Route to clinical team</button><button onClick={() => setState((old) => ({ ...old, messages: old.messages.map((x) => x.id === m.id ? { ...x, status: "Resolved" } : x) }))}>Mark resolved</button></div></article>)}
      {!patientMessages.length && <p className="empty">No portal messages for {patient.name}.</p>}
    </Panel>
    <Panel title="Patient view" subtitle="Plain-language summary">
      <div className="portal-card"><h3>Your health summary</h3><p><b>Next step:</b> Review your medication list and contact the clinic if anything is missing or incorrect.</p><h4>Current medicines</h4>{patient.medications.map((m) => <p key={m.name}>{m.name}<small>{m.sig}</small></p>)}<h4>Recent results</h4>{patient.results.map((r) => <p key={`${r.name}${r.date}`}>{r.name}: {r.value}<small>{r.date} · {r.flag || "within the displayed reference range"}</small></p>)}<button onClick={() => audit("Patient data reconciliation request", "Medication list review requested", patient.id)}>Report a medication difference</button></div>
    </Panel>
  </div>;
}

function Analytics({ state }: { state: EHRState }) {
  const slots = [
    ["Dr. Chen", "2026-09-22", "1 day"], ["Dr. Chen", "2026-09-25", "4 days"], ["Dr. Chen", "2026-09-30", "9 days"],
    ["Dr. Patel", "2026-09-21", "0 days"], ["Dr. Patel", "2026-09-24", "3 days"], ["Dr. Patel", "2026-10-02", "11 days"],
  ];
  const highA1c = state.patients.filter((p) => p.results.some((r) => r.name === "Hemoglobin A1c" && parseFloat(r.value) >= 8));
  return <div className="grid two-one">
    <Panel title="Appointment access" subtitle="Snapshot date: September 21, 2026">
      <div className="metric-row"><div><span>Dr. Chen</span><strong>9 days</strong><small>third next routine opening</small></div><div><span>Dr. Patel</span><strong>11 days</strong><small>third next routine opening</small></div><div><span>Practice</span><strong>10 days</strong><small>mean of provider measures</small></div></div>
      <SimpleTable heads={["Provider", "Open date", "Days from snapshot"]} rows={slots} />
      <p className="help">The first opening may reflect a cancellation. The third opening provides a more stable access signal. Stratify by provider and visit type before making a scheduling decision.</p>
    </Panel>
    <div className="stack"><Panel title="Population cohort" subtitle="Deterministic synthetic data"><div className="big-number">{highA1c.length}<small>patients with displayed A1c ≥ 8.0%</small></div><ul>{highA1c.map((p) => <li key={p.id}>{p.name} · {p.mrn}</li>)}</ul></Panel><Panel title="Data quality checks"><ul className="checklist"><li>Define the denominator</li><li>Confirm units and dates</li><li>Look for missing results</li><li>Stratify by access and patient characteristics</li><li>Validate before outreach</li></ul></Panel></div>
  </div>;
}

function AIReview({ patient, audit }: { patient: Patient; audit: (a: string, d: string, p?: string) => void }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({ unsupportedExam: false, wrongLaterality: false, omittedAllergy: false, inventedPlan: false });
  const [decision, setDecision] = useState("");
  const issues = [
    ["unsupportedExam", "Unsupported normal neurologic examination", "The source explicitly says the neurologic examination was not performed."],
    ["wrongLaterality", "Incorrect left shoulder laterality", "The chart problem and encounter evidence describe the right shoulder."],
    ["omittedAllergy", "Penicillin allergy omitted from safety context", `The chart lists ${patient.allergies[0].allergen} and ${patient.allergies[0].reaction || "no reaction"}.`],
    ["inventedPlan", "MRI and opioid plan invented", "The supplied encounter evidence does not include either action."],
  ];
  return <div className="grid two-one">
    <Panel title="AI-generated draft" subtitle="Scripted teaching output · not a live model">
      <article className="ai-draft"><header><Status tone="warn">Draft requires review</Status><span>Generated from the simulated visit</span></header><h3>Visit summary</h3><p>Liu Huang presents with worsening <mark>left</mark> shoulder pain after a fall. Neurologic examination is normal. Assessment is shoulder bursitis. Plan: start amoxicillin, order an MRI, and prescribe a short course of opioid medication.</p><h4>Sources claimed by the draft</h4><ul><li>Current encounter</li><li>Problem list</li><li>Medication list</li></ul></article>
      <div className="evidence-list"><h3>Review findings</h3>{issues.map(([id, title, evidence]) => <label key={id}><input type="checkbox" checked={checks[id]} onChange={(e) => setChecks({ ...checks, [id]: e.target.checked })} /><span><strong>{title}</strong><small>{evidence}</small></span></label>)}</div>
    </Panel>
    <div className="stack"><Panel title="Human review decision" subtitle="The signer remains accountable"><label>Decision<select value={decision} onChange={(e) => setDecision(e.target.value)}><option value="">Choose a decision</option><option>Reject and redraft from evidence</option><option>Edit and retain with corrections</option><option>Accept without changes</option></select></label><button className="primary" onClick={() => { if (!decision) return alert("Choose a decision."); audit("AI draft review", `${decision}; ${Object.values(checks).filter(Boolean).length} issue(s) identified`, patient.id); }}>Record review</button></Panel><Panel title="Review standard"><ol><li>Compare every clinical claim with a named source.</li><li>Check omissions that affect safety.</li><li>Confirm patient identity, timing, and laterality.</li><li>Document the decision and correction.</li></ol></Panel></div>
  </div>;
}

function Assignments({ state, courseData, exportLearnerReport, refreshCourseData }: { state: EHRState; courseData: CourseData | null; exportLearnerReport: () => void; refreshCourseData: () => Promise<CourseData & { workspace?: unknown }> }) {
  const [active, setActive] = useState(courseAssignments[0].id);
  const [reflection, setReflection] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const assignment = courseAssignments.find((item) => item.id === active) ?? courseAssignments[0];
  const progressFor = (item: CourseAssignment) => assignmentProgress(item, state.audit.map((event) => event.action));
  const progress = progressFor(assignment);
  const submission = courseData?.submissions.find((item) => item.assignment_id === assignment.id);

  async function submit() {
    setSubmitting(true);
    setMessage("");
    try {
      const syncResponse = await fetch("/api/course/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace: state }) });
      if (!syncResponse.ok) throw new Error("Your latest EHR actions could not be synchronized.");
      const response = await fetch("/api/course/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId: assignment.id, reflection: reflection[assignment.id] ?? "" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Submission failed.");
      await refreshCourseData();
      setMessage(`Submitted ${assignment.id} successfully. Version ${payload.version} is ready for grading.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="grid assignment-layout">
    <Panel title="Four graded FordMS assignments" subtitle="Each assignment takes approximately 1–2 hours and records evidence from real actions">
      <div className="assignment-list">{courseAssignments.map((item) => { const itemProgress = progressFor(item); const itemSubmission = courseData?.submissions.find((row) => row.assignment_id === item.id); return <button className={item.id === active ? "selected" : ""} key={item.id} onClick={() => { setActive(item.id); setMessage(""); }}><span className="assignment-number">{item.id.replace("FORDMS-", "")}</span><span><strong>{item.shortTitle}</strong><small>{item.estimatedMinutes} minutes · {item.dueLabel}</small></span><Status tone={itemSubmission?.status === "graded" ? "good" : itemSubmission ? "neutral" : itemProgress.complete ? "good" : "warn"}>{itemSubmission?.status === "graded" ? `${itemSubmission.score}/100` : itemSubmission ? "Submitted" : `${itemProgress.percent}%`}</Status></button>; })}</div>
      <div className="assignment-summary"><strong>Course record</strong><p>Your audit events, progress, submissions, scores, and feedback are saved under your Fordham email.</p><button onClick={exportLearnerReport}>Download learner report</button></div>
    </Panel>
    <div className="stack">
      <Panel title={assignment.title} subtitle={`${assignment.id} · ${assignment.estimatedMinutes} minutes · Individual`}>
        <div className="assignment-header"><div><span>Due</span><strong>{assignment.dueLabel}</strong></div><div><span>Action progress</span><strong>{progress.completedUnits}/{progress.totalUnits} · {progress.percent}%</strong></div><div><span>Status</span><strong>{submission?.status === "graded" ? `Graded ${submission.score}/100` : submission ? `Submitted v${submission.version}` : progress.complete ? "Ready to submit" : "In progress"}</strong></div></div>
        <div className="assignment-body"><h3>Scenario</h3><p>{assignment.scenario}</p><h3>Learning objectives</h3><ol>{assignment.objectives.map((item) => <li key={item}>{item}</li>)}</ol><h3>Required workflow</h3><ol>{assignment.workflow.map((item) => <li key={item}>{item}</li>)}</ol></div>
      </Panel>
      <Panel title="Action evidence" subtitle="Progress is calculated from timestamped EHR audit events">
        <div className="evidence-list">{progress.requirements.map((requirement) => { const events = state.audit.filter((event) => event.action === requirement.action); return <div className={requirement.complete ? "evidence-complete" : ""} key={requirement.action}><span aria-hidden="true">{requirement.complete ? "✓" : "○"}</span><span><strong>{requirement.label}</strong><small>{requirement.completedCount}/{requirement.minimumCount} required · {events[0] ? `${events[0].timestamp} · ${events[0].detail}` : "Complete this action in the relevant workspace."}</small></span></div>; })}</div>
      </Panel>
      <Panel title="Rubric" subtitle="100 points"><table><thead><tr><th>Criterion</th><th>Points</th><th>Standard</th></tr></thead><tbody>{assignment.rubric.map((item) => <tr key={item.criterion}><td>{item.criterion}</td><td>{item.points}</td><td>{item.standard}</td></tr>)}</tbody></table></Panel>
      <Panel title="Submit for grading" subtitle="You may resubmit; the newest version replaces the earlier submission">
        <div className="submission-box"><p>{assignment.submissionPrompt}</p><label>Written analysis<textarea rows={9} value={reflection[assignment.id] ?? ""} onChange={(event) => setReflection({ ...reflection, [assignment.id]: event.target.value })} placeholder="Write your evidence-based analysis here. Do not include real patient information." /></label><div className="submission-actions"><span>{(reflection[assignment.id] ?? "").length} characters</span><button className="primary" disabled={!progress.complete || submitting} onClick={submit}>{submitting ? "Submitting…" : submission ? "Resubmit assignment" : "Submit assignment"}</button></div>{message && <p className={message.startsWith("Submitted") ? "form-message success" : "form-message error"}>{message}</p>}{submission?.feedback && <div className="feedback-card"><strong>Instructor feedback · {submission.score}/100</strong><p>{submission.feedback}</p></div>}</div>
      </Panel>
    </div>
  </div>;
}

interface InstructorData {
  assignments: Array<CourseAssignment & { instructorBenchmark: string[] }>;
  students: Array<{
    email: string;
    name: string;
    last_login_at: string;
    progress: Array<{ assignment_id: string; percent_complete: number; updated_at: string }>;
    submissions: Array<CourseSubmission & { reflection: string; evidence: Array<{ action?: string; detail?: string; timestamp?: string }> }>;
  }>;
}

function Gradebook() {
  const [data, setData] = useState<InstructorData | null>(null);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [assignmentId, setAssignmentId] = useState(courseAssignments[0].id);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/instructor/grade", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Gradebook could not be loaded.");
    setData(payload);
    setSelectedEmail((current) => current || payload.students[0]?.email || "");
  }
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);
  const student = data?.students.find((item) => item.email === selectedEmail);
  const assignment = data?.assignments.find((item) => item.id === assignmentId);
  const submission = student?.submissions.find((item) => item.assignment_id === assignmentId);
  useEffect(() => { setScore(submission?.score == null ? "" : String(submission.score)); setFeedback(submission?.feedback ?? ""); setMessage(""); }, [submission?.score, submission?.feedback, selectedEmail, assignmentId]);

  async function saveGrade() {
    const response = await fetch("/api/instructor/grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: selectedEmail, assignmentId, score: Number(score), feedback }) });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error || "Grade could not be saved.");
    await load();
    setMessage("Grade and feedback saved.");
  }

  if (!data) return <Panel title="Instructor gradebook" subtitle="Loading authenticated course records"><p className="empty">{message || "Loading students, progress, and submissions…"}</p></Panel>;
  return <div className="grid gradebook-layout">
    <Panel title="Students" subtitle={`${data.students.length} Fordham course account(s)`}><div className="student-list">{data.students.length ? data.students.map((item) => { const graded = item.submissions.filter((submission) => submission.status === "graded" && submission.score != null); const average = graded.length ? Math.round(graded.reduce((sum, row) => sum + Number(row.score), 0) / graded.length) : null; return <button className={item.email === selectedEmail ? "selected" : ""} key={item.email} onClick={() => setSelectedEmail(item.email)}><strong>{item.name || item.email}</strong><span>{item.email}</span><small>{item.submissions.length}/4 submitted · {average == null ? "No grades" : `${average}% average`}</small></button>; }) : <p className="empty">No students have signed in yet.</p>}</div></Panel>
    <div className="stack">
      <Panel title="Assignment record" subtitle={student ? `${student.name} · ${student.email}` : "Select a student"}><div className="gradebook-tabs">{data.assignments.map((item) => { const row = student?.submissions.find((submission) => submission.assignment_id === item.id); const progress = student?.progress.find((entry) => entry.assignment_id === item.id)?.percent_complete ?? 0; return <button className={item.id === assignmentId ? "active" : ""} key={item.id} onClick={() => setAssignmentId(item.id)}><strong>{item.id.replace("FORDMS-", "")}</strong><span>{row?.status === "graded" ? `${row.score}/100` : row ? "Submitted" : `${progress}%`}</span></button>; })}</div></Panel>
      {assignment && <Panel title={assignment.title} subtitle={`${assignment.id} · ${student?.progress.find((entry) => entry.assignment_id === assignment.id)?.percent_complete ?? 0}% action completion`}><div className="assignment-body"><h3>Rubric</h3><ul>{assignment.rubric.map((item) => <li key={item.criterion}><strong>{item.criterion} · {item.points}</strong><br />{item.standard}</li>)}</ul><h3>Instructor benchmark</h3><ul>{assignment.instructorBenchmark.map((item) => <li key={item}>{item}</li>)}</ul></div></Panel>}
      <Panel title="Student submission" subtitle={submission ? `Version ${submission.version} · ${new Date(submission.submitted_at).toLocaleString()}` : "No submission received"}>{submission ? <div className="submission-box"><h3>Written analysis</h3><p className="student-response">{submission.reflection}</p><h3>Captured evidence</h3><div className="evidence-list">{submission.evidence.map((item, index) => <div key={`${item.action}-${index}`}><span>✓</span><span><strong>{item.action}</strong><small>{item.timestamp} · {item.detail}</small></span></div>)}</div><div className="grade-entry"><label>Score<input type="number" min="0" max="100" value={score} onChange={(event) => setScore(event.target.value)} /></label><label>Instructor feedback<textarea rows={7} value={feedback} onChange={(event) => setFeedback(event.target.value)} /></label><button className="primary" onClick={saveGrade}>Save grade and feedback</button>{message && <p className={message.startsWith("Grade") ? "form-message success" : "form-message error"}>{message}</p>}</div></div> : <p className="empty">The student has not submitted this assignment.</p>}</Panel>
    </div>
  </div>;
}

function SimpleTable({ heads, rows }: { heads: string[]; rows: string[][] }) {
  return <table><thead><tr>{heads.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table>;
}
