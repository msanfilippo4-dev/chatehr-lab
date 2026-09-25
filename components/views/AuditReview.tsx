"use client";

import { useMemo, useState } from "react";
import { Field, InlineAlert, PageHeader, Panel, SimpleTable, SimulationBadge, Status, Tip } from "@/components/ui/primitives";
import type { EHRState, Patient } from "@/lib/types";
import { download, nowIso, type ViewProps } from "./shared";

interface RecordEvent { key: string; when: string; who: string; what: string; detail: string; tone: "neutral" | "warn" | "danger" | "good" }

/** Clinical record events for one patient that live outside the learner audit trail: MAR activity and note signatures. */
function recordHistory(state: EHRState, patient: Patient): RecordEvent[] {
  const drug = (orderId: string) => state.marOrders.find((order) => order.id === orderId)?.drug ?? orderId;
  const mar: RecordEvent[] = state.marAdministrations
    .filter((item) => item.patientId === patient.id)
    .map((item) => ({
      key: item.id,
      when: `${item.date ?? "2026-09-21"} ${item.simTime}`,
      who: item.performer,
      what: item.outcome === "Given with override" ? "MAR override" : item.outcome === "Held" ? "MAR hold" : "MAR administration",
      detail: `${drug(item.orderId)} @ ${item.slot}${item.reason ? ` · ${item.reason}` : ""}${item.warnings?.length ? ` · warning: ${item.warnings.join("; ")}` : ""}`,
      tone: item.outcome === "Given with override" ? "danger" : item.outcome === "Held" ? "warn" : "good",
    }));
  const notes: RecordEvent[] = patient.notes
    .filter((note) => note.kind !== "Draft")
    .map((note) => ({
      key: note.id,
      when: note.recordedAt.slice(0, 16).replace("T", " "),
      who: note.author,
      what: note.kind === "Amendment" ? "Note amended" : "Note signed",
      detail: `${note.id}${note.source ? ` · source: ${note.source}` : ""}${note.cosignedBy ? ` · co-signed by ${note.cosignedBy}` : ""}${note.confidential ? " · confidential" : ""}`,
      tone: note.source === "AI scribe draft accepted" ? "warn" : "neutral",
    }));
  return [...mar, ...notes].sort((a, b) => b.when.localeCompare(a.when));
}

export function AuditReview(props: ViewProps) {
  const { state, patient } = props;
  return (
    <div className="audit-view">
      <PageHeader
        eyebrow="Health information management"
        title="Audit review"
        subtitle="Who did what, to whose record, and when. Use it as evidence when you investigate a ticket."
        actions={<SimulationBadge />}
      />
      <div className="grid two-one">
        <div className="stack">
          <RecordHistoryPanel state={state} patient={patient} />
          <ActivityPanel {...props} />
          <SummaryPanel state={state} />
        </div>
        <div className="stack">
          <ReleasePanel {...props} />
          <DowntimePanel {...props} />
        </div>
      </div>
    </div>
  );
}

function RecordHistoryPanel({ state, patient }: { state: EHRState; patient: Patient }) {
  const rows = recordHistory(state, patient);
  const overrides = rows.filter((row) => row.what === "MAR override").length;
  return (
    <Panel title={`Record history · ${patient.name}`} subtitle="Medication administration and note-signature events for the selected patient">
      {overrides > 0 && (
        <InlineAlert tone="warn" title={`${overrides} MAR override(s) on file`}>
          <p>Repeated overrides of the same warning usually point to a process or build problem, not to one person.</p>
        </InlineAlert>
      )}
      <table>
        <thead><tr><th>When</th><th>Who</th><th>Event</th><th>Detail</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.when}</td>
              <td>{row.who}</td>
              <td><Status tone={row.tone}>{row.what}</Status></td>
              <td>{row.detail}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="empty">No MAR or note-signature events for {patient.name}.</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}

