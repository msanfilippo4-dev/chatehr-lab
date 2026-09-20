"use client";

import "./accessibility.css";
import "./advanced.css";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { loadState, normalizeState, saveState } from "@/lib/db";
import { codeExamples, initialState } from "@/lib/seed";
import type { Appointment, EHRState, NoteVersion, Order, Patient, Role } from "@/lib/types";
import { HIEReconciliation, ImplementationReadiness, MPIWorkbench, QueryStudio } from "./advanced";

type View = "Worklist" | "Schedule" | "Patients" | "MPI" | "Encounter" | "Orders & Results" | "Portal" | "HIE" | "Analytics" | "Query Studio" | "AI Review" | "Implementation" | "Exercises";

const views: View[] = ["Worklist", "Schedule", "Patients", "MPI", "Encounter", "Orders & Results", "Portal", "HIE", "Analytics", "Query Studio", "AI Review", "Implementation", "Exercises"];
const roles: Role[] = ["Front Desk", "Clinical", "HIM", "Patient", "Analyst", "Implementation Lead"];
const roleViews: Record<Role, View[]> = {
  "Front Desk": ["Worklist", "Schedule", "Patients", "MPI", "Exercises"],
  Clinical: ["Worklist", "Patients", "Encounter", "Orders & Results", "Portal", "HIE", "AI Review", "Exercises"],
  HIM: ["Worklist", "Patients", "MPI", "HIE", "Analytics", "Exercises"],
  Patient: ["Portal", "Exercises"],
  Analyst: ["Worklist", "Analytics", "Query Studio", "HIE", "Exercises"],
  "Implementation Lead": ["Worklist", "Analytics", "Implementation", "Exercises"],
};

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
  const [state, setState] = useState<EHRState>(initialState);
  const [ready, setReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState("Loading local course workspace...");
  const [role, setRole] = useState<Role>("Clinical");
  const [view, setView] = useState<View>("Worklist");
  const [selectedPatientId, setSelectedPatientId] = useState("PT-001");

  useEffect(() => {
    loadState().then((saved) => {
      if (saved) setState(saved);
      setStorageMessage(saved ? "Saved course workspace restored and updated to schema version 2." : "New course workspace created in this browser.");
    }).catch(() => setStorageMessage("Browser storage is unavailable. Work remains available until this tab closes; export evidence before leaving.")).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveState(state).then(() => setStorageMessage("All changes saved in this browser.")).catch(() => setStorageMessage("Could not save to browser storage. Export evidence before leaving."));
  }, [state, ready]);

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
      workspaceVersion: state.version,
      progress: state.exercises.map((exercise) => {
        const completed = exercise.requiredAuditActions.filter((action) => state.audit.some((event) => event.action === action));
        return { id: exercise.id, title: exercise.title, completedActions: completed, requiredActions: exercise.requiredAuditActions, complete: completed.length === exercise.requiredAuditActions.length };
      }),
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
      <div className="brand"><span className="brand-mark" aria-hidden="true">F</span><div><span className="brand-university">Fordham University</span><strong>Practice EHR</strong><small>HINF 6105 · Electronic Health Records</small></div></div>
      <div className="top-actions">
        <label className="role-label">Role<select aria-label="Select simulated role" value={role} onChange={(e) => { const next = e.target.value as Role; setRole(next); setView(next === "Front Desk" ? "Schedule" : next === "HIM" ? "MPI" : next === "Patient" ? "Portal" : next === "Analyst" ? "Query Studio" : next === "Implementation Lead" ? "Implementation" : "Worklist"); }}>{roles.map((r) => <option key={r}>{r}</option>)}</select></label>
        <button onClick={exportWorkspace}>Export evidence</button>
        <label className="buttonlike">Import<input aria-label="Import workspace" type="file" accept="application/json" onChange={importWorkspace} /></label>
        <button className="danger-button" onClick={resetWorkspace}>Reset</button>
      </div>
    </header>
    <div className="storage-line"><span className={storageMessage.includes("unavailable") || storageMessage.includes("failed") ? "storage-error" : "storage-ok"} />{storageMessage}</div>
    <nav className="nav-tabs" aria-label="Practice EHR modules">{views.filter((item) => roleViews[role].includes(item)).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</nav>
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
      {view === "Exercises" && <Exercises state={state} exportLearnerReport={exportLearnerReport} />}
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
      {tab === "Coding" && <CodeSearch />}
    </Panel>
  </div>;
}

function CodeSearch() {
  const [query, setQuery] = useState("");
  const rows = codeExamples.filter((c) => `${c.system} ${c.code} ${c.display}`.toLowerCase().includes(query.toLowerCase()));
  return <div><div className="inline-alert info"><strong>Teaching code list</strong><p>Examples only. Verify the official code set effective on the date of service. FY2027 ICD-10-CM applies beginning October 1, 2026.</p></div><input className="search" placeholder="Search code or term" value={query} onChange={(e) => setQuery(e.target.value)} /><SimpleTable heads={["System", "Code", "Display", "Represents"]} rows={rows.map((r) => [r.system, r.code, r.display, r.use])} /></div>;
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

function Exercises({ state, exportLearnerReport }: { state: EHRState; exportLearnerReport: () => void }) {
  const [active, setActive] = useState(state.exercises[0].id);
  const exercise = state.exercises.find((x) => x.id === active)!;
  const progress = (item: typeof exercise) => item.requiredAuditActions.filter((action) => state.audit.some((event) => event.action === action));
  const completed = progress(exercise);
  return <div className="grid directory"><Panel title="Course exercise center" subtitle="Completion comes from actions recorded in the audit trail"><div className="patient-list">{state.exercises.map((item) => { const done = progress(item); return <button className={item.id === active ? "selected" : ""} key={item.id} onClick={() => setActive(item.id)}><strong>{item.title}</strong><span>{item.durationMinutes} minutes · {item.teamSize}</span><Status tone={done.length === item.requiredAuditActions.length ? "good" : "warn"}>{done.length}/{item.requiredAuditActions.length} actions</Status></button>; })}</div></Panel><Panel title={exercise.title} subtitle={`${exercise.id} · ${exercise.durationMinutes} minutes · ${exercise.teamSize}`}><p>{exercise.summary}</p><h3>Learning objectives</h3><ul className="checklist">{exercise.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul><h3>Action evidence</h3><div className="evidence-list">{exercise.requiredAuditActions.map((action) => { const event = state.audit.find((row) => row.action === action); return <div className={event ? "evidence-complete" : ""} key={action}><span aria-hidden="true">{event ? "✓" : "○"}</span><span><strong>{action}</strong><small>{event ? `${event.timestamp} · ${event.detail}` : "Complete the action in the relevant workspace to record evidence automatically."}</small></span></div>; })}</div><div className="inline-alert info"><strong>Evidence package</strong><p>Download the learner report or print this view. Blackboard remains the submission and grading system.</p><button className="primary" onClick={exportLearnerReport}>Download learner report</button></div><p className="help">{completed.length === exercise.requiredAuditActions.length ? "All required actions are present in the audit trail." : `${exercise.requiredAuditActions.length - completed.length} required action(s) remain.`}</p></Panel></div>;
}

function SimpleTable({ heads, rows }: { heads: string[]; rows: string[][] }) {
  return <table><thead><tr>{heads.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table>;
}
