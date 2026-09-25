"use client";

import { useEffect, useMemo, useState } from "react";
import { NavLink } from "@/components/ui/NavLink";
import { PageHeader, Segmented, SimulationBadge, Status, Tip } from "@/components/ui/primitives";
import { AI_REPLY_ISSUES, INBASKET_OUTCOMES } from "@/lib/seeds/inbasket";
import { SIMULATION_DATE } from "@/lib/seed";
import type { EHRState, InBasketItem, InBasketKind, Patient } from "@/lib/types";
import { formatWhen, type ViewProps } from "./shared";

type Pool = InBasketItem["pool"];

const FOLDERS: { kind: InBasketKind; label: string; color: string }[] = [
  { kind: "Result", label: "Results", color: "red" },
  { kind: "Advice request", label: "Patient Advice Requests", color: "" },
  { kind: "Refill request", label: "Rx Refill Requests", color: "" },
  { kind: "Co-sign", label: "Co-sign Notes", color: "" },
  { kind: "AI draft reply", label: "AI Draft Replies", color: "maroon" },
];

const TASK_OWNERS = ["Dr. Lin Chen", "Sam Brooks, NP", "Clinic nurse triage pool", "Covering provider on call"];

function patientName(state: EHRState, id: string) {
  return state.patients.find((patient) => patient.id === id)?.name ?? id;
}

function priorityTone(priority: InBasketItem["priority"]) {
  return priority === "Critical" ? "danger" : priority === "High" ? "warn" : "neutral";
}

