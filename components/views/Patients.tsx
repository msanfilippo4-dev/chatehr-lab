"use client";

import { useEffect, useState } from "react";
import { InlineAlert, Panel, SimpleTable, SimulationBadge, Status } from "@/components/ui/primitives";
import type { CodeEntry } from "@/lib/config/types";
import { ageOn, isAbnormal, resultValue } from "@/lib/patient";
import type { NoteVersion, Patient } from "@/lib/types";
import type { ViewProps } from "./shared";

const TABS = ["Summary", "Problems", "Medications", "Allergies", "Vitals", "Results", "Notes", "Encounters", "Audit", "Coding"] as const;
type Tab = (typeof TABS)[number];

function tabFromParam(value: string | undefined): Tab | undefined {
  if (!value) return undefined;
  return TABS.find((tab) => tab.toLowerCase() === value.toLowerCase());
}

export function Patients(props: ViewProps) {
  const { state, dispatch, patient, chartTab } = props;
  const [tab, setTab] = useState<Tab>(tabFromParam(chartTab) ?? "Summary");

  useEffect(() => {
    const requested = tabFromParam(chartTab);
    if (requested) setTab(requested);
  }, [chartTab, patient.id]);

  function chooseTab(next: Tab) {
    setTab(next);
    if (next === "Audit") dispatch({ type: "reviewAudit", patientId: patient.id });
  }

  return (
    <div className="grid directory">
      <PatientDirectory {...props} />
      <Panel title={patient.name} subtitle={`MRN ${patient.mrn} · DOB ${patient.dob} · ${ageOn(patient.dob)} y · ${patient.pronouns}`}>
        <DuplicateAlert {...props} />
        <div className="subtabs" role="tablist" aria-label="Chart sections">
          {TABS.map((item) => (
            <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => chooseTab(item)}>{item}</button>
          ))}
        </div>
        {tab === "Summary" && <SummaryTab patient={patient} />}
        {tab === "Problems" && (
          <SimpleTable heads={["Code", "Problem", "Onset", "Status"]} rows={patient.problems.map((item) => [<strong key="c">{item.code}</strong>, item.display, item.onset, item.status ?? "Active"])} />
        )}
        {tab === "Medications" && (
          <SimpleTable
            heads={["Medication", "Instructions", "Route · frequency", "Status"]}
            rows={patient.medications.map((item) => [
              <span key="n">{item.name}{item.indication && <small>For {item.indication.toLowerCase()} · {item.prescriber}</small>}</span>,
              item.sig,
              [item.route, item.frequency].filter(Boolean).join(" · ") || "—",
              <Status key="s" tone={item.status === "Active" ? "good" : "warn"}>{item.status}</Status>,
            ])}
          />
        )}
        {tab === "Allergies" && <AllergiesTab patient={patient} />}
        {tab === "Vitals" && (
          <SimpleTable
            heads={["Date", "Blood pressure", "Heart rate", "Resp rate", "Temp", "SpO₂", "Weight"]}
            rows={patient.vitals.map((item) => [item.date, item.bp, String(item.hr), item.rr ? String(item.rr) : "—", item.temp ?? "—", item.spo2 ? `${item.spo2}%` : "—", item.weight])}
          />
        )}
        {tab === "Results" && <ResultsTab patient={patient} />}
        {tab === "Notes" && <NotesTab patient={patient} />}
        {tab === "Encounters" && (
          <SimpleTable
            heads={["Date", "Type", "Provider", "Department", "Reason", "Status"]}
            rows={(patient.encounters ?? []).map((item) => [item.date, item.type, item.provider, item.department, item.reason, <Status key="s" tone={item.status === "Completed" ? "good" : item.status === "No-show" ? "danger" : "info"}>{item.status}</Status>])}
          />
        )}
        {tab === "Audit" && (
          <SimpleTable
            heads={["Time", "Actor", "Action", "Detail"]}
            rows={state.audit.filter((event) => !event.patientId || event.patientId === patient.id).slice(0, 25).map((event) => [new Date(event.timestamp).toLocaleString(), event.actor, event.action, event.detail])}
          />
        )}
        {tab === "Coding" && (
          <CodeSearch patientId={patient.id} icd={props.config.icd10Catalog} cpt={props.config.cptCatalog} version={props.config.meta.version} onUse={(entry) => dispatch({ type: "useCode", patientId: patient.id, entry })} />
        )}
      </Panel>
    </div>
  );
}

