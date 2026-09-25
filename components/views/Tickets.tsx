"use client";

import { useEffect, useMemo, useState } from "react";
import { NavLink } from "@/components/ui/NavLink";
import { KpiRow, PageHeader, Segmented, Status, Tip, type Tone } from "@/components/ui/primitives";
import type { View } from "@/lib/config/defaults";
import { SIMULATION_DATE } from "@/lib/seed";
import { TICKET_CATEGORIES, TICKET_OWNERS, TICKET_PRIORITIES } from "@/lib/seeds/tickets";
import type { Role, Ticket, TicketCategory, TicketPriority } from "@/lib/types";
import type { ViewProps } from "./shared";

type StatusFilter = "Open" | "Resolved" | "All";
type AssignmentFilter = "All" | "A1" | "A2" | "A3" | "A4" | "Practice";

function ageLabel(openedAt: string): string {
  const days = Math.round((Date.parse(`${SIMULATION_DATE}T12:00:00-04:00`) - Date.parse(openedAt)) / 86_400_000);
  if (days <= 0) return "today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function assignmentTag(ticket: Ticket) {
  return ticket.assignment === "GEN" ? "Practice" : ticket.assignment;
}

function statusTone(status: Ticket["status"]): Tone {
  if (status === "Resolved") return "good";
  if (status === "Triaged") return "info";
  return "warn";
}

function priorityTone(priority: TicketPriority): Tone {
  if (priority === "Urgent") return "danger";
  if (priority === "High") return "warn";
  return "neutral";
}

export function Tickets({ state, dispatch, navigate, readOnly }: ViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Open");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("All");
  const [selectedId, setSelectedId] = useState(state.tickets[0]?.id ?? "");

  const tickets = state.tickets;
  const filtered = useMemo(() => tickets.filter((ticket) => {
    const statusOk = statusFilter === "All" || (statusFilter === "Resolved" ? ticket.status === "Resolved" : ticket.status !== "Resolved");
    const assignmentOk = assignmentFilter === "All" || assignmentTag(ticket) === assignmentFilter;
    return statusOk && assignmentOk;
  }), [tickets, statusFilter, assignmentFilter]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? filtered[0] ?? tickets[0];
  const open = tickets.filter((ticket) => ticket.status !== "Resolved").length;

  return (
    <div className="tickets-view">
      <PageHeader
        eyebrow="Fordham Health service desk"
        title="Analyst tickets"
        subtitle="You are the clinical informatics analyst. Staff report problems here; triage each one, investigate the evidence in the EHR, and resolve it with a root cause, a fix, and a clear message. Your manager is Dana Okafor."
      />
      <KpiRow
        items={[
          { label: "Open", value: open, tone: open ? "warn" : "good", note: "New or triaged" },
          { label: "Triaged", value: tickets.filter((ticket) => ticket.status === "Triaged").length, tone: "info" },
          { label: "Resolved", value: tickets.filter((ticket) => ticket.status === "Resolved").length, tone: "good" },
          { label: "Safety tickets", value: tickets.filter((ticket) => ticket.triage?.category === "Safety").length, note: "Triaged as Safety", tone: "danger" },
        ]}
      />
      <div className="split list-detail">
        <section className="panel ticket-queue-panel">
          <div className="ticket-filters">
            <Segmented<StatusFilter>
              label="Ticket filter"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "Open", label: "Open", count: open },
                { value: "Resolved", label: "Resolved" },
                { value: "All", label: "All" },
              ]}
            />
            <select aria-label="Assignment filter" value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value as AssignmentFilter)}>
              {(["All", "A1", "A2", "A3", "A4", "Practice"] as AssignmentFilter[]).map((item) => (
                <option key={item} value={item}>{item === "All" ? "All assignments" : item}</option>
              ))}
            </select>
          </div>
          <ul className="queue">
            {filtered.map((ticket) => (
              <li key={ticket.id}>
                <QueueItem ticket={ticket} selected={ticket.id === selected?.id} onSelect={() => setSelectedId(ticket.id)} />
              </li>
            ))}
            {!filtered.length && <li className="empty ticket-empty">No tickets match these filters.</li>}
          </ul>
        </section>
        {selected
          ? <TicketDetail key={selected.id} ticket={selected} state={state} dispatch={dispatch} navigate={navigate} readOnly={readOnly} />
          : <section className="panel"><p className="empty ticket-empty">Select a ticket.</p></section>}
      </div>
    </div>
  );
}

