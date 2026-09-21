"use client";

import { useState } from "react";
import { Field, InlineAlert, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import type { ViewProps } from "./shared";

export function Portal({ state, dispatch, config, patient }: ViewProps) {
  const patientMessages = state.messages.filter((m) => m.patientId === patient.id);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [reconcileNote, setReconcileNote] = useState("My medication list is missing a medicine I take, or shows one I stopped.");

  function suggestedRoute(text: string) {
    for (const rule of config.routingRules) {
      try { if (new RegExp(rule.keywordPattern, "i").test(text)) return rule; } catch { /* invalid pattern skipped */ }
    }
    return config.routingRules[0];
  }

  return <div className="grid two-one">
    <Panel title="Portal inbox" subtitle="Messages need an owner, a category, and a response expectation" actions={<SimulationBadge />}>
      {patientMessages.map((m) => {
        const suggestion = suggestedRoute(`${m.subject} ${m.body}`);
        const routeTo = overrides[m.id] ?? suggestion?.routeTo ?? "Clinical team pool";
        const category = config.messageCategories.find((c) => c.id === suggestion?.categoryId);
        return <article className="message" key={m.id}><header><div><strong>{m.subject}</strong><span>{m.from} · {m.date}{m.proxy ? " · proxy sender" : ""}</span></div><Status tone={m.status === "New" ? "warn" : "good"}>{m.status}{m.routedTo ? ` → ${m.routedTo}` : ""}</Status></header><p>{m.body}</p>
          {m.status === "New" && <div className="form-stack"><small>Suggested: <strong>{category?.name}</strong> · {suggestion?.priority} · {suggestion?.routeTo}</small><Field label="Route to"><select value={routeTo} onChange={(e) => setOverrides({ ...overrides, [m.id]: e.target.value })}>{[...new Set(config.routingRules.map((rule) => rule.routeTo))].map((pool) => <option key={pool}>{pool}</option>)}</select></Field><div className="button-row"><button onClick={() => dispatch({ type: "routeMessage", id: m.id, routedTo: routeTo, categoryId: suggestion?.categoryId })}>Route message</button><button onClick={() => dispatch({ type: "resolveMessage", id: m.id })}>Mark resolved</button></div></div>}
          {m.status === "Routed" && <div className="button-row"><button onClick={() => dispatch({ type: "resolveMessage", id: m.id })}>Mark resolved</button></div>}
        </article>;
      })}
      {!patientMessages.length && <p className="empty">No portal messages for {patient.name}.</p>}
      {patient.proxyAccess?.length ? <InlineAlert tone="info" title="Proxy access on file"><p>{patient.proxyAccess.map((proxy) => `${proxy.name} (${proxy.relationship}) · ${proxy.scope}`).join("; ")}. Proxy scope limits what the proxy can see and send.</p></InlineAlert> : null}
    </Panel>
    <Panel title="Patient view" subtitle="Plain-language summary the patient (or proxy) sees">
      <div className="portal-card"><h3>Your health summary</h3><p><b>Next step:</b> Review your medication list and contact the clinic if anything is missing or incorrect.</p><h4>Current medicines</h4>{patient.medications.length ? patient.medications.map((m) => <p key={m.name}>{m.name}<small>{m.sig}</small></p>) : <p>No medicines are listed.</p>}<h4>Recent results</h4>{patient.results.map((r) => <p key={`${r.name}${r.date}`}>{r.name}: {r.value || "Not yet resulted"}<small>{r.date} · {r.flag || (r.status === "Pending" ? "waiting for the laboratory" : "within the displayed reference range")}</small></p>)}
        <Field label="Report a difference in your record"><textarea rows={3} value={reconcileNote} onChange={(e) => setReconcileNote(e.target.value)} /></Field>
        <button onClick={() => dispatch({ type: "reconciliationRequest", patientId: patient.id, detail: reconcileNote.trim() || "Medication list review requested" })}>Send reconciliation request</button>
      </div>
      <InlineAlert tone="info" title="Accessibility"><p>Portal text uses plain language, headings, and large touch targets. Results are labeled with what the value means, not only the number.</p></InlineAlert>
    </Panel>
  </div>;
}