function ActivityPanel({ state, dispatch, patient, readOnly }: ViewProps) {
  const [actorFilter, setActorFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [patientOnly, setPatientOnly] = useState(false);
  const actors = useMemo(() => ["All", ...new Set(state.audit.map((event) => event.actor))], [state.audit]);
  const actions = useMemo(() => ["All", ...new Set(state.audit.map((event) => event.action))].sort((a, b) => (a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b))), [state.audit]);
  const rows = state.audit
    .filter((event) => actorFilter === "All" || event.actor === actorFilter)
    .filter((event) => actionFilter === "All" || event.action === actionFilter)
    .filter((event) => !patientOnly || event.patientId === patient.id)
    .slice(0, 60);

  return (
    <Panel title="Access and activity review" subtitle={`${state.audit.length} events recorded in this workspace`}>
      <div className="audit-filters panel-pad">
        <Field label="Actor">
          <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}>
            {actors.map((actor) => <option key={actor}>{actor}</option>)}
          </select>
        </Field>
        <Field label="Action">
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            {actions.map((action) => <option key={action}>{action}</option>)}
          </select>
        </Field>
        <label className="field audit-check">
          <span><input type="checkbox" checked={patientOnly} onChange={(e) => setPatientOnly(e.target.checked)} /> Only {patient.name}</span>
        </label>
        <button disabled={readOnly} onClick={() => dispatch({ type: "reviewAudit", patientId: patient.id })}>Record that I reviewed this log</button>
      </div>
      <SimpleTable
        heads={["Time", "Actor", "Action", "Patient", "Detail"]}
        rows={rows.map((event) => [
          new Date(event.timestamp).toLocaleString(),
          event.actor,
          event.action,
          event.patientId ? state.patients.find((p) => p.id === event.patientId)?.mrn ?? event.patientId : "—",
          `${event.detail}${event.provenance === "imported" ? " (imported)" : ""}`,
        ])}
      />
    </Panel>
  );
}

function SummaryPanel({ state }: { state: EHRState }) {
  const byAction = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of state.audit) counts.set(event.action, (counts.get(event.action) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [state.audit]);
  return (
    <Panel title="Activity summary" subtitle="Most frequent actions">
      <SimpleTable heads={["Action", "Count"]} rows={byAction.map(([action, count]) => [action, String(count)])} />
    </Panel>
  );
}

function ReleasePanel({ dispatch, patient, readOnly }: ViewProps) {
  const [roiPurpose, setRoiPurpose] = useState("Continuity of care");

  function prepare() {
    const summary = {
      patient: { name: patient.name, mrn: patient.mrn },
      purpose: roiPurpose,
      releasedAt: nowIso(),
      sections: ["Problems", "Medications", "Allergies", "Results"],
      note: "Synthetic teaching record. Minimum necessary for the stated purpose.",
    };
    download(`roi-${patient.mrn}.json`, JSON.stringify(summary, null, 2));
    dispatch({ type: "audit", action: "Review audit log", detail: `Release of information prepared for ${patient.mrn}: ${roiPurpose}`, patientId: patient.id, context: `roi:${patient.id}` });
  }

  return (
    <Panel title="Release of information" subtitle="Minimum necessary, purpose, and an accounting of disclosures">
      <div className="form-stack panel-pad">
        <Field label="Purpose">
          <select value={roiPurpose} onChange={(e) => setRoiPurpose(e.target.value)}>
            <option>Continuity of care</option>
            <option>Patient request</option>
            <option>Payer audit</option>
            <option>Legal request</option>
          </select>
        </Field>
        <div><button disabled={readOnly} onClick={prepare}>Prepare release package (simulated)</button></div>
      </div>
      <InlineAlert tone="info" title="Accounting">
        <p>Every release is itself an auditable event with a purpose, a date, and the sections disclosed.</p>
      </InlineAlert>
    </Panel>
  );
}

function DowntimePanel({ dispatch, readOnly }: ViewProps) {
  const [downtime, setDowntime] = useState<{ startedAt: string | null; notes: string }>({ startedAt: null, notes: "" });

  function endDowntime() {
    dispatch({ type: "audit", action: "Review audit log", detail: `Downtime recovery: ${downtime.notes.trim() || "no notes"}`, context: "downtime" });
    setDowntime({ startedAt: null, notes: "" });
  }

  return (
    <Panel title="Downtime and correction" subtitle="What happens when the EHR is unavailable">
      <div className="panel-pad">
        {downtime.startedAt ? (
          <div className="stack">
            <p className="form-message error">Downtime declared at {new Date(downtime.startedAt).toLocaleTimeString()}. Use paper forms; record every order and vital with time and initials.</p>
            <Field label="Recovery notes">
              <textarea rows={3} value={downtime.notes} onChange={(e) => setDowntime({ ...downtime, notes: e.target.value })} placeholder="What was documented on paper and must be reconciled" />
            </Field>
            <div><button className="primary" onClick={endDowntime}>End downtime and reconcile</button></div>
          </div>
        ) : (
          <button className="danger-button" disabled={readOnly} onClick={() => setDowntime({ startedAt: nowIso(), notes: "" })}>Declare downtime (simulation)</button>
        )}
      </div>
      <ol className="checklist">
        <li>Switch to downtime forms and identify patients by two identifiers.</li>
        <li>Log the start time and who declared it.</li>
        <li>On recovery, back-enter with the original time and mark the entry as late.</li>
        <li>Reconcile orders and results before resuming normal work.</li>
      </ol>
      <Tip>Audit evidence answers &ldquo;what happened&rdquo;; pair it with the build or workflow record to answer &ldquo;why.&rdquo;</Tip>
    </Panel>
  );
}
