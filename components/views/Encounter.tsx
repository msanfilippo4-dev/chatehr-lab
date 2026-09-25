"use client";

import { useEffect, useState } from "react";
import { Field, InlineAlert, PageHeader, Panel, SimulationBadge } from "@/components/ui/primitives";
import { realAllergies } from "@/lib/patient";
import { SIMULATION_DATE } from "@/lib/seed";
import type { NoteVersion, Patient } from "@/lib/types";
import { nowIso, type ViewProps } from "./shared";

const SECTIONS = ["subjective", "objective", "assessment", "plan"] as const;
type Section = (typeof SECTIONS)[number];
type Draft = Record<Section, string>;

const PLACEHOLDERS: Record<Section, string> = {
  subjective: "Patient-reported symptoms, history, and concerns",
  objective: "Observed or measured findings actually obtained",
  assessment: "Clinical interpretation and supported diagnoses",
  plan: "Orders, treatment, education, and follow-up",
};

const EMPTY: Draft = { subjective: "", objective: "", assessment: "", plan: "" };

export function Encounter(props: ViewProps) {
  const { patient, dispatch, config, makeId, readOnly } = props;
  const [note, setNote] = useState<Draft>(EMPTY);
  const [templateId, setTemplateId] = useState(config.noteTemplates[0]?.id ?? "");
  const [copiedFrom, setCopiedFrom] = useState<string | undefined>();
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const signedNotes = patient.notes.filter((item) => item.kind === "Signed");
  const lastSigned = signedNotes[signedNotes.length - 1];
  const template = config.noteTemplates.find((item) => item.id === templateId);

  useEffect(() => {
    setNote(EMPTY);
    setCopiedFrom(undefined);
    setVerified(false);
    setMessage("");
  }, [patient.id]);

  function applyTemplate() {
    if (!template) return;
    setNote({ subjective: template.subjective, objective: template.objective, assessment: template.assessment, plan: template.plan });
    setCopiedFrom(undefined);
    setVerified(false);
  }

  function copyForward() {
    if (!template?.copyForwardAllowed) {
      setMessage("This template does not allow copy-forward. Document the encounter from the source evidence.");
      return;
    }
    if (!lastSigned) {
      setMessage("There is no signed note to copy forward.");
      return;
    }
    setNote({ subjective: `${template.subjective}${lastSigned.subjective}`, objective: template.objective, assessment: lastSigned.assessment, plan: lastSigned.plan });
    setCopiedFrom(lastSigned.id);
    setVerified(false);
    setMessage("Prior assessment and plan were copied forward. Re-verify every carried statement and confirm before signing.");
  }

  function save(kind: NoteVersion["kind"]) {
    if (kind === "Signed" && SECTIONS.some((key) => !note[key].trim())) {
      setMessage("Complete all four SOAP sections before signing.");
      return;
    }
    if (kind === "Signed" && copiedFrom && !verified) {
      setMessage("Confirm that copied-forward content was re-verified before signing.");
      return;
    }
    if (kind === "Amendment" && (!lastSigned || !reason.trim())) {
      setMessage("A signed note and an amendment reason are required.");
      return;
    }
    const version: NoteVersion = {
      id: makeId("NOTE"),
      author: "Student Clinician",
      recordedAt: nowIso(),
      kind,
      ...note,
      templateId,
      copiedForwardFrom: copiedFrom,
      source: copiedFrom ? "Copied forward" : "Typed",
      ...(kind === "Amendment" ? { amendmentReason: reason.trim() } : {}),
    };
    dispatch({ type: "saveNote", patientId: patient.id, note: version });
    if (kind === "Signed") setMessage("Note signed. Signed content cannot be edited; use an amendment for corrections.");
    else if (kind === "Amendment") setMessage("Amendment added. The original signed note remains in history.");
    else setMessage("Draft saved.");
    if (kind === "Amendment") setReason("");
  }

  const success = /^(Note signed|Amendment|Draft)/.test(message);

  return (
    <div className="encounter-view">
      <PageHeader eyebrow="Documentation" title="Encounter note" subtitle="Document only what the encounter supplies. Signed notes are immutable; corrections are amendments." actions={<SimulationBadge />} />
      <div className="grid two-one">
        <Panel title="SOAP note" subtitle={`${patient.name} · ${SIMULATION_DATE}`}>
          <div className="note-template-bar">
            <Field label="Template">
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                {config.noteTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <button onClick={applyTemplate} disabled={readOnly}>Apply template</button>
            <button onClick={copyForward} disabled={!lastSigned || readOnly}>Copy forward last signed note</button>
          </div>
          {template && <p className="help">{template.guidance}</p>}
          <div className="soap-grid">
            {SECTIONS.map((key) => (
              <label key={key}>
                <span>{key[0].toUpperCase()} · {key}</span>
                <textarea rows={5} value={note[key]} onChange={(event) => setNote({ ...note, [key]: event.target.value })} placeholder={PLACEHOLDERS[key]} disabled={readOnly} />
              </label>
            ))}
          </div>
          {copiedFrom && (
            <label className="field copy-verify">
              <span>
                <input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} /> I re-verified every statement copied from {copiedFrom} against today&apos;s encounter.
              </span>
            </label>
          )}
          <div className="form-actions">
            <button onClick={() => save("Draft")} disabled={readOnly}>Save draft</button>
            <button className="primary" onClick={() => save("Signed")} disabled={readOnly}>Sign note</button>
          </div>
          {message && <p className={`form-message ${success ? "success" : "error"}`} role="status">{message}</p>}
        </Panel>
        <div className="stack">
          <ChartEvidence patient={patient} />
          <Panel title="Amendment" subtitle="Signed content remains in history">
            <div className="form-stack">
              <textarea rows={3} aria-label="Reason for amendment" placeholder="Reason for amendment" value={reason} onChange={(event) => setReason(event.target.value)} disabled={readOnly} />
              <div><button onClick={() => save("Amendment")} disabled={readOnly}>Add amendment</button></div>
            </div>
            {!lastSigned && <p className="help">Sign a complete note before creating an amendment.</p>}
          </Panel>
          <CosignPanel {...props} lastSigned={lastSigned} />
        </div>
      </div>
    </div>
  );
}

