"use client";

import { useMemo, useState } from "react";
import type { EHRState, IdentityReview, ImplementationCheckpoint } from "@/lib/types";

type SetEHRState = React.Dispatch<React.SetStateAction<EHRState>>;
type Audit = (action: string, detail: string, patientId?: string) => void;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="panel"><div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</section>;
}

function Status({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "danger" }) {
  return <span className={`status ${tone}`}>{children}</span>;
}

export function MPIWorkbench({ state, setState, audit, selectPatient }: { state: EHRState; setState: SetEHRState; audit: Audit; selectPatient: (id: string) => void }) {
  const [activeId, setActiveId] = useState(state.identityReviews[0]?.id ?? "");
  const [decision, setDecision] = useState<IdentityReview["decision"]>();
  const [note, setNote] = useState("");
  const active = state.identityReviews.find((review) => review.id === activeId);
  if (!active) return <Panel title="MPI identity workbench"><p className="empty">No identity reviews are available.</p></Panel>;
  const activeReview = active;
  const first = state.patients.find((patient) => patient.id === active.patientIds[0])!;
  const second = state.patients.find((patient) => patient.id === active.patientIds[1])!;

  function recordDecision() {
    if (!decision || !note.trim()) return alert("Choose a decision and document your reasoning.");
    setState((old) => ({ ...old, identityReviews: old.identityReviews.map((review) => review.id === activeReview.id ? { ...review, status: "Resolved", decision, note: note.trim() } : review) }));
    audit("Resolve identity review", `${activeReview.id}: ${decision}. ${note.trim()}`, first.id);
  }

  return <div className="grid directory">
    <Panel title="Identity queue" subtitle="Potential duplicates require human adjudication">
      <div className="patient-list">{state.identityReviews.map((review) => <button key={review.id} className={review.id === activeId ? "selected" : ""} onClick={() => setActiveId(review.id)}><strong>{review.id}</strong><span>{review.patientIds.join(" ↔ ")}</span><Status tone={review.status === "Resolved" ? "good" : "warn"}>{review.status}</Status></button>)}</div>
      <div className="inline-alert info"><strong>Identity safety rule</strong><p>Never merge on name alone. Compare multiple identifiers, document uncertainty, and route the final merge to authorized HIM staff.</p></div>
    </Panel>
    <Panel title="Side-by-side identity review" subtitle={`${first.mrn} compared with ${second.mrn}`}>
      <div className="compare-head"><button onClick={() => selectPatient(first.id)}>{first.name}<small>{first.id} · {first.mrn}</small></button><span>Match signals</span><button onClick={() => selectPatient(second.id)}>{second.name}<small>{second.id} · {second.mrn}</small></button></div>
      <table><thead><tr><th>Identifier</th><th>{first.name}</th><th>{second.name}</th><th>Signal</th></tr></thead><tbody>{active.signals.map((signal) => <tr key={signal.label}><td><strong>{signal.label}</strong></td><td>{signal.first}</td><td>{signal.second}</td><td><Status tone={signal.strength === "Match" ? "good" : signal.strength === "Difference" ? "danger" : "warn"}>{signal.strength}</Status></td></tr>)}</tbody></table>
      <div className="decision-box"><label>Identity decision<select aria-label="Identity decision" value={decision ?? active.decision ?? ""} onChange={(event) => setDecision(event.target.value as IdentityReview["decision"])}><option value="">Choose a decision</option><option>Same person — queue merge</option><option>Different people — retain both</option><option>Need more information</option></select></label><label>Reasoning and next step<textarea aria-label="Identity review reasoning" rows={4} value={note || active.note || ""} onChange={(event) => setNote(event.target.value)} placeholder="Cite the identifiers that support your decision and any verification still needed." /></label><button className="primary" onClick={recordDecision}>Record identity decision</button>{active.status === "Resolved" && <p className="form-message success">Decision recorded. Any actual merge remains queued for authorized HIM review.</p>}</div>
    </Panel>
  </div>;
}

