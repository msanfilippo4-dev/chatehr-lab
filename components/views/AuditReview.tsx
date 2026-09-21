"use client";

import { useMemo, useState } from "react";
import { Field, InlineAlert, Panel, SimpleTable, SimulationBadge } from "@/components/ui/primitives";
import { download, nowIso, type ViewProps } from "./shared";

/** HIM view: access review, release-of-information log, downtime and correction workflow. */
export function AuditReview({ state, dispatch, patient }: ViewProps) {
  const [actorFilter, setActorFilter] = useState("All");
  const [patientOnly, setPatientOnly] = useState(false);
  const [roiPurpose, setRoiPurpose] = useState("Continuity of care");
  const [downtime, setDowntime] = useState<{ startedAt: string | null; notes: string }>({ startedAt: null, notes: "" });
  const actors = useMemo(() => ["All", ...new Set(state.audit.map((event) => event.actor))], [state.audit]);
  const rows = state.audit.filter((event) => (actorFilter === "All" || event.actor === actorFilter) && (!patientOnly || event.patientId === patient.id)).slice(0, 60);
  const byAction = useMemo(() => { const counts = new Map<string, number>(); for (const event of state.audit) counts.set(event.action, (counts.get(event.action) ?? 0) + 1); return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8); }, [state.audit]);

  return <div className="grid two-one">
    <div className="stack">
      <Panel title="Access and activity review" subtitle="Who did what, to whose record, and when" actions={<SimulationBadge />}>
        <div className="audit-filters"><Field label="Actor"><select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}>{actors.map((actor) => <option key={actor}>{actor}</option>)}</select></Field><label className="field"><span><input type="checkbox" checked={patientOnly} onChange={(e) => setPatientOnly(e.target.checked)} /> Only {patient.name}</span></label><button onClick={() => dispatch({ type: "reviewAudit", patientId: patient.id })}>Record that I reviewed this log</button></div>
        <SimpleTable heads={["Time", "Actor", "Action", "Patient", "Detail"]} rows={rows.map((event) => [new Date(event.timestamp).toLocaleString(), event.actor, event.action, event.patientId ? state.patients.find((p) => p.id === event.patientId)?.mrn ?? event.patientId : "—", `${event.detail}${event.provenance === "imported" ? " (imported)" : ""}`])} />
      </Panel>
      <Panel title="Activity summary" subtitle={`${state.audit.length} events in this workspace`}><SimpleTable heads={["Action", "Count"]} rows={byAction.map(([action, count]) => [action, String(count)])} /></Panel>
    </div>
    <div className="stack">
      <Panel title="Release of information" subtitle="Minimum necessary, purpose, and an accounting of disclosures">
        <Field label="Purpose"><select value={roiPurpose} onChange={(e) => setRoiPurpose(e.target.value)}><option>Continuity of care</option><option>Patient request</option><option>Payer audit</option><option>Legal request</option></select></Field>
        <button onClick={() => { const summary = { patient: { name: patient.name, mrn: patient.mrn }, purpose: roiPurpose, releasedAt: nowIso(), sections: ["Problems", "Medications", "Allergies", "Results"], note: "Synthetic teaching record. Minimum necessary for the stated purpose." }; download(`roi-${patient.mrn}.json`, JSON.stringify(summary, null, 2)); dispatch({ type: "audit", action: "Review audit log", detail: `Release of information prepared for ${patient.mrn}: ${roiPurpose}`, patientId: patient.id, context: `roi:${patient.id}` }); }}>Prepare release package (simulated)</button>
        <InlineAlert tone="info" title="Accounting"><p>Every release is itself an auditable event with a purpose, a date, and the sections disclosed.</p></InlineAlert>
      </Panel>
      <Panel title="Downtime and correction" subtitle="What happens when the EHR is unavailable">
        {downtime.startedAt ? <div className="stack"><p className="form-message error">Downtime declared at {new Date(downtime.startedAt).toLocaleTimeString()}. Use paper forms; record every order and vital with time and initials.</p><Field label="Recovery notes"><textarea rows={3} value={downtime.notes} onChange={(e) => setDowntime({ ...downtime, notes: e.target.value })} placeholder="What was documented on paper and must be reconciled" /></Field><button className="primary" onClick={() => { dispatch({ type: "audit", action: "Review audit log", detail: `Downtime recovery: ${downtime.notes.trim() || "no notes"}`, context: "downtime" }); setDowntime({ startedAt: null, notes: "" }); }}>End downtime and reconcile</button></div> : <button className="danger-button" onClick={() => setDowntime({ startedAt: nowIso(), notes: "" })}>Declare downtime (simulation)</button>}
        <ol className="checklist"><li>Switch to downtime forms and identify patients by two identifiers.</li><li>Log the start time and who declared it.</li><li>On recovery, back-enter with the original time and mark the entry as late.</li><li>Reconcile orders and results before resuming normal work.</li></ol>
      </Panel>
    </div>
  </div>;
}
