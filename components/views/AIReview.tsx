"use client";

import { useState } from "react";
import { Field, InlineAlert, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import { nowIso, type ViewProps } from "./shared";

interface Finding { id: string; taxonomy: string; title: string; evidence: string }

export function AIReview({ patient, dispatch, state, makeId }: ViewProps) {
  const allergy = patient.allergies[0];
  const findings: Finding[] = [
    { id: "unsupportedExam", taxonomy: "Fabricated finding", title: "Unsupported normal neurologic examination", evidence: "The source explicitly says the neurologic examination was not performed." },
    { id: "wrongLaterality", taxonomy: "Laterality error", title: "Incorrect left shoulder laterality", evidence: "The chart problem and encounter evidence describe the right shoulder." },
    { id: "omittedAllergy", taxonomy: "Omission", title: "Penicillin allergy omitted from safety context", evidence: `The chart lists ${allergy?.allergen ?? "an allergy"}${allergy?.reaction ? ` with ${allergy.reaction}` : ""}.` },
    { id: "inventedPlan", taxonomy: "Hallucinated plan", title: "MRI and opioid plan invented", evidence: "The supplied encounter evidence does not include either action." },
    { id: "wrongMechanism", taxonomy: "Misattributed cause", title: "\"After a fall\" contradicts the history", evidence: "The patient reports increased lifting and denies a fall." },
    { id: "biasRisk", taxonomy: "Bias and generalization", title: "Draft assumes an English-speaking patient understood the plan", evidence: `${patient.name}'s preferred language is ${patient.language}; no interpreter use is documented.` },
  ];
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [disposition, setDisposition] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const previous = state.aiReviews.filter((review) => review.patientId === patient.id);
  const selected = findings.filter((finding) => checks[finding.id]);

  return <div className="grid two-one">
    <Panel title="AI-generated draft" subtitle="Scripted teaching output, not a live model" actions={<SimulationBadge>Scripted simulation</SimulationBadge>}>
      <article className="ai-draft"><header><Status tone="warn">Draft requires review</Status><span>Generated from the simulated visit · sources claimed: current encounter, problem list, medication list</span></header><h3>Visit summary</h3><p>{patient.name} presents with worsening <mark>left</mark> shoulder pain <mark>after a fall</mark>. <mark>Neurologic examination is normal.</mark> Assessment is shoulder bursitis. Plan: <mark>start amoxicillin, order an MRI, and prescribe a short course of opioid medication</mark>. Patient verbalized understanding.</p></article>
      <div className="taxonomy-grid" role="group" aria-label="Review findings">{findings.map((finding) => <label key={finding.id}><input type="checkbox" checked={Boolean(checks[finding.id])} onChange={(e) => setChecks({ ...checks, [finding.id]: e.target.checked })} /><span><span className="class">{finding.taxonomy}</span><strong>{finding.title}</strong><small>{finding.evidence}</small></span></label>)}</div>
    </Panel>
    <div className="stack">
      <Panel title="Human review decision" subtitle="The signer remains accountable">
        <Field label="Disposition"><select value={disposition} onChange={(e) => setDisposition(e.target.value)}><option value="">Choose a decision</option><option>Reject and redraft from evidence</option><option>Edit and retain with corrections</option><option>Accept without changes</option></select></Field>
        <Field label="Reviewer note" hint="Name the most serious error and what evidence you compared it against."><textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <button className="primary" onClick={() => { if (!disposition) { setMessage("Choose a disposition."); return; } if (disposition === "Accept without changes" && selected.length) { setMessage("You identified errors; accepting without changes contradicts your own review."); return; } dispatch({ type: "recordAIReview", record: { id: makeId("AIR"), patientId: patient.id, findings: selected.map((f) => `${f.taxonomy}: ${f.title}`), disposition, note: note.trim(), reviewedAt: nowIso() } }); setMessage(`Review recorded: ${disposition} with ${selected.length} finding(s).`); }}>Record review</button>
        {message && <p className={`form-message ${message.startsWith("Review recorded") ? "success" : "error"}`} role="status">{message}</p>}
      </Panel>
      <Panel title="Evaluation record" subtitle={`${previous.length} review(s) for this patient`}>{previous.length ? <div className="run-list">{previous.map((review) => <p key={review.id}><strong>{review.disposition}</strong><span>{review.findings.length} finding(s) · {new Date(review.reviewedAt).toLocaleString()}</span></p>)}</div> : <p className="empty">No reviews recorded.</p>}</Panel>
      <Panel title="Review standard"><ol><li>Compare every clinical claim with a named source.</li><li>Check omissions that affect safety.</li><li>Confirm patient identity, timing, laterality, and mechanism.</li><li>Look for assumptions about language, access, or adherence.</li><li>Document the decision and the correction.</li></ol><InlineAlert tone="info" title="Monitoring after release"><p>A draft tool needs an error rate by class, a review-time measure, a balancing measure such as omitted allergies, and a rollback trigger.</p></InlineAlert></Panel>
    </div>
  </div>;
}