function QueueItem({ ticket, selected, onSelect }: { ticket: Ticket; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`queue-item${selected ? " selected" : ""}`} aria-current={selected ? "true" : undefined} onClick={onSelect}>
      <span className="queue-top">
        <strong>{ticket.id} <span className="ticket-subject-inline">{ticket.subject}</span></strong>
      </span>
      <span className="queue-meta">{ticket.requester} · {ticket.requesterRole} · opened {ageLabel(ticket.openedAt)}</span>
      <span className="queue-tags">
        <span className={`assignment-tag ${ticket.assignment === "GEN" ? "practice" : ""}`}>{assignmentTag(ticket)}</span>
        <Status tone={statusTone(ticket.status)}>{ticket.status}</Status>
        {ticket.triage && <Status tone={priorityTone(ticket.triage.priority)}>{ticket.triage.priority}</Status>}
      </span>
    </button>
  );
}

interface DetailProps {
  ticket: Ticket;
  state: ViewProps["state"];
  dispatch: ViewProps["dispatch"];
  navigate: ViewProps["navigate"];
  readOnly: boolean;
}

function TicketDetail({ ticket, state, dispatch, navigate, readOnly }: DetailProps) {
  const patient = ticket.patientId ? state.patients.find((item) => item.id === ticket.patientId) : undefined;
  const triaged = Boolean(ticket.triage);
  const hasEvidence = ticket.evidence.length > 0;
  const resolved = ticket.status === "Resolved";
  const steps = [
    { label: "Triage", done: triaged, current: !triaged },
    { label: "Investigate", done: hasEvidence, current: triaged && !hasEvidence },
    { label: "Resolve", done: resolved, current: triaged && hasEvidence && !resolved },
  ];

  return (
    <section className="panel ticket-detail">
      <div className="ticket-detail-head">
        <div className="ticket-id-row">
          <span className="ticket-id">{ticket.id}</span>
          <span className={`assignment-tag ${ticket.assignment === "GEN" ? "practice" : ""}`}>{assignmentTag(ticket)}</span>
          <Status tone={statusTone(ticket.status)}>{ticket.status}</Status>
        </div>
        <h2>{ticket.subject}</h2>
        <p className="ticket-meta">
          From <strong>{ticket.requester}</strong>, {ticket.requesterRole} · opened {new Date(ticket.openedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
        <blockquote className="ticket-message">{ticket.body}</blockquote>
        {patient && (
          <p className="ticket-patient">
            Patient: <NavLink target={{ view: "Patients", patient: patient.id }} navigate={navigate} icon="chart">{patient.name} · MRN {patient.mrn}</NavLink>
          </p>
        )}
      </div>
      <ol className="stepper" aria-label="Ticket workflow">
        {steps.map((step) => (
          <li key={step.label} className={step.done ? "done" : step.current ? "current" : ""} aria-current={step.current ? "step" : undefined}>{step.label}</li>
        ))}
      </ol>
      <TriageStep ticket={ticket} dispatch={dispatch} readOnly={readOnly} />
      <InvestigateStep ticket={ticket} dispatch={dispatch} navigate={navigate} readOnly={readOnly} />
      <ResolveStep ticket={ticket} dispatch={dispatch} readOnly={readOnly} enabled={triaged && hasEvidence} />
    </section>
  );
}

function TriageStep({ ticket, dispatch, readOnly }: { ticket: Ticket; dispatch: ViewProps["dispatch"]; readOnly: boolean }) {
  const [editing, setEditing] = useState(!ticket.triage);
  const [category, setCategory] = useState<TicketCategory | "">(ticket.triage?.category ?? "");
  const [priority, setPriority] = useState<TicketPriority | "">(ticket.triage?.priority ?? "");
  const [owner, setOwner] = useState(ticket.triage?.owner ?? TICKET_OWNERS[0]);
  const [message, setMessage] = useState("");

  function save() {
    if (!category || !priority) {
      setMessage("Choose a category and a priority before saving triage.");
      return;
    }
    dispatch({ type: "triageTicket", ticketId: ticket.id, category, priority, owner });
    setMessage("");
    setEditing(false);
  }

  return (
    <div className="ticket-step">
      <h3><span className="step-num">1</span> Triage</h3>
      {ticket.triage && !editing ? (
        <div className="triage-summary">
          <dl className="def-grid">
            <dt>Category</dt><dd>{ticket.triage.category}</dd>
            <dt>Priority</dt><dd><Status tone={priorityTone(ticket.triage.priority)}>{ticket.triage.priority}</Status></dd>
            <dt>Owner</dt><dd>{ticket.triage.owner}</dd>
          </dl>
          <button type="button" className="text-button" onClick={() => setEditing(true)} disabled={readOnly}>Edit triage</button>
        </div>
      ) : (
        <>
          <div className="triage-grid">
            <label className="field">
              <span>Category</span>
              <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value as TicketCategory)} disabled={readOnly}>
                <option value="">Choose…</option>
                {TICKET_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Priority</span>
              <select aria-label="Priority" value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)} disabled={readOnly}>
                <option value="">Choose…</option>
                {TICKET_PRIORITIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Owner</span>
              <select aria-label="Owner" value={owner} onChange={(event) => setOwner(event.target.value)} disabled={readOnly}>
                {TICKET_OWNERS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="button-row">
            <button type="button" className="primary" onClick={save} disabled={readOnly}>Save triage</button>
            {ticket.triage && <button type="button" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
          {message && <p className="form-message error" role="status">{message}</p>}
        </>
      )}
      <Tip>Classify by impact, not by who is loudest. Anything that could harm a patient today is Safety, and patient safety sets the priority.</Tip>
    </div>
  );
}

function InvestigateStep({ ticket, dispatch, navigate, readOnly }: { ticket: Ticket; dispatch: ViewProps["dispatch"]; navigate: ViewProps["navigate"]; readOnly: boolean }) {
  const saved = useMemo(() => new Set(ticket.evidence.map((item) => item.id)), [ticket.evidence]);
  const [checked, setChecked] = useState<Set<string>>(new Set(saved));
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { setChecked((current) => new Set([...current, ...saved])); }, [saved]);

  function toggle(id: string) {
    if (saved.has(id)) return;
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    const fresh = [...checked].filter((id) => !saved.has(id));
    if (!fresh.length) {
      setMessage("Tick at least one new piece of evidence you actually checked.");
      return;
    }
    for (const id of fresh) dispatch({ type: "recordTicketEvidence", ticketId: ticket.id, evidenceId: id, note: note.trim() });
    setNote("");
    setMessage(`Saved ${fresh.length} evidence item(s).`);
  }

  return (
    <div className="ticket-step">
      <h3><span className="step-num">2</span> Investigate</h3>
      <p className="step-intro">Where to look. These links open the EHR in the right role and chart:</p>
      <ul className="where-to-look">
        {ticket.links.map((link) => (
          <li key={link.label}>
            <NavLink
              target={{ view: link.view as View, patient: link.patientId, role: link.role as Role | undefined }}
              navigate={navigate}
              icon="arrow"
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <p className="step-intro">Evidence you used. Tick only what you actually checked; some options are distractors.</p>
      <div className="check-grid" role="group" aria-label="Evidence">
        {ticket.evidenceOptions.map((option) => {
          const isSaved = saved.has(option.id);
          const isChecked = checked.has(option.id);
          return (
            <label key={option.id} className={isChecked ? "checked" : ""}>
              <input type="checkbox" checked={isChecked} disabled={readOnly || isSaved} onChange={() => toggle(option.id)} />
              <span>
                {option.label}
                {isSaved && <span className="saved-tag">Saved</span>}
              </span>
            </label>
          );
        })}
      </div>
      <label className="field ticket-field">
        <span>Evidence note (optional)</span>
        <textarea aria-label="Evidence note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What you saw and where (e.g. 'eMAR drawer lists only 50 mg tablets')." disabled={readOnly} />
      </label>
      <div className="button-row">
        <button type="button" onClick={save} disabled={readOnly}>Save evidence</button>
      </div>
      {message && <p className={`form-message ${message.startsWith("Saved") ? "success" : "error"}`} role="status">{message}</p>}
      <Tip>Separate the symptom from the cause. When staff work around a warning every shift, look upstream (build, stocking, routing, report definitions) before blaming people or hardware.</Tip>
    </div>
  );
}

function ResolveStep({ ticket, dispatch, readOnly, enabled }: { ticket: Ticket; dispatch: ViewProps["dispatch"]; readOnly: boolean; enabled: boolean }) {
  const resolution = ticket.resolution;
  const [editing, setEditing] = useState(!resolution);
  const [rootCause, setRootCause] = useState(resolution?.rootCause ?? "");
  const [detail, setDetail] = useState(resolution?.detail ?? "");
  const [fix, setFix] = useState(resolution?.fix ?? "");
  const [notify, setNotify] = useState<string[]>(resolution?.notify ?? []);
  const [communication, setCommunication] = useState(resolution?.communication ?? "");
  const [message, setMessage] = useState("");

  function toggleNotify(name: string) {
    setNotify((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  function resolve() {
    const problems: string[] = [];
    if (!rootCause) problems.push("choose the root cause");
    if (detail.trim().length < 20) problems.push("explain the root cause (20+ characters)");
    if (fix.trim().length < 20) problems.push("describe the fix or recommendation (20+ characters)");
    if (!notify.length) problems.push("choose who to notify");
    if (communication.trim().length < 40) problems.push("write the message to the requester (40+ characters)");
    if (problems.length) {
      setMessage(`To resolve: ${problems.join("; ")}.`);
      return;
    }
    dispatch({ type: "resolveTicket", ticketId: ticket.id, resolution: { rootCause, detail: detail.trim(), fix: fix.trim(), notify, communication: communication.trim() } });
    setMessage(`Ticket resolved. ${ticket.requester} will see your message.`);
    setEditing(false);
  }

  return (
    <div className={`ticket-step${enabled ? "" : " disabled-step"}`}>
      <h3><span className="step-num">3</span> Resolve</h3>
      {!enabled && <p className="help">Save triage and at least one piece of evidence to unlock this step.</p>}
      {resolution && !editing ? (
        <div className="resolution-card">
          <dl className="def-grid">
            <dt>Root cause</dt><dd>{resolution.rootCause}</dd>
            <dt>Detail</dt><dd>{resolution.detail}</dd>
            <dt>Fix</dt><dd>{resolution.fix}</dd>
            <dt>Notified</dt><dd>{resolution.notify.join(", ")}</dd>
            <dt>Message</dt><dd className="resolution-message">{resolution.communication}</dd>
          </dl>
          <button type="button" onClick={() => { setEditing(true); setMessage(""); }} disabled={readOnly}>Reopen for edit</button>
          {message && <p className="form-message success" role="status">{message}</p>}
        </div>
      ) : (
        <fieldset className="resolve-form" disabled={!enabled || readOnly}>
          <label className="field ticket-field">
            <span>Root cause</span>
            <select aria-label="Root cause" value={rootCause} onChange={(event) => setRootCause(event.target.value)}>
              <option value="">Choose the root cause</option>
              {ticket.rootCauseOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="field ticket-field">
            <span>Root cause detail</span>
            <textarea aria-label="Root cause detail" rows={3} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Which evidence proves it, in one or two sentences." />
          </label>
          <label className="field ticket-field">
            <span>Fix or recommendation</span>
            <textarea aria-label="Fix or recommendation" rows={3} value={fix} onChange={(event) => setFix(event.target.value)} placeholder="The system change (build, workflow, policy) and how you will know it worked." />
          </label>
          <div className="notify-group" role="group" aria-label="Notify">
            <span className="notify-label">Notify</span>
            <div className="check-grid">
              {ticket.notifyOptions.map((name) => (
                <label key={name} className={notify.includes(name) ? "checked" : ""}>
                  <input type="checkbox" checked={notify.includes(name)} onChange={() => toggleNotify(name)} />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="field ticket-field">
            <span>Message to requester</span>
            <textarea aria-label="Message to requester" rows={4} value={communication} onChange={(event) => setCommunication(event.target.value)} placeholder={`Hi ${ticket.requester.split(",")[0].split(" ")[0]}, here is what we found…`} />
          </label>
          <div className="button-row">
            <button type="button" className="primary" onClick={resolve}>Resolve ticket</button>
            {resolution && <button type="button" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
          {message && <p className={`form-message ${message.startsWith("Ticket resolved") ? "success" : "error"}`} role="status">{message}</p>}
        </fieldset>
      )}
      <Tip>Communicate in the requester&apos;s terms: what happened, what you changed or recommended, what they should do now, and when they will hear back.</Tip>
    </div>
  );
}
