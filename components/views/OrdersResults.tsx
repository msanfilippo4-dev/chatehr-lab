"use client";

import { useMemo, useState } from "react";
import { Field, InlineAlert, PageHeader, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import type { AlertRule, CourseConfig } from "@/lib/config/types";
import { SIMULATION_DATE } from "@/lib/seed";
import type { Order, Patient } from "@/lib/types";
import { nowIso, type ViewProps } from "./shared";

interface FiredAlert { rule: AlertRule; text: string }

const OWNERS = ["Clinical team", "Ordering provider", "Nurse triage", "Front desk"];

/** Evaluate the configured alert rules for a draft order. */
function evaluateAlerts(config: CourseConfig, name: string, type: Order["type"], patient: Patient, existing: Order[]): FiredAlert[] {
  const fired: FiredAlert[] = [];
  for (const rule of config.alertRules) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(rule.orderPattern, "i");
    } catch {
      continue;
    }
    if (!pattern.test(name)) continue;
    if (rule.kind === "allergy") {
      const allergen = rule.allergenPattern ? new RegExp(rule.allergenPattern, "i") : null;
      if (type === "Medication" && allergen && patient.allergies.some((item) => allergen.test(item.allergen))) {
        const documented = patient.allergies.map((item) => `${item.allergen}${item.reaction ? ` (${item.reaction}, ${item.severity})` : ""}`).join("; ");
        fired.push({ rule, text: `${rule.message} Documented: ${documented}.` });
      }
    } else if (rule.kind === "duplicate") {
      if (existing.some((order) => order.name.toLowerCase() === name.toLowerCase() && order.status !== "Reviewed")) fired.push({ rule, text: rule.message });
    } else if (rule.kind === "interaction") {
      // Teaching flaw (see ticket TKT-1048): any potassium ever flagged High triggers this rule.
      if (type === "Medication" && patient.results.some((result) => result.name === "Potassium" && result.flag === "High")) fired.push({ rule, text: rule.message });
    }
  }
  return fired;
}

function alertTitle(rule: AlertRule) {
  const kind = rule.kind === "allergy" ? "Drug-allergy warning" : rule.kind === "duplicate" ? "Possible duplicate order" : "Interaction warning";
  return `${rule.severity}: ${kind}`;
}

export function OrdersResults(props: ViewProps) {
  const { state, patient } = props;
  const existing = state.orders.filter((order) => order.patientId === patient.id);
  return (
    <div className="orders-view">
      <PageHeader eyebrow="CPOE" title="Orders & Results" subtitle="Enter simulated orders against the configured decision-support rules. Acknowledging a result and owning its follow-up are separate steps." actions={<SimulationBadge />} />
      <div className="grid two-one">
        <OrderList {...props} existing={existing} />
        <OrderEntry {...props} existing={existing} />
      </div>
    </div>
  );
}

