"use client";

import { useState } from "react";
import { Field, InlineAlert, KpiRow, PageHeader, Panel, SimulationBadge, Status, Tip } from "@/components/ui/primitives";
import type { ImplementationCheckpoint } from "@/lib/types";
import type { ViewProps } from "./shared";

const SAFEGUARDS = [
  { key: "owner", label: "Accountable owner", placeholder: "Role or committee that owns the decision" },
  { key: "condition", label: "Release condition", placeholder: "What must be true before go-live" },
  { key: "outcome", label: "Outcome measure", placeholder: "What improvement you expect and how it is measured" },
  { key: "balancing", label: "Balancing measure", placeholder: "What harm could increase and how you will see it" },
  { key: "monitoring", label: "Monitoring plan", placeholder: "Who reviews which dashboard, how often" },
  { key: "rollback", label: "Rollback trigger", placeholder: "The specific signal that stops the rollout" },
] as const;

type SafeguardKey = (typeof SAFEGUARDS)[number]["key"];

function statusTone(status: ImplementationCheckpoint["status"]) {
  if (status === "Ready") return "good" as const;
  if (status === "Blocked") return "danger" as const;
  return "warn" as const;
}

export function ImplementationReadiness(props: ViewProps) {
  const { state } = props;
  const ready = state.implementation.filter((item) => item.status === "Ready").length;
  const blocked = state.implementation.filter((item) => item.status === "Blocked").length;
  const openHighRisk = state.implementation.filter((item) => item.risk === "High" && item.status !== "Ready").length;

  return (
    <div className="implementation-view">
      <PageHeader
        eyebrow="Go-live readiness"
        title="Implementation readiness board"
        subtitle="Evidence-based preparation for the barcode medication administration (BCMA) go-live on 4 West."
        actions={<SimulationBadge />}
      />
      <KpiRow
        items={[
          { label: "Domains ready", value: `${ready}/${state.implementation.length}`, tone: "good" },
          { label: "Open high-risk domains", value: openHighRisk, tone: openHighRisk ? "danger" : "good" },
          { label: "Blocked decisions", value: blocked, tone: blocked ? "warn" : "neutral" },
        ]}
      />
      <InlineAlert tone="warn" title="Readiness is evidence, not optimism.">
        <p>A go-live decision should identify unresolved risk, accountable owners, mitigations, and measurable exit criteria.</p>
      </InlineAlert>
      <div className="readiness-grid">
        {state.implementation.map((item) => <ReadinessCard key={item.id} {...props} item={item} />)}
      </div>
      <RecommendationPanel {...props} openHighRisk={openHighRisk} />
    </div>
  );
}

function ReadinessCard({ dispatch, readOnly, item }: ViewProps & { item: ImplementationCheckpoint }) {
  return (
    <article className="readiness-card">
      <header>
        <span>{item.domain}</span>
        <Status tone={statusTone(item.status)}>{item.status}</Status>
      </header>
      <h3>{item.requirement}</h3>
      <dl>
        <div><dt>Owner</dt><dd>{item.owner}</dd></div>
        <div><dt>Evidence</dt><dd>{item.evidence}</dd></div>
        <div><dt>Risk</dt><dd className={item.risk === "High" ? "danger-text" : ""}>{item.risk}</dd></div>
        {item.updatedAt && <div><dt>Updated</dt><dd>{new Date(item.updatedAt).toLocaleString()}</dd></div>}
      </dl>
      <Field label="Readiness decision">
        <select
          aria-label={`${item.domain} readiness status`}
          value={item.status}
          disabled={readOnly}
          onChange={(event) => dispatch({ type: "updateReadiness", checkpointId: item.id, status: event.target.value as ImplementationCheckpoint["status"] })}
        >
          <option>Not started</option>
          <option>In progress</option>
          <option>Ready</option>
          <option>Blocked</option>
        </select>
      </Field>
    </article>
  );
}

function RecommendationPanel({ state, dispatch, readOnly, openHighRisk }: ViewProps & { openHighRisk: number }) {
  const [recommendation, setRecommendation] = useState("Conditional go");
  const [fields, setFields] = useState<Record<SafeguardKey, string>>({ owner: "", condition: "", outcome: "", balancing: "", monitoring: "", rollback: "" });
  const [message, setMessage] = useState("");
  const recommendations = state.audit.filter((event) => event.action === "Record go-live recommendation");

  function record() {
    const missing = Object.entries(fields).filter(([, value]) => value.trim().length < 8).map(([key]) => key);
    if (missing.length) {
      setMessage(`Complete every safeguard field: ${missing.join(", ")}.`);
      return;
    }
    if (recommendation === "Go" && openHighRisk > 0) {
      setMessage(`${openHighRisk} high-risk domain(s) are not ready. A "Go" needs those resolved or an explicit condition; choose Conditional go or No go.`);
      return;
    }
    const note = `Owner: ${fields.owner}. Release condition: ${fields.condition}. Outcome measure: ${fields.outcome}. Balancing measure: ${fields.balancing}. Monitoring: ${fields.monitoring}. Rollback trigger: ${fields.rollback}.`;
    dispatch({ type: "recordGoLive", recommendation, note });
    setMessage("Go-live recommendation recorded in the audit trail.");
  }

  return (
    <Panel title="Release recommendation" subtitle="Record accountable conditions before go-live">
      <div className="decision-box">
        <Field label="Decision">
          <select value={recommendation} onChange={(event) => setRecommendation(event.target.value)} disabled={readOnly}>
            <option>No go</option>
            <option>Conditional go</option>
            <option>Go</option>
          </select>
        </Field>
        <div className="registration-grid">
          {SAFEGUARDS.map((item) => (
            <Field key={item.key} label={item.label}>
              <input
                value={fields[item.key]}
                onChange={(event) => setFields({ ...fields, [item.key]: event.target.value })}
                placeholder={item.placeholder}
                disabled={readOnly}
              />
            </Field>
          ))}
        </div>
        <div><button className="primary" onClick={record} disabled={readOnly}>Record recommendation</button></div>
        {message && <p className={`form-message ${message.startsWith("Go-live") ? "success" : "error"}`} role="status">{message}</p>}
        {recommendations.length > 0 && (
          <div className="run-list">
            {recommendations.slice(0, 3).map((event) => (
              <p key={event.id}><strong>{event.detail.split(".")[0]}</strong><span>{new Date(event.timestamp).toLocaleString()}</span></p>
            ))}
          </div>
        )}
      </div>
      <Tip>Pair every outcome measure with a balancing measure, and make the rollback trigger a number someone can check on day three.</Tip>
    </Panel>
  );
}