export function HIEReconciliation({ state, setState, audit }: { state: EHRState; setState: SetEHRState; audit: Audit }) {
  const [patientFilter, setPatientFilter] = useState("All");
  const visible = state.exchanges.filter((item) => patientFilter === "All" || item.patientId === patientFilter);
  function reconcile(id: string, status: "Accepted" | "Kept local" | "Deferred") {
    const item = state.exchanges.find((row) => row.id === id)!;
    setState((old) => ({ ...old, exchanges: old.exchanges.map((row) => row.id === id ? { ...row, status, reviewerNote: status === "Accepted" ? "Accepted into the longitudinal record after provenance review." : status === "Kept local" ? "Local value retained; external source remains visible in history." : "Deferred for source verification." } : row) }));
    audit("Reconcile external item", `${item.resourceType} from ${item.sourceOrganization}: ${status}`, item.patientId);
  }
  return <div className="stack">
    <Panel title="HIE reconciliation inbox" subtitle="FHIR-like resources with provenance, patient-match confidence, and discrepancy review">
      <div className="filter-bar"><label>Patient filter<select aria-label="HIE patient filter" value={patientFilter} onChange={(event) => setPatientFilter(event.target.value)}><option>All</option>{state.patients.filter((patient) => state.exchanges.some((item) => item.patientId === patient.id)).map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.mrn}</option>)}</select></label><span><b>{visible.filter((item) => item.status === "Pending review").length}</b> pending of {visible.length}</span></div>
    </Panel>
    <div className="exchange-grid">{visible.map((item) => { const patient = state.patients.find((row) => row.id === item.patientId)!; return <article className="exchange-card" key={item.id}><header><div><span className="resource-type">{item.resourceType}</span><h3>{patient.name}</h3><small>{patient.mrn} · source ID {item.sourcePatientId}</small></div><Status tone={item.status === "Accepted" ? "good" : item.status === "Pending review" ? "warn" : "neutral"}>{item.status}</Status></header><dl className="provenance"><div><dt>Source</dt><dd>{item.sourceOrganization}</dd></div><div><dt>Received</dt><dd>{item.receivedAt}</dd></div><div><dt>Source time</dt><dd>{item.sourceTimestamp}</dd></div><div><dt>Identity confidence</dt><dd>{Math.round(item.matchScore * 100)}%</dd></div></dl><div className="value-compare"><div><small>Local record</small><p>{item.localValue}</p></div><div><small>Incoming resource</small><p>{item.incomingValue}</p></div></div><p className="discrepancy"><b>Review point:</b> {item.discrepancy}</p>{item.reviewerNote && <p className="reviewer-note">{item.reviewerNote}</p>}<div className="button-row"><button className="primary" onClick={() => reconcile(item.id, "Accepted")}>Accept into chart</button><button onClick={() => reconcile(item.id, "Kept local")}>Keep local</button><button onClick={() => reconcile(item.id, "Deferred")}>Defer</button></div></article>; })}</div>
  </div>;
}

const queryDefinitions = {
  "A1c ≥ 8%": "Final Hemoglobin A1c result ≥ 8.0% in the displayed longitudinal record",
  "Systolic BP ≥ 140": "Most recent systolic blood pressure ≥ 140 mmHg",
  "Abnormal potassium": "Final potassium result flagged High",
  "Open portal messages": "At least one portal message with status New",
} as const;
type QueryName = keyof typeof queryDefinitions;

