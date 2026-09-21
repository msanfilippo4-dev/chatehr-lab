"use client";

import { useState } from "react";
import { InlineAlert, Panel, SimpleTable, SimulationBadge, Status } from "@/components/ui/primitives";
import type { CodeEntry } from "@/lib/config/types";
import type { ViewProps } from "./shared";

const tabs = ["Summary", "Problems", "Medications", "Allergies", "Vitals", "Results", "Notes", "Audit", "Coding"] as const;

export function Patients({ state, dispatch, config, patient, selectPatient, setView }: ViewProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<(typeof tabs)[number]>("Summary");
  const filtered = state.patients.filter((p) => `${p.name} ${p.mrn} ${p.dob}`.toLowerCase().includes(query.toLowerCase()));
  const duplicate = patient.duplicateCandidate ? state.patients.find((p) => p.id === patient.duplicateCandidate) : null;
  const escalated = state.audit.some((event) => event.action === "Escalate identity review" && event.patientId === patient.id);
  return <div className="grid directory">
    <Panel title="Patient search" subtitle="Search before creating a record" actions={<button onClick={() => setView("Registration")}>New patient</button>}>
      <input className="search" aria-label="Search patients" placeholder="Name, MRN, or date of birth" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="patient-list">{filtered.map((p) => <button className={p.id === patient.id ? "selected" : ""} key={p.id} onClick={() => { selectPatient(p.id); dispatch({ type: "openChart", patientId: p.id }); }}><strong>{p.name}</strong><span>{p.mrn} · {p.dob}</span>{p.duplicateCandidate && <Status tone="warn">Possible duplicate</Status>}{p.registeredAt && <Status tone="info">New</Status>}</button>)}</div>
    </Panel>
    <Panel title={patient.name} subtitle={`${patient.mrn} · ${patient.dob} · ${patient.pronouns}`}>
      {duplicate && <InlineAlert tone="warn" title="Possible duplicate record"><p>Compare identifiers with {duplicate.name} ({duplicate.mrn}). Do not merge based on name alone.</p><div className="button-row"><button onClick={() => dispatch({ type: "escalateIdentity", patientId: patient.id, candidateId: duplicate.id })}>{escalated ? "Sent to HIM identity queue ✓ (send again)" : "Send to HIM identity queue"}</button><button onClick={() => setView("MPI")}>Open MPI workbench</button></div></InlineAlert>}
      <div className="subtabs" role="tablist">{tabs.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => { setTab(t); if (t === "Audit") dispatch({ type: "reviewAudit", patientId: patient.id }); }}>{t}</button>)}</div>
      {tab === "Summary" && <div className="summary-grid"><dl className="facts"><div><dt>Address</dt><dd>{patient.address}</dd></div><div><dt>Phone</dt><dd>{patient.phone}</dd></div><div><dt>Preferred language</dt><dd>{patient.language}</dd></div><div><dt>Coverage</dt><dd>{patient.insurance}{patient.memberId ? ` · ${patient.memberId}` : ""}</dd></div>{patient.proxyAccess?.length ? <div><dt>Proxy access</dt><dd>{patient.proxyAccess.map((proxy) => `${proxy.name} (${proxy.relationship}; ${proxy.scope})`).join("; ")}</dd></div> : null}</dl><div><h3>Clinical snapshot</h3><p><strong>Problems:</strong> {patient.problems.map((p) => p.display).join(", ") || "None recorded"}</p><p><strong>Medications:</strong> {patient.medications.map((m) => m.name).join(", ") || "None recorded"}</p><p><strong>Allergies:</strong> {patient.allergies.map((a) => `${a.allergen}${a.reaction ? ` (${a.reaction})` : ""}`).join(", ") || "Not reviewed"}</p></div></div>}
      {tab === "Problems" && <SimpleTable heads={["Code", "Problem", "Onset"]} rows={patient.problems.map((p) => [p.code, p.display, p.onset])} />}
      {tab === "Medications" && <SimpleTable heads={["Medication", "Instructions", "Status"]} rows={patient.medications.map((m) => [m.name, m.sig, m.status])} />}
      {tab === "Allergies" && <SimpleTable heads={["Allergen", "Reaction", "Severity"]} rows={patient.allergies.map((a) => [a.allergen, a.reaction || "Not recorded", a.severity])} />}
      {tab === "Vitals" && <SimpleTable heads={["Date", "Blood pressure", "Heart rate", "Weight"]} rows={patient.vitals.map((v) => [v.date, v.bp, String(v.hr), v.weight])} />}
      {tab === "Results" && <SimpleTable heads={["Date", "Test", "Value", "Flag", "Status"]} rows={patient.results.map((r) => [r.date, r.name, r.value || "—", r.flag || "Normal", r.status])} />}
      {tab === "Notes" && <div className="timeline">{patient.notes.length ? patient.notes.map((n) => <article key={n.id}><header><strong>{n.kind}{n.cosignedBy && <span className="cosign"> · co-signed by {n.cosignedBy}</span>}</strong><span>{new Date(n.recordedAt).toLocaleString()} · {n.author}</span></header><p><b>S:</b> {n.subjective}</p><p><b>O:</b> {n.objective}</p><p><b>A:</b> {n.assessment}</p><p><b>P:</b> {n.plan}</p>{n.amendmentReason && <p><b>Reason:</b> {n.amendmentReason}</p>}{n.copiedForwardFrom && <p className="help">Content copied forward from {n.copiedForwardFrom} and re-verified before signing.</p>}</article>) : <p className="empty">No notes have been created in this practice workspace.</p>}</div>}
      {tab === "Audit" && <SimpleTable heads={["Time", "Actor", "Action", "Detail"]} rows={state.audit.filter((a) => !a.patientId || a.patientId === patient.id).slice(0, 25).map((a) => [new Date(a.timestamp).toLocaleString(), a.actor, a.action, a.detail])} />}
      {tab === "Coding" && <CodeSearch patientId={patient.id} icd={config.icd10Catalog} cpt={config.cptCatalog} version={config.meta.version} onUse={(entry) => dispatch({ type: "useCode", patientId: patient.id, entry })} />}
    </Panel>
  </div>;
}