/** The facts the learner may document, drawn from the chart (Liu Huang has a scripted visit). */
function ChartEvidence({ patient }: { patient: Patient }) {
  const vitals = patient.vitals[0];
  const allergies = realAllergies(patient);
  const today = (patient.encounters ?? []).find((item) => item.date === SIMULATION_DATE) ?? (patient.encounters ?? []).at(-1);
  const scripted = patient.id === "PT-001";
  return (
    <Panel title="Chart evidence" subtitle="Use these facts; do not invent findings">
      <dl className="facts">
        <div><dt>Reason for visit</dt><dd>{scripted ? "Follow-up for right shoulder pain after increased lifting at work." : today?.reason ?? "Not recorded"}</dd></div>
        {scripted && <div><dt>Reported</dt><dd>Pain improves with rest. No fall, fever, weakness, or numbness. Mandarin video interpreter used.</dd></div>}
        <div>
          <dt>Observed</dt>
          <dd>
            {vitals ? `BP ${vitals.bp}, HR ${vitals.hr}${vitals.temp ? `, T ${vitals.temp}` : ""}${vitals.spo2 ? `, SpO₂ ${vitals.spo2}%` : ""} (${vitals.date})` : "No vitals recorded"}
            {scripted && "; tenderness over right lateral shoulder; active range limited by pain. Neurologic exam not performed."}
          </dd>
        </div>
        <div><dt>Active problems</dt><dd>{patient.problems.filter((item) => item.status !== "Resolved").map((item) => `${item.display} (${item.code})`).join("; ") || "None"}</dd></div>
        <div><dt>Known allergies</dt><dd className={allergies.length ? "danger-text" : ""}>{allergies.map((item) => `${item.allergen} · ${item.reaction}`).join("; ") || "No known drug allergies"}</dd></div>
      </dl>
    </Panel>
  );
}

function CosignPanel({ patient, config, dispatch, readOnly, lastSigned }: ViewProps & { lastSigned: NoteVersion | undefined }) {
  const cosigner = config.providers.find((provider) => config.providerRoles.find((role) => role.id === provider.roleId)?.canCosign);
  return (
    <Panel title="Co-signature" subtitle="A resident, student, or NP note may require attending co-signature">
      {lastSigned ? (
        <div className="stack">
          <p>
            Most recent signed note: <strong>{lastSigned.id}</strong>
            {lastSigned.cosignedBy ? ` · co-signed by ${lastSigned.cosignedBy}` : " · awaiting co-signature"}
          </p>
          {!lastSigned.cosignedBy && cosigner && (
            <div><button disabled={readOnly} onClick={() => dispatch({ type: "cosignNote", patientId: patient.id, noteId: lastSigned.id, by: cosigner.name })}>Co-sign as {cosigner.name} (simulated)</button></div>
          )}
        </div>
      ) : <p className="empty">No signed note yet.</p>}
      <InlineAlert tone="info" title="Integrity rule">
        <p>Signing creates an immutable version. Corrections are amendments that point back to the signed note.</p>
      </InlineAlert>
    </Panel>
  );
}
