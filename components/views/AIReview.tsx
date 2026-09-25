"use client";

import { useMemo, useState } from "react";
import { PageHeader, SimulationBadge, Status, Tip, type Tone } from "@/components/ui/primitives";
import {
  AI_DRAFT_ID, AI_DRAFT_PATIENT_ID, AI_DRAFT_SENTENCES, AI_REVIEW_DISPOSITIONS, AI_SOURCE_LINES, SENTENCE_LABELS,
} from "@/lib/clinical/ai-review";
import type { SentenceClassification, SentenceLabel } from "@/lib/types";
import { nowIso, type ViewProps } from "./shared";

type ClassMap = Record<string, SentenceClassification>;

function labelTone(label: SentenceLabel | undefined): Tone {
  if (!label) return "neutral";
  if (label === "Supported") return "good";
  if (label === "Omission" || label === "Unsupported") return "warn";
  return "danger";
}

function labelClass(label: SentenceLabel | undefined): string {
  if (!label) return "unreviewed";
  return label === "Supported" ? "supported" : labelTone(label) === "warn" ? "flag-warn" : "flag-danger";
}

/** Fixed FORDMS-A4 exercise: classify each sentence of a scripted AI visit summary against the source. */
export function AIReview({ state, dispatch, makeId, readOnly }: ViewProps) {
  const previous = useMemo(
    () => state.aiReviews.filter((review) => review.draftId === AI_DRAFT_ID || review.patientId === AI_DRAFT_PATIENT_ID),
    [state.aiReviews],
  );
  const latestSaved = previous.find((review) => review.draftId === AI_DRAFT_ID && review.classifications?.length);
  const [classes, setClasses] = useState<ClassMap>(() => Object.fromEntries((latestSaved?.classifications ?? []).map((item) => [item.sentenceId, item])));
  const [selectedId, setSelectedId] = useState(AI_DRAFT_SENTENCES[0].id);
  const [disposition, setDisposition] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const count = Object.keys(classes).length;
  const total = AI_DRAFT_SENTENCES.length;
  const flagged = Object.values(classes).filter((item) => item.label !== "Supported");

  function saveClassification(item: SentenceClassification) {
    const next = { ...classes, [item.sentenceId]: item };
    setClasses(next);
    const nextOpen = AI_DRAFT_SENTENCES.find((sentence) => !next[sentence.id]);
    if (nextOpen) setSelectedId(nextOpen.id);
  }

  function finish() {
    if (count < total) {
      setMessage({ text: `Classify all ${total} sentences before finishing.`, tone: "error" });
      return;
    }
    if (!disposition) {
      setMessage({ text: "Choose a disposition.", tone: "error" });
      return;
    }
    if (disposition === "Accept without changes" && flagged.length) {
      setMessage({ text: "You flagged sentences; accepting without changes contradicts your own review.", tone: "error" });
      return;
    }
    if (note.trim().length < 30) {
      setMessage({ text: "Write a reviewer note of at least 30 characters naming the most serious error.", tone: "error" });
      return;
    }
    const classifications = AI_DRAFT_SENTENCES.map((sentence) => classes[sentence.id]);
    dispatch({
      type: "recordAIReview",
      record: {
        id: makeId("AIR"),
        patientId: AI_DRAFT_PATIENT_ID,
        draftId: AI_DRAFT_ID,
        classifications,
        disposition,
        note: note.trim(),
        findings: classifications.filter((item) => item.label !== "Supported").map((item) => `${item.sentenceId}: ${item.label}`),
        reviewedAt: nowIso(),
      },
    });
    setMessage({ text: "Review recorded. Your instructor sees your accuracy; the answer key is not shown here.", tone: "success" });
  }

  const selected = AI_DRAFT_SENTENCES.find((sentence) => sentence.id === selectedId) ?? AI_DRAFT_SENTENCES[0];
  const selectedIndex = AI_DRAFT_SENTENCES.indexOf(selected);

  return (
    <div className="ai-review-view">
      <PageHeader
        eyebrow="Informatics · AI safety"
        title="AI draft review"
        subtitle="Compare every sentence of the AI-drafted visit summary with the source encounter. Classify each sentence and cite the source line that proves it. The signer stays accountable for every word."
        actions={<SimulationBadge>Scripted simulation</SimulationBadge>}
      />
      <div className="ai-review-grid">
        <SourceCard />
        <section className="card ai-draft-card">
          <div className="ai-draft-head">
            <h3>AI draft · visit summary · unsigned</h3>
            <span className="ai-counter" aria-live="polite">{count} of {total} classified</span>
          </div>
          <p className="help">Liu Huang · MRN 6105100 · generated from the 9/21 encounter. Click a sentence to classify it.</p>
          <ol className="draft-sentences">
            {AI_DRAFT_SENTENCES.map((sentence, index) => {
              const current = classes[sentence.id];
              return (
                <li key={sentence.id}>
                  <button
                    type="button"
                    aria-label={`Sentence ${index + 1}`}
                    className={`draft-sentence ${labelClass(current?.label)}${sentence.id === selected.id ? " selected" : ""}`}
                    onClick={() => setSelectedId(sentence.id)}
                  >
                    <span className="sentence-num">{sentence.id}</span>
                    <span className="sentence-text">{sentence.text}</span>
                    <span className="sentence-status">
                      <Status tone={labelTone(current?.label)}>{current?.label ?? "Not reviewed"}</Status>
                      {current && <small>{current.citation === "none" ? "No source" : current.citation}</small>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
      <div className="ai-review-grid lower">
        <ClassificationEditor
          key={selected.id}
          sentenceId={selected.id}
          number={selectedIndex + 1}
          text={selected.text}
          current={classes[selected.id]}
          readOnly={readOnly}
          onSave={saveClassification}
        />
        <section className="card">
          <h3>Finish the review</h3>
          <LabelSummary classes={classes} />
          <label className="field ticket-field">
            <span>Disposition</span>
            <select aria-label="Disposition" value={disposition} onChange={(event) => setDisposition(event.target.value)} disabled={readOnly}>
              <option value="">Choose a disposition</option>
              {AI_REVIEW_DISPOSITIONS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="field ticket-field">
            <span>Reviewer note</span>
            <textarea aria-label="Reviewer note" rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Name the most serious error, the source that proves it, and what the redraft must fix." disabled={readOnly} />
          </label>
          <div className="button-row">
            <button type="button" className="primary" onClick={finish} disabled={readOnly || count < total}>Finish review</button>
          </div>
          {message && <p className={`form-message ${message.tone}`} role="status">{message.text}</p>}
          <PreviousReviews reviews={previous} />
        </section>
      </div>
      <ReviewStandard />
    </div>
  );
}

function SourceCard() {
  return (
    <section className="card source-card">
      <h3>Source encounter evidence</h3>
      <p className="help">Dr. Lin Chen · Internal Medicine · 9/21/2026 · in-person follow-up</p>
      <ol className="source-lines">
        {AI_SOURCE_LINES.map((line) => (
          <li key={line.id}>
            <span className="source-id">{line.id}</span>
            <span>
              <strong>{line.label}</strong>
              <span className="source-text">{line.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ClassificationEditor({ sentenceId, number, text, current, readOnly, onSave }: {
  sentenceId: string;
  number: number;
  text: string;
  current?: SentenceClassification;
  readOnly: boolean;
  onSave: (item: SentenceClassification) => void;
}) {
  const [label, setLabel] = useState<SentenceLabel | "">(current?.label ?? "");
  const [citation, setCitation] = useState(current?.citation ?? "");
  const [comment, setComment] = useState(current?.comment ?? "");
  const [error, setError] = useState("");

  function save() {
    if (!label || !citation) {
      setError("Choose a classification and a source line (or No source).");
      return;
    }
    setError("");
    onSave({ sentenceId, label, citation, comment: comment.trim() || undefined });
  }

  return (
    <section className="card classify-card">
      <h3>Classify sentence {number} <span className="sentence-num">{sentenceId}</span></h3>
      <blockquote className="classify-quote">{text}</blockquote>
      <fieldset className="classify-options" disabled={readOnly}>
        <legend>Classification</legend>
        {SENTENCE_LABELS.map((option) => (
          <label key={option.label} className={`classify-option${label === option.label ? " checked" : ""}`}>
            <input type="radio" aria-label={option.label} name={`class-${sentenceId}`} value={option.label} checked={label === option.label} onChange={() => setLabel(option.label)} />
            <span>
              <strong>{option.label}</strong>
              <small>{option.help}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="classify-row">
        <label className="field ticket-field">
          <span>Source line</span>
          <select aria-label="Source line" value={citation} onChange={(event) => setCitation(event.target.value)} disabled={readOnly}>
            <option value="">Choose a source line</option>
            {AI_SOURCE_LINES.map((line) => <option key={line.id} value={line.id}>{line.id} · {line.label}</option>)}
            <option value="none">No source</option>
          </select>
        </label>
        <label className="field ticket-field">
          <span>Comment (optional)</span>
          <input aria-label="Comment" value={comment} onChange={(event) => setComment(event.target.value)} disabled={readOnly} />
        </label>
      </div>
      <div className="button-row">
        <button type="button" className="primary" onClick={save} disabled={readOnly}>Save classification</button>
      </div>
      {error && <p className="form-message error" role="status">{error}</p>}
    </section>
  );
}

function LabelSummary({ classes }: { classes: ClassMap }) {
  const counts = SENTENCE_LABELS.map((option) => ({ label: option.label, count: Object.values(classes).filter((item) => item.label === option.label).length }));
  return (
    <ul className="label-summary" aria-label="Your classifications">
      {counts.map((item) => (
        <li key={item.label}>
          <Status tone={labelTone(item.label)}>{item.label}</Status>
          <strong>{item.count}</strong>
        </li>
      ))}
    </ul>
  );
}

function PreviousReviews({ reviews }: { reviews: ViewProps["state"]["aiReviews"] }) {
  if (!reviews.length) return <p className="help">No reviews recorded yet.</p>;
  return (
    <div className="previous-reviews">
      <h4>Recorded reviews</h4>
      <ul>
        {reviews.slice(0, 5).map((review) => (
          <li key={review.id}>
            <strong>{review.disposition}</strong>
            <span>{new Date(review.reviewedAt).toLocaleString()} · {review.classifications ? `${review.classifications.filter((item) => item.label !== "Supported").length} of ${review.classifications.length} flagged` : `${review.findings.length} finding(s)`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewStandard() {
  return (
    <section className="card review-standard">
      <h3>Review standard</h3>
      <ol>
        <li>Read the source first, then the draft. A fluent sentence is not evidence.</li>
        <li>Check laterality, timing, and mechanism of injury against the history.</li>
        <li>Flag exams, findings, or plans the source never mentions (invented content).</li>
        <li>Watch for details that belong to a different patient.</li>
        <li>Look for safety facts the draft leaves out: allergies, new medications, interpreter use.</li>
        <li>Cite the source line for every classification, and record a disposition.</li>
      </ol>
      <Tip title="Monitoring after release">A drafting tool needs an error rate by class, a review-time measure, a balancing measure such as omitted allergies, and a rollback trigger someone can check weekly.</Tip>
    </section>
  );
}