export function QueryStudio({ state, setState, audit }: { state: EHRState; setState: SetEHRState; audit: Audit }) {
  const [queryName, setQueryName] = useState<QueryName>("A1c ≥ 8%");
  const [latestIds, setLatestIds] = useState<string[]>([]);
  const sql = queryName === "A1c ≥ 8%" ? "SELECT DISTINCT patient_id\nFROM results\nWHERE test_name = 'Hemoglobin A1c'\n  AND status = 'Final'\n  AND numeric_value >= 8.0;" : queryName === "Systolic BP ≥ 140" ? "SELECT patient_id\nFROM latest_vitals\nWHERE systolic_bp >= 140;" : queryName === "Abnormal potassium" ? "SELECT DISTINCT patient_id\nFROM results\nWHERE test_name = 'Potassium'\n  AND status = 'Final'\n  AND flag = 'High';" : "SELECT DISTINCT patient_id\nFROM portal_messages\nWHERE status = 'New';";
  const matches = useMemo(() => state.patients.filter((patient) => queryName === "A1c ≥ 8%" ? patient.results.some((result) => result.name === "Hemoglobin A1c" && parseFloat(result.value) >= 8) : queryName === "Systolic BP ≥ 140" ? parseInt(patient.vitals[0].bp) >= 140 : queryName === "Abnormal potassium" ? patient.results.some((result) => result.name === "Potassium" && result.flag === "High") : state.messages.some((message) => message.patientId === patient.id && message.status === "New")), [queryName, state]);
  const displayed = latestIds.length ? state.patients.filter((patient) => latestIds.includes(patient.id)) : [];
  const coverage = ["Medicaid", "Medicare", "Commercial PPO"].map((insurance) => ({ insurance, count: displayed.filter((patient) => patient.insurance === insurance).length }));
  function runQuery() {
    const ids = matches.map((patient) => patient.id);
    setLatestIds(ids);
    setState((old) => ({ ...old, queryRuns: [{ id: makeId("QRY"), name: queryName, definition: queryDefinitions[queryName], executedAt: new Date().toISOString(), rowCount: ids.length, patientIds: ids }, ...old.queryRuns].slice(0, 20) }));
    audit("Run population query", `${queryName}: ${ids.length} patient(s)`);
  }
  return <div className="grid two-one">
    <div className="stack"><Panel title="Population Query Studio" subtitle="Define → preview logic → run → validate → stratify"><div className="query-builder"><label>Cohort definition<select aria-label="Cohort definition" value={queryName} onChange={(event) => { setQueryName(event.target.value as QueryName); setLatestIds([]); }}>{Object.keys(queryDefinitions).map((name) => <option key={name}>{name}</option>)}</select></label><p><b>Operational definition:</b> {queryDefinitions[queryName]}</p><pre className="query-preview" aria-label="Query logic preview">{sql}</pre><button className="primary" onClick={runQuery}>Run cohort query</button></div></Panel>{latestIds.length > 0 && <Panel title="Query result" subtitle={`${displayed.length} of ${state.patients.length} synthetic patients`}><table><thead><tr><th>Patient</th><th>MRN</th><th>Coverage</th><th>Evidence</th></tr></thead><tbody>{displayed.map((patient) => <tr key={patient.id}><td>{patient.name}</td><td>{patient.mrn}</td><td>{patient.insurance}</td><td>{queryName.includes("A1c") ? patient.results.find((result) => result.name === "Hemoglobin A1c")?.value : queryName.includes("BP") ? patient.vitals[0].bp : queryName.includes("potassium") ? patient.results.find((result) => result.name === "Potassium")?.value : state.messages.find((message) => message.patientId === patient.id && message.status === "New")?.subject}</td></tr>)}</tbody></table></Panel>}</div>
    <div className="stack"><Panel title="Coverage distribution" subtitle="A first stratification, not an equity conclusion"><div className="bar-chart">{coverage.map((row) => <div key={row.insurance}><span>{row.insurance}</span><div><i style={{ width: `${displayed.length ? (row.count / displayed.length) * 100 : 0}%` }} /></div><b>{row.count}</b></div>)}</div></Panel><Panel title="Validation checklist"><ul className="checklist"><li>Confirm the denominator and time window.</li><li>Inspect units, status, and missing values.</li><li>Test a sample against the source chart.</li><li>Separate measurement from causal claims.</li><li>Record the exact cohort definition.</li></ul></Panel><Panel title="Saved query runs" subtitle="Reproducible evidence in this workspace"><div className="run-list">{state.queryRuns.length ? state.queryRuns.slice(0, 5).map((run) => <p key={run.id}><strong>{run.name}</strong><span>{run.rowCount} rows · {run.executedAt}</span></p>) : <p className="empty">No queries have been run.</p>}</div></Panel></div>
  </div>;
}

export function ImplementationReadiness({ state, setState, audit }: { state: EHRState; setState: SetEHRState; audit: Audit }) {
  const ready = state.implementation.filter((item) => item.status === "Ready").length;
  function update(item: ImplementationCheckpoint, status: ImplementationCheckpoint["status"]) {
    setState((old) => ({ ...old, implementation: old.implementation.map((row) => row.id === item.id ? { ...row, status } : row) }));
    audit("Update implementation readiness", `${item.domain}: ${status}; evidence: ${item.evidence}`);
  }
  return <div className="stack"><Panel title="Implementation readiness board" subtitle="Evidence-based preparation for a simulated barcode medication administration go-live"><div className="readiness-summary"><div><strong>{ready}/{state.implementation.length}</strong><span>domains ready</span></div><div><strong>{state.implementation.filter((item) => item.risk === "High" && item.status !== "Ready").length}</strong><span>open high-risk domains</span></div><div><strong>{state.implementation.filter((item) => item.status === "Blocked").length}</strong><span>blocked decisions</span></div></div><div className="inline-alert warn"><strong>Readiness is evidence, not optimism.</strong><p>A go-live decision should identify unresolved risk, accountable owners, mitigations, and measurable exit criteria.</p></div></Panel><div className="readiness-grid">{state.implementation.map((item) => <article className="readiness-card" key={item.id}><header><span>{item.domain}</span><Status tone={item.status === "Ready" ? "good" : item.status === "Blocked" ? "danger" : "warn"}>{item.status}</Status></header><h3>{item.requirement}</h3><dl><div><dt>Owner</dt><dd>{item.owner}</dd></div><div><dt>Evidence</dt><dd>{item.evidence}</dd></div><div><dt>Risk</dt><dd>{item.risk}</dd></div></dl><label>Readiness decision<select aria-label={`${item.domain} readiness status`} value={item.status} onChange={(event) => update(item, event.target.value as ImplementationCheckpoint["status"])}><option>Not started</option><option>In progress</option><option>Ready</option><option>Blocked</option></select></label></article>)}</div></div>;
}
