"use client";

import { useMemo, useState } from "react";
import { Field, InlineAlert, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import type { AlertRule } from "@/lib/config/types";
import type { Order } from "@/lib/types";
import { nowIso, type ViewProps } from "./shared";

interface FiredAlert { rule: AlertRule; text: string }

export function OrdersResults({ state, dispatch, config, patient, makeId }: ViewProps) {
  const medications = config.medicationExamples;
  const labs = config.labExamples;
  const [type, setType] = useState<Order["type"]>("Medication");
  const [name, setName] = useState(medications[0]?.name ?? "");
  const [details, setDetails] = useState(medications[0]?.sig ?? "");
  const [overrideReason, setOverrideReason] = useState("");
  const [taskOwner, setTaskOwner] = useState("Clinical team");
  const [message, setMessage] = useState("");
  const existing = state.orders.filter((o) => o.patientId === patient.id);

  const alerts = useMemo<FiredAlert[]>(() => {
    const fired: FiredAlert[] = [];
    for (const rule of config.alertRules) {
      let pattern: RegExp;
      try { pattern = new RegExp(rule.orderPattern, "i"); } catch { continue; }
      if (!pattern.test(name)) continue;
      if (rule.kind === "allergy") {
        const allergen = rule.allergenPattern ? new RegExp(rule.allergenPattern, "i") : null;
        if (type === "Medication" && allergen && patient.allergies.some((a) => allergen.test(a.allergen))) fired.push({ rule, text: `${rule.message} Documented: ${patient.allergies.map((a) => `${a.allergen}${a.reaction ? ` (${a.reaction}, ${a.severity})` : ""}`).join("; ")}.` });
      } else if (rule.kind === "duplicate") {
        if (existing.some((o) => o.name.toLowerCase() === name.toLowerCase() && o.status !== "Reviewed")) fired.push({ rule, text: rule.message });
      } else if (rule.kind === "interaction") {
        if (type === "Medication" && patient.results.some((r) => r.name === "Potassium" && r.flag === "High")) fired.push({ rule, text: rule.message });
      }
    }
    return fired;
  }, [config.alertRules, name, type, patient, existing]);

  const needsOverride = alerts.some((alert) => alert.rule.requiresOverrideReason);

  function place() {
    if (needsOverride && overrideReason.trim().length < 15) { setMessage("Choose an alternative or record a specific clinical reason (15+ characters) for overriding the warning."); return; }
    const lab = labs.find((item) => item.name === name);
    const order: Order = { id: makeId("ORD"), patientId: patient.id, type, name, details, status: type === "Laboratory" ? "Final" : "Submitted", orderedAt: nowIso(), warnings: alerts.map((alert) => `${alert.rule.severity}: ${alert.rule.kind}`), ...(type === "Laboratory" ? { result: lab?.sampleResult ?? "Result pending" } : {}) };
    dispatch({ type: "placeOrder", order, overrideReason: needsOverride ? overrideReason.trim() : undefined });
    setMessage(type === "Laboratory" ? "Laboratory order placed. A simulated final result is now waiting for acknowledgment." : needsOverride ? "Order placed with a documented override. The alert and your reason are in the audit trail." : "Order placed.");
    setOverrideReason("");
  }

  function choose(orderType: Order["type"], value: string) {
    setType(orderType);
    if (orderType === "Medication") { const med = medications.find((m) => m.name === value) ?? medications[0]; setName(med?.name ?? value); setDetails(med?.sig ?? ""); }
    else { const lab = labs.find((l) => l.name === value) ?? labs[0]; setName(lab?.name ?? value); setDetails(lab ? `${lab.specimen} · routine outpatient collection` : ""); }
  }

  return <div className="grid two-one">
    <Panel title="Orders and results" subtitle={`${patient.name} · acknowledgment and follow-up are separate steps`}>
      <table><thead><tr><th>Type</th><th>Order</th><th>Status</th><th>Result</th><th>Action</th></tr></thead><tbody>{existing.map((o) => <tr key={o.id}><td>{o.type}</td><td>{o.name}<small>{o.details}</small>{o.overrideReason && <small className="danger-text">Override: {o.overrideReason}</small>}</td><td><Status tone={o.status === "Reviewed" ? "good" : o.status === "Final" ? "warn" : "neutral"}>{o.status}</Status>{o.acknowledgedAt && <small>Acknowledged {new Date(o.acknowledgedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>}</td><td>{o.result ?? "—"}</td><td className="button-row">{o.status === "Final" && !o.acknowledgedAt && <button onClick={() => dispatch({ type: "acknowledgeResult", orderId: o.id })}>Acknowledge</button>}{o.status === "Final" && <button onClick={() => dispatch({ type: "reviewResult", orderId: o.id, task: { id: makeId("TASK"), patientId: patient.id, title: `Follow up ${o.name}: ${o.result ?? "order"}`, due: "2026-09-23", complete: false, owner: taskOwner } })}>Create follow-up</button>}</td></tr>)}</tbody></table>
      {!existing.length && <p className="empty">No orders in this practice workspace for {patient.name}.</p>}
      <Field label="Follow-up task owner" hint="Acknowledging a result is not the same as assigning someone to act on it."><select value={taskOwner} onChange={(e) => setTaskOwner(e.target.value)}><option>Clinical team</option><option>Ordering provider</option><option>Nurse triage</option><option>Front desk</option></select></Field>
    </Panel>
    <Panel title="Enter simulated order" subtitle={`Alert rules: ${config.alertRules.map((rule) => rule.kind).join(", ")}`} actions={<SimulationBadge />}>
      <div className="form-stack">
        <Field label="Order type"><select value={type} onChange={(e) => choose(e.target.value as Order["type"], "")}><option>Medication</option><option>Laboratory</option></select></Field>
        <Field label={type === "Medication" ? "Medication" : "Test"}><select value={name} onChange={(e) => choose(type, e.target.value)}>{(type === "Medication" ? medications.map((m) => m.name) : labs.map((l) => l.name)).map((option) => <option key={option}>{option}</option>)}{![...medications.map((m) => m.name), ...labs.map((l) => l.name)].includes(name) && <option>{name}</option>}</select></Field>
        <Field label="Details"><textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
        {alerts.map((alert) => <InlineAlert key={alert.rule.id} tone={alert.rule.severity === "Critical" ? "danger" : "warn"} title={`${alert.rule.severity}: ${alert.rule.kind === "allergy" ? "Drug-allergy warning" : alert.rule.kind === "duplicate" ? "Possible duplicate order" : "Interaction warning"}`}><p>{alert.text}</p></InlineAlert>)}
        {needsOverride && <div className="override-box"><Field label="Override reason (required to continue)" hint="A specific clinical justification, or choose an alternative instead."><textarea rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Example: prior tolerated course documented 2024; allergy label under review." /></Field></div>}
        <button className="primary" onClick={place}>Submit simulated order</button>
        {message && <p className={`form-message ${message.startsWith("Choose") ? "error" : "success"}`} role="status">{message}</p>}
      </div>
    </Panel>
  </div>;
}