function PatientDirectory({ state, dispatch, patient, selectPatient, setView }: ViewProps) {
  const [query, setQuery] = useState("");
  const filtered = state.patients.filter((item) => `${item.name} ${item.mrn} ${item.dob}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <Panel title="Patient search" subtitle="Search before creating a record" actions={<button onClick={() => setView("Registration")}>New patient</button>}>
      <input className="search" aria-label="Search patients" placeholder="Name, MRN, or date of birth" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="patient-list">
        {filtered.map((item) => (
          <button
            className={item.id === patient.id ? "selected" : ""}
            key={item.id}
            onClick={() => { selectPatient(item.id); dispatch({ type: "openChart", patientId: item.id }); }}
          >
            <strong>{item.name}</strong>
            <span>{item.mrn} · {item.dob}{item.location ? ` · ${item.location}` : ""}</span>
            {item.duplicateCandidate && <Status tone="warn">Possible duplicate</Status>}
            {item.registeredAt && <Status tone="info">New</Status>}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function DuplicateAlert({ state, dispatch, patient, setView }: ViewProps) {
  const duplicate = patient.duplicateCandidate ? state.patients.find((item) => item.id === patient.duplicateCandidate) : null;
  if (!duplicate) return null;
  const escalated = state.audit.some((event) => event.action === "Escalate identity review" && event.patientId === patient.id);
  return (
    <InlineAlert tone="warn" title="Possible duplicate record">
      <p>Compare identifiers with {duplicate.name} ({duplicate.mrn}). Do not merge based on name alone.</p>
      <div className="button-row">
        <button onClick={() => dispatch({ type: "escalateIdentity", patientId: patient.id, candidateId: duplicate.id })}>
          {escalated ? "Sent to HIM identity queue ✓ (send again)" : "Send to HIM identity queue"}
        </button>
        <button onClick={() => setView("MPI")}>Open MPI workbench</button>
      </div>
    </InlineAlert>
  );
}

function SummaryTab({ patient }: { patient: Patient }) {
  return (
    <div className="summary-grid">
      <dl className="facts">
        <div><dt>Address</dt><dd>{patient.address}</dd></div>
        <div><dt>Phone</dt><dd>{patient.phone}</dd></div>
        <div><dt>Preferred language</dt><dd>{patient.language}{patient.interpreterNeeded ? " · interpreter needed" : ""}</dd></div>
        {patient.genderIdentity && <div><dt>Gender identity · sex assigned at birth</dt><dd>{patient.genderIdentity} · {patient.sexAssignedAtBirth ?? "—"}</dd></div>}
        {patient.legalNameOnCoverage && <div><dt>Legal name on coverage</dt><dd>{patient.legalNameOnCoverage} <small className="help">Use for claims only; address the patient as {patient.name.split(" ")[0]} ({patient.pronouns}).</small></dd></div>}
        <div><dt>Coverage</dt><dd>{patient.insurance}{patient.memberId ? ` · ${patient.memberId}` : ""}</dd></div>
        {patient.proxyAccess?.length ? (
          <div><dt>Proxy access</dt><dd>{patient.proxyAccess.map((proxy) => `${proxy.name} (${proxy.relationship}; ${proxy.scope})`).join("; ")}</dd></div>
        ) : null}
      </dl>
      <div>
        <h3>Care team</h3>
        <ul className="care-team">
          {(patient.careTeam ?? []).map((member) => <li key={member.name}><strong>{member.name}</strong><span>{member.role}</span></li>)}
          {!(patient.careTeam ?? []).length && <li className="empty">No care team recorded.</li>}
        </ul>
        <h3>Clinical snapshot</h3>
        <p><strong>Problems:</strong> {patient.problems.filter((item) => item.status !== "Resolved").map((item) => item.display).join(", ") || "None recorded"}</p>
        <p><strong>Medications:</strong> {patient.medications.map((item) => item.name).join(", ") || "None recorded"}</p>
        <p><strong>Allergies:</strong> {patient.allergies.map((item) => `${item.allergen}${item.reaction ? ` (${item.reaction})` : ""}`).join(", ") || "Not reviewed"}</p>
      </div>
    </div>
  );
}

function AllergiesTab({ patient }: { patient: Patient }) {
  return (
    <>
      <SimpleTable
        heads={["Allergen", "Type", "Reaction", "Severity", "Verified"]}
        rows={patient.allergies.map((item) => [
          <strong key="a">{item.allergen}</strong>,
          item.type ? <Status key="t" tone={item.type === "Allergy" ? "danger" : "warn"}>{item.type}</Status> : "—",
          item.reaction || "Not recorded",
          item.severity,
          item.verified ?? "—",
        ])}
      />
      <p className="help chart-help">An allergy is an immune reaction (hives, anaphylaxis) that should block or strongly warn on reordering. An intolerance (nausea, cough) is a side effect that deserves a note but usually not a hard stop.</p>
    </>
  );
}

function ResultsTab({ patient }: { patient: Patient }) {
  return (
    <table>
      <thead><tr><th>Date</th><th>Test</th><th>Value</th><th>Reference range</th><th>Flag</th><th>Status</th><th>LOINC</th></tr></thead>
      <tbody>
        {patient.results.map((result, index) => (
          <tr key={`${result.name}-${result.date}-${index}`}>
            <td>{result.date}</td>
            <td>{result.name}{result.orderedBy && <small>Ordered by {result.orderedBy}</small>}</td>
            <td className={isAbnormal(result) ? "abnormal" : ""}>{resultValue(result)}</td>
            <td>{result.range ?? "—"}</td>
            <td>{result.flag ? <Status tone="danger">{result.flag}</Status> : <Status tone="good">Normal</Status>}</td>
            <td>{result.status}</td>
            <td><code>{result.loinc ?? "—"}</code></td>
          </tr>
        ))}
        {!patient.results.length && <tr><td colSpan={7} className="empty">No results on file.</td></tr>}
      </tbody>
    </table>
  );
}

function NotesTab({ patient }: { patient: Patient }) {
  if (!patient.notes.length) return <p className="empty chart-help">No notes have been created in this practice workspace.</p>;
  return (
    <div className="timeline">
      {patient.notes.map((note) => <NoteCard key={note.id} note={note} />)}
    </div>
  );
}

function NoteCard({ note }: { note: NoteVersion }) {
  return (
    <article className={note.confidential ? "confidential-note" : ""}>
      <header>
        <strong>
          {note.kind}
          {note.cosignedBy && <span className="cosign"> · co-signed by {note.cosignedBy}</span>}
          {!note.cosignedBy && note.cosignRequestedFrom && <span className="cosign-pending"> · co-signature requested from {note.cosignRequestedFrom}</span>}
        </strong>
        <span>{new Date(note.recordedAt).toLocaleString()} · {note.author} · {note.id}</span>
      </header>
      <div className="note-tags">
        {note.source && <Status tone={note.source === "AI scribe draft accepted" ? "warn" : "neutral"}>Source: {note.source}</Status>}
        {note.confidential && <Status tone="danger">Confidential adolescent note · not for proxy</Status>}
      </div>
      <p><b>S:</b> {note.subjective}</p>
      <p><b>O:</b> {note.objective}</p>
      <p><b>A:</b> {note.assessment}</p>
      <p><b>P:</b> {note.plan}</p>
      {note.amendmentReason && <p><b>Reason:</b> {note.amendmentReason}</p>}
      {note.copiedForwardFrom && <p className="help">Content copied forward from {note.copiedForwardFrom} and re-verified before signing.</p>}
    </article>
  );
}

export function CodeSearch({ patientId, icd, cpt, version, onUse }: { patientId: string; icd: CodeEntry[]; cpt: CodeEntry[]; version: number; onUse: (entry: CodeEntry) => void }) {
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState<"All" | "ICD-10-CM" | "CPT">("All");
  const rows = [...icd, ...cpt].filter((code) => (system === "All" || code.system === system) && `${code.system} ${code.code} ${code.display} ${code.use}`.toLowerCase().includes(query.toLowerCase()));
  const icdVersion = icd[0]?.version ?? "FY2027";
  return (
    <div>
      <InlineAlert tone="info" title={`Teaching code list · configuration version ${version}`}>
        <p>Examples only. {icdVersion} ICD-10-CM applies to dates of service beginning {icd[0]?.effectiveDate ?? "October 1, 2026"}. CPT descriptions are plain-language summaries, not official descriptors. Verify the official code set effective on the date of service.</p>
      </InlineAlert>
      <div className="filter-bar">
        <input className="search" aria-label="Search codes" placeholder="Search code, term, or use" value={query} onChange={(event) => setQuery(event.target.value)} />
        <label>
          System
          <select aria-label="Code system" value={system} onChange={(event) => setSystem(event.target.value as typeof system)}>
            <option>All</option>
            <option>ICD-10-CM</option>
            <option>CPT</option>
          </select>
        </label>
      </div>
      <table>
        <thead><tr><th>System</th><th>Code</th><th>Display</th><th>Represents</th><th>Teaching note</th><th>Evidence</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.system}-${row.code}-${index}`}>
              <td>{row.system}<small>{row.version} · {row.status}</small></td>
              <td><strong>{row.code}</strong></td>
              <td>{row.display}</td>
              <td>{row.use}</td>
              <td><small>{row.teachingNote}</small></td>
              <td><button onClick={() => onUse(row)} aria-label={`Record use of ${row.system} ${row.code} for ${patientId}`}>Record use</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="help chart-help">Diagnosis codes explain why a service happened; CPT codes describe what service was performed. <SimulationBadge /></p>
    </div>
  );
}