export function InBasket(props: ViewProps) {
  const { state, role } = props;
  const [pool, setPool] = useState<Pool>(role === "Nurse" ? "Nurse" : "Physician/APP");
  const [folder, setFolder] = useState<InBasketKind>("Result");
  const [showDone, setShowDone] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setPool(role === "Nurse" ? "Nurse" : "Physician/APP");
  }, [role]);

  const openIn = (p: Pool, kind?: InBasketKind) => state.inBasket.filter((item) => item.pool === p && item.status === "Open" && (!kind || item.kind === kind)).length;

  const items = useMemo(
    () => state.inBasket
      .filter((item) => item.pool === pool && item.kind === folder && (showDone || item.status === "Open" || item.id === selectedId))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    [state.inBasket, pool, folder, showDone, selectedId],
  );
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  return (
    <div className="inbasket">
      <PageHeader
        title="In Basket"
        eyebrow="Clinical"
        subtitle="Results, patient messages, refills, co-signatures, and AI-drafted replies. Every item needs an owner and an outcome."
        actions={(
          <>
            <Segmented
              label="Pool"
              value={pool}
              onChange={(value) => { setPool(value); setSelectedId(null); }}
              options={[
                { value: "Physician/APP", label: "Physician/APP pool", count: openIn("Physician/APP") },
                { value: "Nurse", label: "Nurse pool", count: openIn("Nurse") },
              ]}
            />
            <SimulationBadge />
          </>
        )}
      />
      <div className="split three">
        <aside className="folder-list" aria-label="In Basket folders">
          <h2>Folders</h2>
          {FOLDERS.map((entry) => {
            const count = openIn(pool, entry.kind);
            return (
              <button
                key={entry.kind}
                type="button"
                className={folder === entry.kind ? "active" : ""}
                aria-pressed={folder === entry.kind}
                onClick={() => { setFolder(entry.kind); setSelectedId(null); }}
              >
                <span>{entry.label}</span>
                <span className={`folder-count ${count ? entry.color : "zero"}`} aria-hidden="true">{count}</span>
              </button>
            );
          })}
          <label className="ib-show-done">
            <input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} />
            Show completed
          </label>
        </aside>
        <section className="pane ib-list" aria-label="Messages">
          {items.length ? (
            <ul className="queue">
              {items.map((item) => (
                <li key={item.id}>
                  <QueueItem item={item} name={patientName(state, item.patientId)} selected={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty ib-empty">No {showDone ? "" : "open "}items in this folder.</p>
          )}
        </section>
        <section className="pane ib-detail" aria-label="Selected item">
          {selected
            ? <ItemDetail key={selected.id} item={selected} {...props} onPin={() => setSelectedId(selected.id)} />
            : <p className="empty">Select an item to review it.</p>}
        </section>
      </div>
    </div>
  );
}

function QueueItem({ item, name, selected, onSelect }: { item: InBasketItem; name: string; selected: boolean; onSelect: () => void }) {
  const urgent = item.priority !== "Routine";
  return (
    <button type="button" className={`queue-item${selected ? " selected" : ""}`} onClick={onSelect} aria-current={selected ? "true" : undefined}>
      <span className="queue-top">
        <strong>{name} — {item.subject}</strong>
        <span className="queue-meta">{formatWhen(item.receivedAt)}</span>
      </span>
      <span className="queue-body">{item.body}</span>
      <span className="queue-tags">
        {urgent && <span className="dot" aria-hidden="true" />}
        {urgent && <Status tone={priorityTone(item.priority)}>{item.priority}</Status>}
        {item.status === "Done" && <Status tone="good">Done</Status>}
        {item.aiDraft && item.status === "Open" && <Status tone="info">AI draft</Status>}
      </span>
    </button>
  );
}

function ItemDetail({ item, state, dispatch, navigate, makeId, readOnly, onPin }: { item: InBasketItem; onPin: () => void } & ViewProps) {
  const patient = state.patients.find((row) => row.id === item.patientId);
  const name = patient?.name ?? item.patientId;
  return (
    <div className="ib-detail-body">
      <header className="ib-detail-head">
        <h2 className="pane-title">{item.subject}</h2>
        <p className="pane-sub">
          {name} · from {item.from} · received {formatWhen(item.receivedAt)}
        </p>
        <dl className="def-grid">
          <dt>Recipient</dt><dd>{item.recipient}</dd>
          <dt>Priority</dt><dd><Status tone={priorityTone(item.priority)}>{item.priority}</Status></dd>
          <dt>Type</dt><dd>{item.kind}</dd>
        </dl>
        {patient && (
          <NavLink target={{ view: "Patients", patient: patient.id }} navigate={navigate} icon="chart">
            Open {patient.name}&apos;s chart
          </NavLink>
        )}
      </header>
      {item.routingNote && (
        <div className="inline-alert warn ib-routing">
          <strong>Routing note</strong>
          <p>{item.routingNote}</p>
        </div>
      )}
      {item.kind !== "AI draft reply" && item.kind !== "Co-sign" && <p className="ib-message">{item.body}</p>}
      {item.kind === "Result" && item.result && <ResultCard result={item.result} />}
      {item.kind === "Refill request" && item.refill && <RefillCard refill={item.refill} />}
      {item.kind === "Co-sign" && patient && <NoteCard patient={patient} noteId={item.noteId} />}
      {item.kind === "AI draft reply" && (
        <>
          <div className="ib-patient-message">
            <span>Patient message</span>
            <p>{item.body}</p>
          </div>
          {item.aiDraft && (
            <div className="card ai ib-ai-card">
              <h3>AI-drafted reply · review before sending</h3>
              <p className="ib-ai-meta">{item.aiDraft.model} · generated {formatWhen(item.aiDraft.generatedAt)}</p>
              <p className="ib-ai-text">{item.aiDraft.text}</p>
            </div>
          )}
        </>
      )}
      {item.status === "Done"
        ? <DoneSummary item={item} />
        : <ActionForm item={item} patientName={name} dispatch={dispatch} makeId={makeId} readOnly={readOnly} onPin={onPin} />}
      {item.kind === "AI draft reply"
        ? <Tip>The clinician who clicks Send owns the reply. Compare every sentence with the patient&apos;s message and chart; a fluent draft is not a checked draft.</Tip>
        : item.kind === "Result"
          ? <Tip>Acknowledged is not closed. A result loop closes only when a named person owns the next action and it has a due date.</Tip>
          : null}
    </div>
  );
}

function ResultCard({ result }: { result: NonNullable<InBasketItem["result"]> }) {
  const abnormal = Boolean(result.flag);
  return (
    <div className={`card ib-result${/critical/i.test(result.flag) ? " critical" : ""}`}>
      <span className="ib-result-name">{result.name}</span>
      <strong className={`ib-result-value${abnormal ? " abnormal" : ""}`}>{result.value} {result.unit}</strong>
      {result.flag && <span className="chip-pill danger">{result.flag}</span>}
      <dl className="def-grid">
        <dt>Reference range</dt><dd>{result.range}</dd>
        <dt>Collected</dt><dd>{formatWhen(result.collectedAt)}</dd>
        <dt>Ordered by</dt><dd>{result.orderedBy}</dd>
      </dl>
    </div>
  );
}

function RefillCard({ refill }: { refill: NonNullable<InBasketItem["refill"]> }) {
  return (
    <div className="card soft">
      <h3>Refill request</h3>
      <dl className="def-grid">
        <dt>Medication</dt><dd>{refill.medication}</dd>
        <dt>Pharmacy</dt><dd>{refill.pharmacy}</dd>
        <dt>Last filled</dt><dd>{refill.lastFilled}</dd>
        {refill.note && (<><dt>Note</dt><dd>{refill.note}</dd></>)}
      </dl>
    </div>
  );
}

function NoteCard({ patient, noteId }: { patient: Patient; noteId?: string }) {
  const note = patient.notes.find((row) => row.id === noteId);
  if (!note) return <p className="empty">The note {noteId} is not in this chart.</p>;
  return (
    <div className="card soft ib-note">
      <h3>{note.id} · {note.author} · {formatWhen(note.recordedAt)}</h3>
      <p><b>S:</b> {note.subjective}</p>
      <p><b>O:</b> {note.objective}</p>
      <p><b>A:</b> {note.assessment}</p>
      <p><b>P:</b> {note.plan}</p>
      {note.cosignedBy && <p className="help">Co-signed by {note.cosignedBy} {formatWhen(note.cosignedAt)}</p>}
    </div>
  );
}

function DoneSummary({ item }: { item: InBasketItem }) {
  return (
    <div className="card ib-done">
      <p className="form-message success" role="status">Completed: {item.outcome} · {formatWhen(item.completedAt)}</p>
      <dl className="def-grid">
        <dt>Outcome</dt><dd>{item.outcome}</dd>
        {item.reply && (<><dt>Reply</dt><dd>{item.reply}</dd></>)}
        {item.reviewIssues && (<><dt>Issues noted</dt><dd>{item.reviewIssues.length ? item.reviewIssues.join("; ") : "None"}</dd></>)}
        {item.taskId && (<><dt>Follow-up task</dt><dd>{item.taskId}</dd></>)}
      </dl>
    </div>
  );
}

function defaultTaskText(item: InBasketItem, patientName: string) {
  if (item.id === "IB-001") return `Call ${patientName} today: repeat BMP and review lisinopril dose`;
  return `Follow up ${item.result?.name ?? "result"} with ${patientName}`;
}

function ActionForm({ item, patientName, dispatch, makeId, readOnly, onPin }: { item: InBasketItem; patientName: string; onPin: () => void } & Pick<ViewProps, "dispatch" | "makeId" | "readOnly">) {
  const outcomes = INBASKET_OUTCOMES[item.kind];
  const isAi = item.kind === "AI draft reply";
  const [outcome, setOutcome] = useState(outcomes[0]);
  const [owner, setOwner] = useState(TASK_OWNERS[0]);
  const [due, setDue] = useState(SIMULATION_DATE);
  const [taskText, setTaskText] = useState(defaultTaskText(item, patientName));
  const [reply, setReply] = useState(isAi ? item.aiDraft?.text ?? "" : "");
  const [issues, setIssues] = useState<string[]>([]);
  const [error, setError] = useState("");
  const withTask = item.kind === "Result" && /follow-up/i.test(outcome);

  function toggleIssue(issue: string, on: boolean) {
    setIssues((current) => (on ? [...current, issue] : current.filter((row) => row !== issue)));
  }

  function complete() {
    setError("");
    const draft = item.aiDraft?.text ?? "";
    if (item.kind === "Advice request" && outcome === "Reply to patient" && reply.trim().length < 10) {
      setError("Write a reply to the patient (10+ characters) before completing.");
      return;
    }
    if (withTask && (taskText.trim().length < 10 || !due)) {
      setError("Describe the follow-up task and give it a due date.");
      return;
    }
    if (isAi && outcome === "Edit and send" && reply.trim() === draft.trim()) {
      setError("Edit the draft before sending, or choose Send as drafted.");
      return;
    }
    if (isAi && outcome === "Discard and write own reply" && (reply.trim().length < 20 || reply.trim() === draft.trim())) {
      setError("Write your own reply (20+ characters) that replaces the draft.");
      return;
    }
    onPin();
    const sendsReply = isAi ? outcome !== "Discard and route to clinician" : outcome === "Reply to patient";
    dispatch({
      type: "completeInBasket",
      itemId: item.id,
      outcome,
      reply: sendsReply ? (isAi && outcome === "Send as drafted" ? draft : reply.trim()) : undefined,
      task: withTask ? { id: makeId("TASK"), patientId: item.patientId, title: taskText.trim(), due, complete: false, owner } : undefined,
      reviewIssues: isAi ? issues : undefined,
      cosigner: item.kind === "Co-sign" ? "Dr. Chen" : undefined,
    });
  }

  return (
    <div className="ib-action card">
      <h3>{isAi ? "Your review" : "Action"}</h3>
      {isAi && (
        <fieldset className="ib-issues">
          <legend>Issues found in the draft</legend>
          <div className="check-grid">
            {AI_REPLY_ISSUES.map((issue) => (
              <label key={issue} className={issues.includes(issue) ? "checked" : ""}>
                <input type="checkbox" checked={issues.includes(issue)} onChange={(event) => toggleIssue(issue, event.target.checked)} disabled={readOnly} />
                <span>{issue}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="form-stack">
        <label>
          {isAi ? "Decision" : "Action"}
          <select aria-label={isAi ? "Decision" : "Action"} value={outcome} onChange={(event) => setOutcome(event.target.value)} disabled={readOnly}>
            {outcomes.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        {withTask && (
          <div className="ib-task-grid">
            <label>
              Task owner
              <select aria-label="Task owner" value={owner} onChange={(event) => setOwner(event.target.value)} disabled={readOnly}>
                {TASK_OWNERS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>
              Due date
              <input type="date" aria-label="Task due date" value={due} onChange={(event) => setDue(event.target.value)} disabled={readOnly} />
            </label>
            <label className="wide">
              Task
              <input aria-label="Task description" value={taskText} onChange={(event) => setTaskText(event.target.value)} disabled={readOnly} />
            </label>
          </div>
        )}
        {item.kind === "Advice request" && (
          <label>
            Reply
            <textarea aria-label="Reply to patient" rows={4} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Plain-language reply; say who will follow up and when." disabled={readOnly} />
          </label>
        )}
        {isAi && (
          <label>
            Reply text
            <textarea aria-label="Reply text" rows={5} value={reply} onChange={(event) => setReply(event.target.value)} disabled={readOnly || outcome === "Send as drafted" || outcome === "Discard and route to clinician"} />
            {outcome === "Send as drafted" && <small className="help">The draft will be sent exactly as written.</small>}
          </label>
        )}
        <div className="button-row">
          <button type="button" className="primary" onClick={complete} disabled={readOnly}>Complete</button>
        </div>
        {error && <p className="form-message error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
