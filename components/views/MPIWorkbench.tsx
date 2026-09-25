"use client";

import { useState } from "react";
import { Field, InlineAlert, PageHeader, Panel, SimulationBadge, Status, Tip } from "@/components/ui/primitives";
import type { IdentityReview, Patient } from "@/lib/types";
import type { ViewProps } from "./shared";

function signalTone(strength: IdentityReview["signals"][number]["strength"]) {
  if (strength === "Match") return "good" as const;
  if (strength === "Difference") return "danger" as const;
  return "warn" as const;
}

export function MPIWorkbench(props: ViewProps) {
  const { state } = props;
  const [activeId, setActiveId] = useState(state.identityReviews[0]?.id ?? "");
  const active = state.identityReviews.find((review) => review.id === activeId) ?? state.identityReviews[0];
  const first = active && state.patients.find((patient) => patient.id === active.patientIds[0]);
  const second = active && state.patients.find((patient) => patient.id === active.patientIds[1]);

  return (
    <div className="mpi-view">
      <PageHeader
        eyebrow="Health information management"
        title="MPI identity workbench"
        subtitle="Potential duplicate records need human adjudication. Compare several identifiers, document uncertainty, and never merge on name alone."
        actions={<SimulationBadge />}
      />
      {!active && <Panel title="MPI identity workbench"><p className="empty">No identity reviews are available.</p></Panel>}
      {active && (!first || !second) && <Panel title="MPI identity workbench"><p className="empty">The records in this review are no longer available.</p></Panel>}
      {active && first && second && (
        <div className="grid directory">
          <IdentityQueue {...props} active={active} onSelect={setActiveId} />
          <ComparePanel key={active.id} {...props} active={active} first={first} second={second} />
        </div>
      )}
    </div>
  );
}

function IdentityQueue({ state, active, onSelect }: ViewProps & { active: IdentityReview; onSelect: (id: string) => void }) {
  const registrations = state.registrations.filter((item) => item.duplicateCandidates.length);
  return (
    <Panel title="Identity queue" subtitle="Pairs sent from registration and the chart">
      <div className="patient-list">
        {state.identityReviews.map((review) => (
          <button key={review.id} className={review.id === active.id ? "selected" : ""} onClick={() => onSelect(review.id)}>
            <strong>{review.id}</strong>
            <span>{review.patientIds.join(" ↔ ")}</span>
            <Status tone={review.status === "Resolved" ? "good" : "warn"}>{review.status}</Status>
          </button>
        ))}
      </div>
      {registrations.length > 0 && (
        <InlineAlert tone="warn" title="Flagged at registration">
          <ul>
            {registrations.map((item) => (
              <li key={item.id}>{state.patients.find((p) => p.id === item.patientId)?.name ?? item.patientId} ↔ {item.duplicateCandidates.join(", ")}</li>
            ))}
          </ul>
        </InlineAlert>
      )}
      <InlineAlert tone="info" title="Identity safety rule">
        <p>Never merge on name alone. Compare multiple identifiers, document uncertainty, and route the final merge to authorized HIM staff.</p>
      </InlineAlert>
    </Panel>
  );
}

function ComparePanel({ dispatch, selectPatient, readOnly, active, first, second }: ViewProps & { active: IdentityReview; first: Patient; second: Patient }) {
  const [decision, setDecision] = useState<IdentityReview["decision"]>();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const counts = { Match: 0, Unverified: 0, Difference: 0 };
  for (const signal of active.signals) counts[signal.strength] += 1;

  function recordDecision() {
    if (!decision || note.trim().length < 20) {
      setMessage("Choose a decision and document at least 20 characters of reasoning that cites identifiers.");
      return;
    }
    dispatch({ type: "resolveIdentity", reviewId: active.id, decision, note: note.trim() });
    setMessage("Decision recorded. Any actual merge remains queued for authorized HIM review.");
  }

  return (
    <Panel title="Side-by-side identity review" subtitle={`${first.mrn} compared with ${second.mrn} · ${counts.Match} match · ${counts.Unverified} unverified · ${counts.Difference} difference`}>
      <div className="compare-head">
        <button onClick={() => selectPatient(first.id, "Patients")}>{first.name}<small>{first.id} · {first.mrn}</small></button>
        <span>Match signals</span>
        <button onClick={() => selectPatient(second.id, "Patients")}>{second.name}<small>{second.id} · {second.mrn}</small></button>
      </div>
      <table>
        <thead><tr><th>Identifier</th><th>{first.name}</th><th>{second.name}</th><th>Signal</th></tr></thead>
        <tbody>
          {active.signals.map((signal) => (
            <tr key={signal.label}>
              <td><strong>{signal.label}</strong></td>
              <td>{signal.first}</td>
              <td>{signal.second}</td>
              <td><Status tone={signalTone(signal.strength)}>{signal.strength}</Status></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="decision-box">
        <Field label="Identity decision">
          <select aria-label="Identity decision" value={decision ?? active.decision ?? ""} onChange={(event) => setDecision(event.target.value as IdentityReview["decision"])} disabled={readOnly}>
            <option value="">Choose a decision</option>
            <option>Same person — queue merge</option>
            <option>Different people — retain both</option>
            <option>Need more information</option>
          </select>
        </Field>
        <Field label="Reasoning and next step">
          <textarea
            aria-label="Identity review reasoning"
            rows={4}
            value={note || active.note || ""}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Cite the identifiers that support your decision and any verification still needed."
            disabled={readOnly}
          />
        </Field>
        <div><button className="primary" onClick={recordDecision} disabled={readOnly}>Record identity decision</button></div>
        {message && <p className={`form-message ${message.startsWith("Decision") ? "success" : "error"}`} role="status">{message}</p>}
        {active.status === "Resolved" && !message && (
          <p className="form-message success">Decision recorded {active.decidedAt ? new Date(active.decidedAt).toLocaleString() : ""}: {active.decision}</p>
        )}
      </div>
      <Tip>Ask whether your decision could be undone safely if you are wrong. A wrong merge mixes two people&apos;s allergies and results; a deferred merge only costs a verification call.</Tip>
    </Panel>
  );
}
