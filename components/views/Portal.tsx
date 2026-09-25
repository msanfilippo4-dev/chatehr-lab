"use client";

import { useState } from "react";
import { Field, InlineAlert, PageHeader, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import type { RoutingRule } from "@/lib/config/types";
import { resultValue } from "@/lib/patient";
import type { PortalMessage } from "@/lib/types";
import type { ViewProps } from "./shared";

/** Pool used when no routing rule matches a message. */
export const GENERAL_POOL = "General message pool (unowned)";

const SPANISH_HINT = /\b(hola|gracias|presión|medicina|necesita|pueden|buenas|mis|lecturas)\b/i;

export function suggestedRoute(rules: RoutingRule[], text: string): RoutingRule | null {
  for (const rule of rules) {
    try {
      if (new RegExp(rule.keywordPattern, "i").test(text)) return rule;
    } catch {
      /* an invalid published pattern is skipped */
    }
  }
  return null;
}

export function Portal(props: ViewProps) {
  const { state, patient } = props;
  const patientMessages = state.messages.filter((message) => message.patientId === patient.id);
  return (
    <div className="portal-view">
      <PageHeader
        eyebrow="Patient portal"
        title="Portal messages"
        subtitle="Every message needs an owner, a category, and a response expectation. Routing rules suggest a pool from keywords."
        actions={<SimulationBadge />}
      />
      <div className="grid two-one">
        <Panel title="Portal inbox" subtitle={`${patientMessages.length} message(s) for ${patient.name}`}>
          {patientMessages.map((message) => <MessageCard key={message.id} {...props} message={message} />)}
          {!patientMessages.length && <p className="empty">No portal messages for {patient.name}.</p>}
          {patient.proxyAccess?.length ? (
            <InlineAlert tone="info" title="Proxy access on file">
              <p>{patient.proxyAccess.map((proxy) => `${proxy.name} (${proxy.relationship}) · ${proxy.scope}`).join("; ")}. Proxy scope limits what the proxy can see and send.</p>
            </InlineAlert>
          ) : null}
        </Panel>
        <PatientView {...props} />
      </div>
    </div>
  );
}

function MessageCard({ config, dispatch, message, readOnly }: ViewProps & { message: PortalMessage }) {
  const suggestion = suggestedRoute(config.routingRules, `${message.subject} ${message.body}`);
  const pools = [...new Set([...config.routingRules.map((rule) => rule.routeTo), GENERAL_POOL])];
  const [routeTo, setRouteTo] = useState(suggestion?.routeTo ?? GENERAL_POOL);
  const category = config.messageCategories.find((item) => item.id === suggestion?.categoryId);
  const spanish = SPANISH_HINT.test(`${message.subject} ${message.body}`);
  const statusText = `${message.status}${message.routedTo ? ` → ${message.routedTo}` : ""}`;

  return (
    <article className="message">
      <header>
        <div>
          <strong>{message.subject}</strong>
          <span>{message.from} · {message.date}{message.proxy ? " · proxy sender" : ""}{spanish ? " · written in Spanish" : ""}</span>
        </div>
        <Status tone={message.status === "New" ? "warn" : "good"}>{statusText}</Status>
      </header>
      <p lang={spanish ? "es" : undefined}>{message.body}</p>
      {message.status === "New" && (
        <div className="form-stack">
          {suggestion ? (
            <small>Suggested: <strong>{category?.name}</strong> · {suggestion.priority} · {suggestion.routeTo}</small>
          ) : (
            <small className="danger-text">No routing rule matched this message. It would fall to the {GENERAL_POOL.toLowerCase()} with no owner.</small>
          )}
          <Field label="Route to">
            <select value={routeTo} onChange={(event) => setRouteTo(event.target.value)} disabled={readOnly}>
              {pools.map((pool) => <option key={pool}>{pool}</option>)}
            </select>
          </Field>
          <div className="button-row">
            <button disabled={readOnly} onClick={() => dispatch({ type: "routeMessage", id: message.id, routedTo: routeTo, categoryId: suggestion?.categoryId })}>Route message</button>
            <button disabled={readOnly} onClick={() => dispatch({ type: "resolveMessage", id: message.id })}>Mark resolved</button>
          </div>
        </div>
      )}
      {message.status === "Routed" && (
        <div className="button-row">
          <button disabled={readOnly} onClick={() => dispatch({ type: "resolveMessage", id: message.id })}>Mark resolved</button>
        </div>
      )}
    </article>
  );
}

function PatientView({ patient, dispatch, readOnly }: ViewProps) {
  const [reconcileNote, setReconcileNote] = useState("My medication list is missing a medicine I take, or shows one I stopped.");
  const proxy = patient.proxyAccess?.[0];
  const proxyNotes = proxy ? patient.notes.filter((note) => note.kind !== "Draft") : [];
  const exposed = proxy && /full/i.test(proxy.scope) ? proxyNotes.filter((note) => note.confidential) : [];
  return (
    <Panel title="Patient view" subtitle="Plain-language summary the patient (or proxy) sees">
      <div className="portal-card">
        <h3>Your health summary</h3>
        <p><b>Next step:</b> Review your medication list and contact the clinic if anything is missing or incorrect.</p>
        <h4>Current medicines</h4>
        {patient.medications.length
          ? patient.medications.map((item) => <p key={item.name}>{item.name}<small>{item.sig}</small></p>)
          : <p>No medicines are listed.</p>}
        <h4>Recent results</h4>
        {!patient.results.length && <p>No results yet.</p>}
        {patient.results.slice(0, 5).map((result, index) => (
          <p key={`${result.name}${result.date}${index}`}>
            {result.name}: {resultValue(result)}
            <small>{result.date} · {result.flag ? `${result.flag.toLowerCase()} (reference ${result.range ?? "not shown"})` : result.status === "Pending" ? "waiting for the laboratory" : "within the reference range"}</small>
          </p>
        ))}
        {proxy && (
          <>
            <h4>Visit notes visible to {proxy.name} (proxy)</h4>
            {proxyNotes.map((note) => (
              <p key={note.id}>
                {new Date(note.recordedAt).toLocaleDateString()} · {note.author}
                <small>{note.confidential ? "Confidential adolescent note" : note.assessment}</small>
              </p>
            ))}
          </>
        )}
        <Field label="Report a difference in your record">
          <textarea rows={3} value={reconcileNote} onChange={(event) => setReconcileNote(event.target.value)} disabled={readOnly} />
        </Field>
        <button disabled={readOnly} onClick={() => dispatch({ type: "reconciliationRequest", patientId: patient.id, detail: reconcileNote.trim() || "Medication list review requested" })}>Send reconciliation request</button>
      </div>
      {exposed.length > 0 && (
        <InlineAlert tone="danger" title="Confidential note visible to proxy">
          <p>The proxy scope is &ldquo;{proxy?.scope}&rdquo;, so {exposed.length} confidential adolescent note(s) appear in the proxy view. Report this through the analyst ticket queue.</p>
        </InlineAlert>
      )}
      <InlineAlert tone="info" title="Accessibility">
        <p>Portal text uses plain language, headings, and large touch targets. Results are labeled with what the value means, not only the number.</p>
      </InlineAlert>
    </Panel>
  );
}
