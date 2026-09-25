"use client";

import { useState } from "react";
import { Field, InlineAlert, KpiRow, PageHeader, Panel, SimulationBadge, Status, Tip } from "@/components/ui/primitives";
import type { ExchangeItem, Patient } from "@/lib/types";
import type { ViewProps } from "./shared";

const AUTO_LINK_THRESHOLD = 0.85;

function statusTone(status: ExchangeItem["status"]) {
  if (status === "Accepted") return "good" as const;
  if (status === "Pending review") return "warn" as const;
  return "neutral" as const;
}

export function HIEReconciliation(props: ViewProps) {
  const { state } = props;
  const [patientFilter, setPatientFilter] = useState("All");
  const visible = state.exchanges.filter((item) => patientFilter === "All" || item.patientId === patientFilter);
  const pending = visible.filter((item) => item.status === "Pending review").length;
  const lowConfidence = visible.filter((item) => item.matchScore < AUTO_LINK_THRESHOLD).length;
  const patientsWithItems = state.patients.filter((patient) => state.exchanges.some((item) => item.patientId === patient.id));

  return (
    <div className="hie-view">
      <PageHeader
        eyebrow="Interoperability"
        title="HIE reconciliation inbox"
        subtitle="FHIR-style resources from outside organizations, with provenance, patient-match confidence, and the discrepancy to review."
        actions={<SimulationBadge />}
      />
      <KpiRow
        items={[
          { label: "Pending review", value: pending, tone: pending ? "warn" : "good" },
          { label: "Decided", value: visible.length - pending },
          { label: `Below ${Math.round(AUTO_LINK_THRESHOLD * 100)}% match`, value: lowConfidence, tone: lowConfidence ? "danger" : "neutral", note: "Not auto-linked" },
        ]}
      />
      <Panel title="Inbox" subtitle={`${pending} pending of ${visible.length}`}>
        <div className="filter-bar">
          <Field label="Patient filter">
            <select aria-label="HIE patient filter" value={patientFilter} onChange={(event) => setPatientFilter(event.target.value)}>
              <option>All</option>
              {patientsWithItems.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.mrn}</option>)}
            </select>
          </Field>
          <span><b>{pending}</b> pending of {visible.length}</span>
        </div>
        <InlineAlert tone="info" title="Decision standard">
          <p>Accept when source, timing, identity confidence, and clinical plausibility line up. Keep local when the local value is more specific or more recent. Defer when identity confidence is low or the source must be verified. Never let a lower-confidence match overwrite the chart.</p>
        </InlineAlert>
      </Panel>
      <div className="exchange-grid">
        {visible.map((item) => {
          const patient = state.patients.find((row) => row.id === item.patientId);
          return patient ? <ExchangeCard key={item.id} {...props} item={item} patient={patient} /> : null;
        })}
      </div>
      <Tip>Provenance is part of the data. Record where a value came from and when, so the next clinician can judge it without repeating your work.</Tip>
    </div>
  );
}

function ExchangeCard({ dispatch, readOnly, item, patient }: ViewProps & { item: ExchangeItem; patient: Patient }) {
  const lowConfidence = item.matchScore < AUTO_LINK_THRESHOLD;
  return (
    <article className="exchange-card">
      <header>
        <div>
          <span className="resource-type">{item.fhirResourceLabel ?? item.resourceType}</span>
          <h3>{patient.name}</h3>
          <small>{patient.mrn} · source ID {item.sourcePatientId}</small>
        </div>
        <Status tone={statusTone(item.status)}>{item.status}</Status>
      </header>
      <dl className="provenance">
        <div><dt>Source</dt><dd>{item.sourceOrganization}{item.provenance ? ` · ${item.provenance.sourceSystem}` : ""}</dd></div>
        <div><dt>Received via</dt><dd>{item.provenance?.receivedVia ?? "HIE"} · {item.receivedAt}</dd></div>
        <div><dt>Source time</dt><dd>{item.sourceTimestamp}</dd></div>
        <div>
          <dt>Identity confidence</dt>
          <dd className={lowConfidence ? "danger-text" : ""}>{Math.round(item.matchScore * 100)}%{lowConfidence ? " · below the 85% auto-link threshold" : ""}</dd>
        </div>
      </dl>
      <div className="value-compare">
        <div><small>Local record</small><p>{item.localValue}</p></div>
        <div><small>Incoming resource</small><p>{item.incomingValue}</p></div>
      </div>
      <p className="discrepancy"><b>Review point:</b> {item.discrepancy}</p>
      {item.reviewerNote && (
        <p className="reviewer-note">{item.reviewerNote}{item.decidedAt ? ` (${new Date(item.decidedAt).toLocaleString()})` : ""}</p>
      )}
      {item.status === "Pending review" && (
        <div className="button-row">
          <button className="primary" disabled={readOnly} onClick={() => dispatch({ type: "reconcileExchange", id: item.id, status: "Accepted" })}>Accept into chart</button>
          <button disabled={readOnly} onClick={() => dispatch({ type: "reconcileExchange", id: item.id, status: "Kept local" })}>Keep local</button>
          <button disabled={readOnly} onClick={() => dispatch({ type: "reconcileExchange", id: item.id, status: "Deferred" })}>Defer</button>
        </div>
      )}
    </article>
  );
}