export function CodeSearch({ patientId, icd, cpt, version, onUse }: { patientId: string; icd: CodeEntry[]; cpt: CodeEntry[]; version: number; onUse: (entry: CodeEntry) => void }) {
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState<"All" | "ICD-10-CM" | "CPT">("All");
  const rows = [...icd, ...cpt].filter((c) => (system === "All" || c.system === system) && `${c.system} ${c.code} ${c.display} ${c.use}`.toLowerCase().includes(query.toLowerCase()));
  const icdVersion = icd[0]?.version ?? "FY2027";
  return <div>
    <InlineAlert tone="info" title={`Teaching code list · configuration version ${version}`}><p>Examples only. {icdVersion} ICD-10-CM applies to dates of service beginning {icd[0]?.effectiveDate ?? "October 1, 2026"}. CPT descriptions are plain-language summaries, not official descriptors. Verify the official code set effective on the date of service.</p></InlineAlert>
    <div className="filter-bar"><input className="search" aria-label="Search codes" placeholder="Search code, term, or use" value={query} onChange={(e) => setQuery(e.target.value)} /><label>System<select aria-label="Code system" value={system} onChange={(e) => setSystem(e.target.value as typeof system)}><option>All</option><option>ICD-10-CM</option><option>CPT</option></select></label></div>
    <table><thead><tr><th>System</th><th>Code</th><th>Display</th><th>Represents</th><th>Teaching note</th><th>Evidence</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.system}-${row.code}`}><td>{row.system}<small>{row.version} · {row.status}</small></td><td><strong>{row.code}</strong></td><td>{row.display}</td><td>{row.use}</td><td><small>{row.teachingNote}</small></td><td><button onClick={() => onUse(row)} aria-label={`Record use of ${row.system} ${row.code} for ${patientId}`}>Record use</button></td></tr>)}</tbody></table>
    <p className="help">Diagnosis codes explain why a service happened; CPT codes describe what service was performed. <SimulationBadge /></p>
  </div>;
}
