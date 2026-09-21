"use client";

import { useState } from "react";
import { Field, InlineAlert, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import type { IdentityReview } from "@/lib/types";
import type { ViewProps } from "./shared";

export function MPIWorkbench({ state, dispatch, selectPatient }: ViewProps) {
  const [activeId, setActiveId] = useState(state.identityReviews[0]?.id ?? "");
  const [decision, setDecision] = useState<IdentityReview["decision"]>();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const registrations = state.registrations.filter((item) => item.duplicateCandidates.length);
  const active = state.identityReviews.find((review) => review.id === activeId) ?? state.identityReviews[0];
  if (!active) return <Panel title="MPI identity workbench"><p className="empty">No identity reviews are available.</p></Panel>;
  const first = state.patients.find((patient) => patient.id === active.patientIds[0]);
  const second = state.patients.find((patient) => patient.id === active.patientIds[1]);
  if (!first || !second) return <Panel title="MPI identity workbench"><p className="empty">The records in this review are no longer available.</p></Panel>;

  function recordDecision() {
    if (!decision || note.trim().length < 20) { setMessage("Choose a decision and document at least 20 characters of reasoning that cites identifiers."); return; }
    dispatch({ type: "resolveIdentity", reviewId: active!.id, decision, note: note.trim() });
    setMessage("Decision recorded. Any actual merge remains queued for authorized HIM review.");
  }

  return <div className="grid directory">
    <Panel title="Identity queue" subtitle="Potential duplicates require human adjudication" actions={<SimulationBadge />}>
      <div className="patient-list">{state.identityReviews.map((review) => <button key={review.id} className={review.id === active.id ? "selected" : ""} onClick={() => { setActiveId(review.id); setMessage(""); }}><strong>{review.id}</strong><span>{review.patientIds.join(" ↔ ")}</span><Status tone={review.status === "Resolved" ? "good" : "warn"}>{review.status}</Status></button>)}</div>
      {registrations.length > 0 && <InlineAlert tone="warn" title="Flagged at registration"><ul>{registrations.map((item) => <li key={item.id}>{state.patients.find((p) => p.id === item.patientId)?.name ?? item.patientId} ↔ {item.duplicateCandidates.join(", ")}</li>)}</ul></InlineAlert>}
      <InlineAlert tone="info" title="Identity safety rule"><p>Never merge on name alone. Compare multiple identifiers, document uncertainty, and route the final merge to authorized HIM staff.</p></InlineAlert>
    </Panel>
    <Panel title="Side-by-side identity review" subtitle={`${first.mrn} compared with ${second.mrn}`}>
      <div className="compare-head"><button onClick={() => selectPatient(first.id, "Patients")}>{first.name}<small>{first.id} · {first.mrn}</small></button><span>Match signals</span><button onClick={() => selectPatient(second.id, "Patients")}>{second.name}<small>{second.id} · {second.mrn}</small></button></div>
      <table><thead><tr><th>Identifier</th><th>{first.name}</th><th>{second.name}</th><th>Signal</th></tr></thead><tbody>{active.signals.map((signal) => <tr key={signal.label}><td><strong>{signal.label}</strong></td><td>{signal.first}</td><td>{signal.second}</td><td><Status tone={signal.strength === "Match" ? "good" : signal.strength === "Difference" ? "danger" : "warn"}>{signal.strength}</Status></td></tr>)}</tbody></table>
      <div className="decision-box">
        <Field label="Identity decision"><select aria-label="Identity decision" value={decision ?? active.decision ?? ""} onChange={(event) => setDecision(event.target.value as IdentityReview["decision"])}><option value="">Choose a decision</option><option>Same person — queue merge</option><option>Different people — retain both</option><option>Need more information</option></select></Field>
        <Field label="Reasoning and next step"><textarea aria-label="Identity review reasoning" rows={4} value={note || active.note || ""} onChange={(event) => setNote(event.target.value)} placeholder="Cite the identifiers that support your decision and any verification still needed." /></Field>
        <button className="primary" onClick={recordDecision}>Record identity decision</button>
        {message && <p className={`form-message ${message.startsWith("Decision") ? "success" : "error"}`} role="status">{message}</p>}
        {active.status === "Resolved" && !message && <p className="form-message success">Decision recorded {active.decidedAt ? new Date(active.decidedAt).toLocaleString() : ""}: {active.decision}</p>}
      </div>
    </Panel>
  </div>;
}
