"use client";

import { Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import { SIMULATION_DATE } from "@/lib/seed";
import type { ViewProps } from "./shared";

export function Worklist({ state, patient, selectPatient, dispatch }: ViewProps) {
  const todays = state.appointments.filter((a) => a.date === SIMULATION_DATE && a.status !== "Canceled");
  const pendingResults = state.patients.flatMap((p) => p.results.filter((r) => r.flag).map((r) => ({ patient: p, result: r }))).slice(0, 5);
  const finalOrders = state.orders.filter((order) => order.status === "Final");
  const newMessages = state.messages.filter((message) => message.status === "New");
  return <div className="grid two-one">
    <div className="stack">
      <Panel title="Today's schedule" subtitle={`Monday, September 21, 2026 · Crescent Lincoln Center Clinic (simulated date)`}>
        <table><thead><tr><th>Time</th><th>Patient</th><th>Visit</th><th>Provider</th><th>Status</th></tr></thead><tbody>{todays.map((a) => { const p = state.patients.find((x) => x.id === a.patientId); if (!p) return null; return <tr key={a.id}><td>{a.time}</td><td><button className="text-button" onClick={() => selectPatient(p.id, "Patients")}>{p.name}</button><small>{p.mrn}</small></td><td>{a.visitType}</td><td>{a.provider}</td><td><Status tone={a.status === "Checked in" ? "good" : a.status === "No-show" ? "danger" : "neutral"}>{a.status}</Status></td></tr>; })}</tbody></table>
      </Panel>
      <Panel title="Results requiring action" subtitle="Acknowledgment and patient follow-up are tracked separately">
        <table><thead><tr><th>Patient</th><th>Result</th><th>Value</th><th>State</th></tr></thead><tbody>
          {finalOrders.map((order) => { const p = state.patients.find((x) => x.id === order.patientId); return <tr key={order.id}><td>{p?.name}</td><td>{order.name}</td><td className="danger-text">{order.result}</td><td><Status tone={order.acknowledgedAt ? "warn" : "danger"}>{order.acknowledgedAt ? "Acknowledged · follow-up open" : "Final · not acknowledged"}</Status></td></tr>; })}
          {pendingResults.map(({ patient: p, result: r }) => <tr key={`${p.id}-${r.name}`}><td>{p.name}</td><td>{r.name}</td><td className="danger-text">{r.value || "Pending"}</td><td><Status tone="warn">{r.status === "Pending" ? "Ordered · no result" : "Final · in chart"}</Status></td></tr>)}
        </tbody></table>
      </Panel>
    </div>
    <div className="stack">
      <Panel title="My tasks" subtitle="Close the loop after reviewing the result">
        <ul className="task-list">{state.tasks.map((t) => <li key={t.id}><label><input type="checkbox" checked={t.complete} onChange={() => dispatch({ type: "toggleTask", id: t.id })} /><span className={t.complete ? "done" : ""}>{t.title}<small>Due {t.due}{t.owner ? ` · ${t.owner}` : ""}</small></span></label></li>)}</ul>
      </Panel>
      <Panel title="Inbox" subtitle={`${newMessages.length} new portal message(s)`}>
        <ul className="task-list">{newMessages.map((m) => { const p = state.patients.find((x) => x.id === m.patientId); return <li key={m.id}><button className="text-button" onClick={() => selectPatient(m.patientId, "Portal")}>{m.subject}</button><small>{p?.name}{m.proxy ? " · proxy" : ""}</small></li>; })}{!newMessages.length && <li className="empty">No new messages.</li>}</ul>
      </Panel>
      <Panel title="Patient context" subtitle={patient.name}>
        <dl className="facts"><div><dt>Active problems</dt><dd>{patient.problems.map((p) => p.display).join("; ")}</dd></div><div><dt>Active medications</dt><dd>{patient.medications.map((m) => m.name).join("; ")}</dd></div><div><dt>Latest BP</dt><dd>{patient.vitals[0]?.bp ?? "Not recorded"}</dd></div></dl>
        <p className="help">All patients are fictional. <SimulationBadge /></p>
      </Panel>
    </div>
  </div>;
}
