"use client";

import { useEffect, useState } from "react";
import { Field, InlineAlert, Panel, SimulationBadge } from "@/components/ui/primitives";
import type { NoteVersion } from "@/lib/types";
import { nowIso, type ViewProps } from "./shared";

const sections = ["subjective", "objective", "assessment", "plan"] as const;
const placeholders: Record<(typeof sections)[number], string> = {
  subjective: "Patient-reported symptoms, history, and concerns",
  objective: "Observed or measured findings actually obtained",
  assessment: "Clinical interpretation and supported diagnoses",
  plan: "Orders, treatment, education, and follow-up",
};

export function Encounter({ patient, dispatch, config, makeId }: ViewProps) {
  const [note, setNote] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [templateId, setTemplateId] = useState(config.noteTemplates[0]?.id ?? "");
  const [copiedFrom, setCopiedFrom] = useState<string | undefined>();
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const signedNotes = patient.notes.filter((n) => n.kind === "Signed");
  const lastSigned = signedNotes[signedNotes.length - 1];
  const template = config.noteTemplates.find((t) => t.id === templateId);
  const cosigner = config.providers.find((p) => config.providerRoles.find((r) => r.id === p.roleId)?.canCosign);

  useEffect(() => { setNote({ subjective: "", objective: "", assessment: "", plan: "" }); setCopiedFrom(undefined); setVerified(false); setMessage(""); }, [patient.id]);

  function applyTemplate() {
    if (!template) return;
    setNote({ subjective: template.subjective, objective: template.objective, assessment: template.assessment, plan: template.plan });
    setCopiedFrom(undefined);
    setVerified(false);
  }

  function copyForward() {
    if (!template?.copyForwardAllowed) { setMessage("This template does not allow copy-forward. Document the encounter from the source evidence."); return; }
    if (!lastSigned) { setMessage("There is no signed note to copy forward."); return; }
    setNote({ subjective: `${template.subjective}${lastSigned.subjective}`, objective: template.objective, assessment: lastSigned.assessment, plan: lastSigned.plan });
    setCopiedFrom(lastSigned.id);
    setVerified(false);
    setMessage("Prior assessment and plan were copied forward. Re-verify every carried statement and confirm before signing.");
  }

  function save(kind: NoteVersion["kind"]) {
    if (kind === "Signed" && sections.some((key) => !note[key].trim())) { setMessage("Complete all four SOAP sections before signing."); return; }
    if (kind === "Signed" && copiedFrom && !verified) { setMessage("Confirm that copied-forward content was re-verified before signing."); return; }
    if (kind === "Amendment" && (!lastSigned || !reason.trim())) { setMessage("A signed note and an amendment reason are required."); return; }
    const version: NoteVersion = { id: makeId("NOTE"), author: "Student Clinician", recordedAt: nowIso(), kind, ...note, templateId, copiedForwardFrom: copiedFrom, ...(kind === "Amendment" ? { amendmentReason: reason.trim() } : {}) };
    dispatch({ type: "saveNote", patientId: patient.id, note: version });
    setMessage(kind === "Signed" ? "Note signed. Signed content cannot be edited; use an amendment for corrections." : kind === "Amendment" ? "Amendment added. The original signed note remains in history." : "Draft saved.");
    if (kind === "Amendment") setReason("");
  }

  const allergy = patient.allergies[0];
  return <div className="grid two-one">
    <Panel title="SOAP note" subtitle="Document only information supplied by the encounter" actions={<SimulationBadge />}>
      <div className="note-template-bar"><Field label="Template"><select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>{config.noteTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><button onClick={applyTemplate}>Apply template</button><button onClick={copyForward} disabled={!lastSigned}>Copy forward last signed note</button></div>
      {template && <p className="help">{template.guidance}</p>}
      <div className="soap-grid">
        {sections.map((key) => <label key={key}><span>{key[0].toUpperCase()} · {key}</span><textarea rows={5} value={note[key]} onChange={(e) => setNote({ ...note, [key]: e.target.value })} placeholder={placeholders[key]} /></label>)}
      </div>
      {copiedFrom && <label className="field"><span><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> I re-verified every statement copied from {copiedFrom} against today's encounter.</span></label>}
      <div className="form-actions"><button onClick={() => save("Draft")}>Save draft</button><button className="primary" onClick={() => save("Signed")}>Sign note</button></div>
      {message && <p className={`form-message ${message.startsWith("Note signed") || message.startsWith("Amendment") || message.startsWith("Draft") ? "success" : "error"}`} role="status">{message}</p>}
    </Panel>
    <div className="stack">
      <Panel title="Chart evidence" subtitle="Use these facts; do not invent findings">
        <p><strong>Reason for visit:</strong> Follow-up for right shoulder pain after increased lifting.</p><p><strong>Reported:</strong> Pain improves with rest. No fall, fever, weakness, or numbness.</p><p><strong>Observed:</strong> BP {patient.vitals[0]?.bp ?? "not recorded"}; tenderness over right lateral shoulder; active range limited by pain. Neurologic exam not performed.</p><p><strong>Known allergy:</strong> {allergy?.allergen ?? "Not reviewed"}{allergy?.reaction ? ` · ${allergy.reaction}` : ""}</p>
      </Panel>
      <Panel title="Amendment" subtitle="Signed content remains in history">
        <textarea rows={3} aria-label="Reason for amendment" placeholder="Reason for amendment" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button onClick={() => save("Amendment")}>Add amendment</button>
        {!lastSigned && <p className="help">Sign a complete note before creating an amendment.</p>}
      </Panel>
      <Panel title="Co-signature" subtitle="A resident or student note may require attending co-signature">
        {lastSigned ? <div className="stack"><p>Most recent signed note: <strong>{lastSigned.id}</strong>{lastSigned.cosignedBy ? ` · co-signed by ${lastSigned.cosignedBy}` : " · awaiting co-signature"}</p>{!lastSigned.cosignedBy && cosigner && <button onClick={() => dispatch({ type: "cosignNote", patientId: patient.id, noteId: lastSigned.id, by: cosigner.name })}>Co-sign as {cosigner.name} (simulated)</button>}</div> : <p className="empty">No signed note yet.</p>}
        <InlineAlert tone="info" title="Integrity rule"><p>Signing creates an immutable version. Corrections are amendments that point back to the signed note.</p></InlineAlert>
      </Panel>
    </div>
  </div>;
}