function OrderList({ patient, dispatch, makeId, readOnly, existing }: ViewProps & { existing: Order[] }) {
  const [taskOwner, setTaskOwner] = useState(OWNERS[0]);
  return (
    <Panel title="Orders and results" subtitle={`${patient.name} · acknowledgment and follow-up are separate steps`}>
      <table>
        <thead><tr><th>Type</th><th>Order</th><th>Status</th><th>Result</th><th>Action</th></tr></thead>
        <tbody>
          {existing.map((order) => (
            <tr key={order.id}>
              <td>{order.type}</td>
              <td>
                {order.name}
                <small>{order.details}</small>
                {order.overrideReason && <small className="danger-text">Override: {order.overrideReason}</small>}
              </td>
              <td>
                <Status tone={order.status === "Reviewed" ? "good" : order.status === "Final" ? "warn" : "neutral"}>{order.status}</Status>
                {order.acknowledgedAt && <small>Acknowledged {new Date(order.acknowledgedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small>}
              </td>
              <td>{order.result ?? "—"}</td>
              <td className="button-row">
                {order.status === "Final" && !order.acknowledgedAt && (
                  <button disabled={readOnly} onClick={() => dispatch({ type: "acknowledgeResult", orderId: order.id })}>Acknowledge</button>
                )}
                {order.status === "Final" && (
                  <button
                    disabled={readOnly}
                    onClick={() => dispatch({
                      type: "reviewResult",
                      orderId: order.id,
                      task: { id: makeId("TASK"), patientId: patient.id, title: `Follow up ${order.name}: ${order.result ?? "order"}`, due: SIMULATION_DATE, complete: false, owner: taskOwner },
                    })}
                  >
                    Create follow-up
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!existing.length && <p className="empty">No orders in this practice workspace for {patient.name}.</p>}
      <div className="form-stack panel-pad">
        <Field label="Follow-up task owner" hint="Acknowledging a result is not the same as assigning someone to act on it.">
          <select value={taskOwner} onChange={(event) => setTaskOwner(event.target.value)}>
            {OWNERS.map((owner) => <option key={owner}>{owner}</option>)}
          </select>
        </Field>
      </div>
    </Panel>
  );
}

function OrderEntry({ config, patient, dispatch, makeId, readOnly, existing }: ViewProps & { existing: Order[] }) {
  const medications = config.medicationExamples;
  const labs = config.labExamples;
  const [type, setType] = useState<Order["type"]>("Medication");
  const [name, setName] = useState(medications[0]?.name ?? "");
  const [details, setDetails] = useState(medications[0]?.sig ?? "");
  const [overrideReason, setOverrideReason] = useState("");
  const [message, setMessage] = useState("");
  const alerts = useMemo(() => evaluateAlerts(config, name, type, patient, existing), [config, name, type, patient, existing]);
  const needsOverride = alerts.some((alert) => alert.rule.requiresOverrideReason);
  const options = type === "Medication" ? medications.map((item) => item.name) : labs.map((item) => item.name);

  function choose(orderType: Order["type"], value: string) {
    setType(orderType);
    setMessage("");
    if (orderType === "Medication") {
      const med = medications.find((item) => item.name === value) ?? medications[0];
      setName(med?.name ?? value);
      setDetails(med?.sig ?? "");
    } else {
      const lab = labs.find((item) => item.name === value) ?? labs[0];
      setName(lab?.name ?? value);
      setDetails(lab ? `${lab.specimen} · routine outpatient collection` : "");
    }
  }

  function place() {
    if (needsOverride && overrideReason.trim().length < 15) {
      setMessage("Choose an alternative or record a specific clinical reason (15+ characters) for overriding the warning.");
      return;
    }
    const lab = labs.find((item) => item.name === name);
    const order: Order = {
      id: makeId("ORD"),
      patientId: patient.id,
      type,
      name,
      details,
      status: type === "Laboratory" ? "Final" : "Submitted",
      orderedAt: nowIso(),
      warnings: alerts.map((alert) => `${alert.rule.severity}: ${alert.rule.kind}`),
      ...(type === "Laboratory" ? { result: lab?.sampleResult ?? "Result pending" } : {}),
    };
    dispatch({ type: "placeOrder", order, overrideReason: needsOverride ? overrideReason.trim() : undefined });
    if (type === "Laboratory") setMessage("Laboratory order placed. A simulated final result is now waiting for acknowledgment.");
    else if (needsOverride) setMessage("Order placed with a documented override. The alert and your reason are in the audit trail.");
    else setMessage("Order placed.");
    setOverrideReason("");
  }

  return (
    <Panel title="Enter simulated order" subtitle={`Alert rules: ${config.alertRules.map((rule) => rule.kind).join(", ")}`}>
      <div className="form-stack panel-pad">
        <Field label="Order type">
          <select value={type} onChange={(event) => choose(event.target.value as Order["type"], "")} disabled={readOnly}>
            <option>Medication</option>
            <option>Laboratory</option>
          </select>
        </Field>
        <Field label={type === "Medication" ? "Medication" : "Test"}>
          <select value={name} onChange={(event) => choose(type, event.target.value)} disabled={readOnly}>
            {options.map((option) => <option key={option}>{option}</option>)}
            {!options.includes(name) && <option>{name}</option>}
          </select>
        </Field>
        <Field label="Details">
          <textarea rows={3} value={details} onChange={(event) => setDetails(event.target.value)} disabled={readOnly} />
        </Field>
        {alerts.map((alert) => (
          <InlineAlert key={alert.rule.id} tone={alert.rule.severity === "Critical" ? "danger" : "warn"} title={alertTitle(alert.rule)}>
            <p>{alert.text}</p>
          </InlineAlert>
        ))}
        {needsOverride && (
          <div className="override-box">
            <Field label="Override reason (required to continue)" hint="A specific clinical justification, or choose an alternative instead.">
              <textarea rows={2} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Example: prior tolerated course documented 2024; allergy label under review." />
            </Field>
          </div>
        )}
        <div><button className="primary" onClick={place} disabled={readOnly}>Submit simulated order</button></div>
        {message && <p className={`form-message ${message.startsWith("Choose") ? "error" : "success"}`} role="status">{message}</p>}
      </div>
    </Panel>
  );
}
