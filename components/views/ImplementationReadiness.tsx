"use client";

import { useState } from "react";
import { Field, InlineAlert, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import type { ImplementationCheckpoint } from "@/lib/types";
import type { ViewProps } from "./shared";

export function ImplementationReadiness({ state, dispatch }: ViewProps) {
  const ready = state.implementation.filter((item) => item.status === "Ready").length;
  const [recommendation, setRecommendation] = useState("Conditional go");
  const [fields, setFields] = useState({ owner: "", condition: "", outcome: "", balancing: "", monitoring: "", rollback: "" });
  const [message, setMessage] = useState("");
  const recommendations = state.audit.filter((event) => event.action === "Record go-live recommendation");
  const openHighRisk = state.implementation.filter((item) => item.risk === "High" && item.status !== "Ready").length;

  function record() {
    const missing = Object.entries(fields).filter(([, value]) => value.trim().length < 8).map(([key]) => key);
    if (missing.length) { setMessage(`Complete every safeguard field: ${missing.join(", ")}.`); return; }
    if (recommendation === "Go" && openHighRisk > 0) { setMessage(`${openHighRisk} high-risk domain(s) are not ready. A "Go" needs those resolved or an explicit condition; choose Conditional go or No go.`); return; }
    const note = `Owner: ${fields.owner}. Release condition: ${fields.condition}. Outcome measure: ${fields.outcome}. Balancing measure: ${fields.balancing}. Monitoring: ${fields.monitoring}. Rollback trigger: ${fields.rollback}.`;
    dispatch({ type: "recordGoLive", recommendation, note });
    setMessage("Go-live recommendation recorded in the audit trail.");
  }

  return <div className="stack">
    <Panel title="Implementation readiness board" subtitle="Evidence-based preparation for a simulated barcode medication administration go-live" actions={<SimulationBadge />}>
      <div className="readiness-summary"><div><strong>{ready}/{state.implementation.length}</strong><span>domains ready</span></div><div><strong>{openHighRisk}</strong><span>open high-risk domains</span></div><div><strong>{state.implementation.filter((item) => item.status === "Blocked").length}</strong><span>blocked decisions</span></div></div>
      <InlineAlert tone="warn" title="Readiness is evidence, not optimism."><p>A go-live decision should identify unresolved risk, accountable owners, mitigations, and measurable exit criteria.</p></InlineAlert>
    </Panel>
    <div className="readiness-grid">{state.implementation.map((item) => <article className="readiness-card" key={item.id}><header><span>{item.domain}</span><Status tone={item.status === "Ready" ? "good" : item.status === "Blocked" ? "danger" : "warn"}>{item.status}</Status></header><h3>{item.requirement}</h3><dl><div><dt>Owner</dt><dd>{item.owner}</dd></div><div><dt>Evidence</dt><dd>{item.evidence}</dd></div><div><dt>Risk</dt><dd>{item.risk}</dd></div>{item.updatedAt && <div><dt>Updated</dt><dd>{new Date(item.updatedAt).toLocaleString()}</dd></div>}</dl><Field label="Readiness decision"><select aria-label={`${item.domain} readiness status`} value={item.status} onChange={(event) => dispatch({ type: "updateReadiness", checkpointId: item.id, status: event.target.value as ImplementationCheckpoint["status"] })}><option>Not started</option><option>In progress</option><option>Ready</option><option>Blocked</option></select></Field></article>)}</div>
    <Panel title="Release recommendation" subtitle="Record accountable conditions before go-live">
      <div className="decision-box">
        <Field label="Decision"><select value={recommendation} onChange={(event) => setRecommendation(event.target.value)}><option>No go</option><option>Conditional go</option><option>Go</option></select></Field>
        <div className="registration-grid">
          <Field label="Accountable owner"><input value={fields.owner} onChange={(e) => setFields({ ...fields, owner: e.target.value })} placeholder="Role or committee that owns the decision" /></Field>
          <Field label="Release condition"><input value={fields.condition} onChange={(e) => setFields({ ...fields, condition: e.target.value })} placeholder="What must be true before go-live" /></Field>
          <Field label="Outcome measure"><input value={fields.outcome} onChange={(e) => setFields({ ...fields, outcome: e.target.value })} placeholder="What improvement you expect and how it is measured" /></Field>
          <Field label="Balancing measure"><input value={fields.balancing} onChange={(e) => setFields({ ...fields, balancing: e.target.value })} placeholder="What harm could increase and how you will see it" /></Field>
          <Field label="Monitoring plan"><input value={fields.monitoring} onChange={(e) => setFields({ ...fields, monitoring: e.target.value })} placeholder="Who reviews which dashboard, how often" /></Field>
          <Field label="Rollback trigger"><input value={fields.rollback} onChange={(e) => setFields({ ...fields, rollback: e.target.value })} placeholder="The specific signal that stops the rollout" /></Field>
        </div>
        <button className="primary" onClick={record}>Record recommendation</button>
        {message && <p className={`form-message ${message.startsWith("Go-live") ? "success" : "error"}`} role="status">{message}</p>}
        {recommendations.length > 0 && <div className="run-list">{recommendations.slice(0, 3).map((event) => <p key={event.id}><strong>{event.detail.split(".")[0]}</strong><span>{new Date(event.timestamp).toLocaleString()}</span></p>)}</div>}
      </div>
    </Panel>
  </div>;
}
