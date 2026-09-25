"use client";

import { useEffect, useMemo, useState } from "react";
import { NavLink } from "@/components/ui/NavLink";
import { KpiRow, PageHeader, Segmented, SimulationBadge, Status, Tip, type Tone } from "@/components/ui/primitives";
import { claimTotal, DENIAL_ACTIONS, DENIAL_REFERENCE, denialActionProblem, formatMoney, scrubClaim, type ScrubEdit } from "@/lib/clinical/billing";
import { claimFixes } from "@/lib/seeds/billing";
import type { Claim, EHRState } from "@/lib/types";
import { formatWhen, type ViewProps } from "./shared";

type Queue = "review" | "denials" | "submitted";

const QUEUE_STATUSES: Record<Queue, Claim["status"][]> = {
  review: ["Charge review", "Ready to submit"],
  denials: ["Denied"],
  submitted: ["Submitted", "Denial worked"],
};

function statusTone(status: Claim["status"]): Tone {
  if (status === "Denied") return "danger";
  if (status === "Submitted" || status === "Denial worked") return "good";
  if (status === "Ready to submit") return "info";
  return "warn";
}

function patientName(state: EHRState, id: string) {
  return state.patients.find((patient) => patient.id === id)?.name ?? id;
}

function denialCode(claim: Claim) {
  return claim.denial ? `${claim.denial.group}-${claim.denial.carc}` : "";
}

export function Billing(props: ViewProps) {
  const { state } = props;
  const [queue, setQueue] = useState<Queue>("review");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const inQueue = (q: Queue) => state.claims.filter((claim) => QUEUE_STATUSES[q].includes(claim.status));
  const list = inQueue(queue);
  const selected = state.claims.find((claim) => claim.id === selectedId && QUEUE_STATUSES[queue].includes(claim.status))
    ?? state.claims.find((claim) => claim.id === selectedId)
    ?? list[0]
    ?? null;

  // Pin the shown claim so it stays on screen (with its confirmation) after it changes queue.
  useEffect(() => {
    if (selected && selectedId !== selected.id) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const review = inQueue("review");
  const denials = inQueue("denials");
  const editCount = review.reduce((sum, claim) => sum + scrubClaim(claim).length, 0);
  const atRisk = review.filter((claim) => scrubClaim(claim).length).reduce((sum, claim) => sum + claimTotal(claim), 0)
    + denials.reduce((sum, claim) => sum + (claim.denial?.amount ?? 0), 0);

  return (
    <div className="billing">
      <PageHeader
        eyebrow="Revenue cycle"
        title="Billing & claims"
        subtitle="Review charges from completed encounters, clear scrubber edits at the source, submit clean claims, and work denials."
        actions={<SimulationBadge />}
      />
      <KpiRow
        items={[
          { label: "Claims in charge review", value: review.length, note: "Completed encounters" },
          { label: "Scrubber edits found", value: editCount, tone: editCount ? "warn" : "good", note: "Across charge review" },
          { label: "Denials open", value: denials.length, tone: denials.length ? "danger" : "good", note: "835 remittances this week" },
          { label: "Dollars at risk", value: formatMoney(atRisk), tone: atRisk ? "danger" : "good", note: "Held claims + open denials" },
        ]}
      />
      <div className="billing-toolbar">
        <Segmented
          label="Work queue"
          value={queue}
          onChange={(value) => { setQueue(value); setSelectedId(null); }}
          options={[
            { value: "review", label: "Charge review", count: review.length },
            { value: "denials", label: "Denials", count: denials.length },
            { value: "submitted", label: "Submitted", count: inQueue("submitted").length },
          ]}
        />
      </div>
      <div className="split list-detail">
        <section className="card billing-list" aria-label="Claims">
          {list.length ? (
            <ul className="queue">
              {list.map((claim) => (
                <li key={claim.id}>
                  <ClaimQueueItem claim={claim} name={patientName(state, claim.patientId)} selected={selected?.id === claim.id} onSelect={() => setSelectedId(claim.id)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty billing-empty">No claims in this queue.</p>
          )}
          {queue === "denials" && <DenialsByProvider claims={denials} />}
        </section>
        <section className="card billing-detail" aria-label="Selected claim">
          {selected ? <ClaimDetail key={selected.id} claim={selected} {...props} /> : <p className="empty">Select a claim.</p>}
        </section>
      </div>
    </div>
  );
}

function ClaimQueueItem({ claim, name, selected, onSelect }: { claim: Claim; name: string; selected: boolean; onSelect: () => void }) {
  const edits = claim.status === "Charge review" && claim.scrubbedAt ? scrubClaim(claim).length : null;
  return (
    <button type="button" className={`queue-item${selected ? " selected" : ""}`} onClick={onSelect} aria-current={selected ? "true" : undefined}>
      <span className="queue-top">
        <strong>{name} — {claim.id}</strong>
        <span className="queue-meta">{formatMoney(claim.denial?.amount ?? claimTotal(claim))}</span>
      </span>
      <span className="queue-meta">DOS {claim.dos} · {claim.payer}</span>
      <span className="queue-tags">
        <Status tone={statusTone(claim.status)}>{claim.status}</Status>
        {claim.denial && claim.status === "Denied" && <Status tone="danger">{denialCode(claim)}</Status>}
        {edits !== null && <Status tone={edits ? "warn" : "good"}>{edits ? `${edits} edit${edits > 1 ? "s" : ""}` : "Clean"}</Status>}
      </span>
    </button>
  );
}

function DenialsByProvider({ claims }: { claims: Claim[] }) {
  const counts = new Map<string, number>();
  for (const claim of claims) {
    const providers = new Set(claim.lines.filter((line) => !line.dxPointers.length || claim.denial?.carc !== "16").map((line) => line.orderingProvider ?? claim.provider));
    for (const provider of providers) counts.set(provider, (counts.get(provider) ?? 0) + 1);
  }
  if (!counts.size) return null;
  return (
    <div className="denial-summary">
      <h3>Denials this week by ordering provider</h3>
      <ul>
        {[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([provider, count]) => (
          <li key={provider}><span>{provider}</span><strong>{count}</strong></li>
        ))}
      </ul>
    </div>
  );
}

function ClaimDetail({ claim, state, dispatch, navigate, readOnly }: { claim: Claim } & ViewProps) {
  const name = patientName(state, claim.patientId);
  const edits = scrubClaim(claim);
  const showEdits = claim.status === "Charge review" && Boolean(claim.scrubbedAt);
  const flaggedLines = new Set(showEdits ? edits.map((edit) => edit.line).filter(Boolean) : []);
  const deniedWithoutPointer = claim.status === "Denied" && claim.denial?.carc === "16";

  return (
    <div className="claim">
      <header className="claim-head">
        <div>
          <h2 className="pane-title">Claim #{claim.id} · {name} · DOS {claim.dos}</h2>
          <p className="pane-sub">{claim.history.at(-1)?.change}</p>
        </div>
        <Status tone={statusTone(claim.status)}>{claim.status}</Status>
      </header>
      <dl className="def-grid claim-facts">
        <dt>Payer</dt><dd>{claim.payer}</dd>
        <dt>Member ID</dt><dd>{claim.memberId} · eligibility {claim.eligibility.toLowerCase()}</dd>
        <dt>Rendering provider</dt><dd>{claim.provider}</dd>
        <dt>Department</dt><dd>{claim.department}</dd>
        {claim.requiresReferral && (<><dt>Referral</dt><dd>{claim.referralNumber ?? "Required, not attached"}</dd></>)}
        {claim.requiresPriorAuth && (<><dt>Prior authorization</dt><dd>{claim.priorAuthNumber ?? "Required, none on file"}</dd></>)}
      </dl>
      <NavLink target={{ view: "Patients", patient: claim.patientId }} navigate={navigate} icon="chart">Open {name}&apos;s chart</NavLink>
      <h3 className="claim-section">Diagnoses</h3>
      <ul className="dx-list">
        {claim.diagnoses.map((dx) => <li key={dx.code}><strong>{dx.code}</strong> {dx.display}</li>)}
      </ul>
      <LineTable claim={claim} flagged={flaggedLines} highlightMissing={deniedWithoutPointer} />
      {claim.status === "Charge review" && <ScrubberPanel claim={claim} edits={edits} dispatch={dispatch} readOnly={readOnly} />}
      {claim.status === "Denied" && <DenialPanel claim={claim} dispatch={dispatch} readOnly={readOnly} />}
      {(claim.status === "Submitted" || claim.status === "Denial worked") && <HistoryPanel claim={claim} />}
    </div>
  );
}

function LineTable({ claim, flagged, highlightMissing }: { claim: Claim; flagged: Set<number | undefined>; highlightMissing: boolean }) {
  return (
    <div className="grid-table-wrap claim-lines">
      <table className="claim-table">
        <caption className="sr-only">Claim lines</caption>
        <thead>
          <tr><th>Line</th><th>CPT / HCPCS</th><th>Description</th><th>Mod</th><th>ICD-10-CM pointer</th><th className="num">Charge</th></tr>
        </thead>
        <tbody>
          {claim.lines.map((line) => {
            const missing = !line.dxPointers.length;
            const highlight = flagged.has(line.line) || (highlightMissing && missing);
            return (
              <tr key={line.line} className={highlight ? "highlight" : ""}>
                <td>{line.line}</td>
                <td><strong>{line.cpt}</strong></td>
                <td>{line.description}{line.orderingProvider && <small>Ordered by {line.orderingProvider}</small>}</td>
                <td>{line.modifiers.join(", ") || "—"}</td>
                <td className={missing ? "abnormal" : ""}>{missing ? "— none —" : line.dxPointers.join(", ")}</td>
                <td className="num">{formatMoney(line.charge * line.units)}</td>
              </tr>
            );
          })}
          <tr className="total-row"><td colSpan={5}>Total</td><td className="num">{formatMoney(claimTotal(claim))}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function ScrubberPanel({ claim, edits, dispatch, readOnly }: { claim: Claim; edits: ScrubEdit[] } & Pick<ViewProps, "dispatch" | "readOnly">) {
  const scrubbed = Boolean(claim.scrubbedAt);
  const clean = scrubbed && edits.length === 0;

  function runScrubber() {
    const summary = edits.length ? edits.map((edit) => edit.rule.toLowerCase().replace(/_/g, " ")).join("; ") : "no edits";
    dispatch({ type: "scrubClaim", claimId: claim.id, editCount: edits.length, summary });
  }

  return (
    <section className="scrubber" aria-label="Claim scrubber">
      <div className="scrubber-head">
        <h3 className="claim-section">Scrubber edits</h3>
        <button type="button" onClick={runScrubber} disabled={readOnly}>Run scrubber</button>
      </div>
      {!scrubbed && <p className="help">Run the scrubber to check this claim against payer rules before it goes out.</p>}
      {scrubbed && edits.map((edit, index) => (
        <EditRow key={`${edit.rule}-${edit.line ?? index}`} claim={claim} edit={edit} dispatch={dispatch} readOnly={readOnly} />
      ))}
      {clean && <p className="edit-row ok">No scrubber edits. Ready to submit.</p>}
      <div className="button-row">
        <button type="button" className="primary" disabled={!clean || readOnly} onClick={() => dispatch({ type: "submitClaim", claimId: claim.id })}>Submit claim</button>
      </div>
      <Tip>Fix the cause, not just the claim. When the same edit keeps appearing for one provider or order, the fix belongs in the build (order favorites, required fields), with the scrubber as the safety net.</Tip>
    </section>
  );
}

function EditRow({ claim, edit, dispatch, readOnly }: { claim: Claim; edit: ScrubEdit } & Pick<ViewProps, "dispatch" | "readOnly">) {
  const [pointer, setPointer] = useState(claim.diagnoses[0]?.code ?? "");
  const fix = claimFixes[claim.id];
  const correct = (changes: Partial<Claim>, description: string) => dispatch({ type: "correctClaim", claimId: claim.id, changes, description });
  const line = claim.lines.find((row) => row.line === edit.line);

  return (
    <div className={`edit-row ${edit.severity === "Error" ? "error" : "warning"}`}>
      <div>
        <strong>{edit.message}</strong>
        <small>{edit.fix}</small>
      </div>
      <div className="edit-fix">
        {edit.rule === "MISSING_DX_POINTER" && line && (
          <>
            <select aria-label={`Diagnosis pointer for line ${line.line}`} value={pointer} onChange={(event) => setPointer(event.target.value)} disabled={readOnly}>
              {claim.diagnoses.map((dx) => <option key={dx.code} value={dx.code}>{dx.code} · {dx.display}</option>)}
            </select>
            <button
              type="button"
              disabled={readOnly || !pointer}
              onClick={() => correct(
                { lines: claim.lines.map((row) => (row.line === line.line ? { ...row, dxPointers: [pointer] } : row)) },
                `Pointed line ${line.line} (${line.cpt}) to ${pointer}`,
              )}
            >
              Apply fix
            </button>
          </>
        )}
        {edit.rule === "MOD25_DOCUMENTATION" && (
          <>
            <button type="button" disabled={readOnly} onClick={() => correct({ separateEmDocumented: true }, `Linked documentation for modifier 25: ${fix?.documentation ?? "note documents a separate problem"}`)}>Link documentation</button>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => correct(
                { lines: claim.lines.map((row) => (row.line === edit.line ? { ...row, modifiers: row.modifiers.filter((mod) => mod !== "25") } : row)) },
                `Removed modifier 25 from line ${edit.line}`,
              )}
            >
              Remove modifier 25
            </button>
          </>
        )}
        {edit.rule === "ELIGIBILITY_INACTIVE" && (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => correct(
              { eligibility: "Active", memberId: fix?.eligibility?.memberId ?? claim.memberId },
              `Re-verified eligibility: active, member ID ${fix?.eligibility?.memberId ?? claim.memberId}. ${fix?.eligibility?.note ?? ""}`.trim(),
            )}
          >
            Re-verify eligibility
          </button>
        )}
        {edit.rule === "REFERRAL_MISSING" && (
          <button type="button" disabled={readOnly} onClick={() => correct({ referralNumber: fix?.referralNumber ?? "REF-ON-FILE" }, `Attached referral ${fix?.referralNumber ?? "REF-ON-FILE"}`)}>Attach referral</button>
        )}
        {edit.rule === "PRIOR_AUTH_MISSING" && <span className="help">Hold the claim and request authorization.</span>}
      </div>
    </div>
  );
}

function DenialPanel({ claim, dispatch, readOnly }: { claim: Claim } & Pick<ViewProps, "dispatch" | "readOnly">) {
  const denial = claim.denial!;
  const code = denialCode(claim);
  const reference = DENIAL_REFERENCE[code];
  const [action, setAction] = useState<string>(DENIAL_ACTIONS[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const orderers = useMemo(() => [...new Set(claim.lines.filter((line) => line.orderingProvider).map((line) => line.orderingProvider))], [claim.lines]);

  function work() {
    const problem = denialActionProblem(denial.group, action);
    if (problem) { setError(problem); return; }
    if (note.trim().length < 20) { setError("Write a denial note (20+ characters) that says what you found and what you changed."); return; }
    setError("");
    dispatch({ type: "workDenial", claimId: claim.id, action, note: note.trim() });
  }

  return (
    <section className="denial" aria-label="Denial">
      <div className="card denial-card">
        <div className="denial-top">
          <span className="chip-pill danger denial-code">{code}</span>
          {denial.rarc && <span className="chip-pill neutral">RARC {denial.rarc}</span>}
          <span className="denial-amount">{formatMoney(denial.amount)} denied {denial.deniedAt}</span>
        </div>
        {reference && <h3>{reference.title}</h3>}
        <p>{denial.plain}</p>
        {reference && (
          <dl className="def-grid">
            <dt>In plain language</dt><dd>{reference.plain}</dd>
            <dt>Typical fix</dt><dd>{reference.typicalFix}</dd>
          </dl>
        )}
        {orderers.length > 0 && <p className="help">Ordering provider on the denied lines: <strong>{orderers.join(", ")}</strong></p>}
      </div>
      <div className="form-stack denial-form">
        <label>
          Action
          <select aria-label="Denial action" value={action} onChange={(event) => setAction(event.target.value)} disabled={readOnly}>
            {DENIAL_ACTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          Note
          <textarea aria-label="Denial note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was missing, what you corrected, and what prevents the next denial." disabled={readOnly} />
        </label>
        <div className="button-row">
          <button type="button" className="primary" onClick={work} disabled={readOnly}>Work denial</button>
        </div>
        {error && <p className="form-message error" role="alert">{error}</p>}
      </div>
    </section>
  );
}

function HistoryPanel({ claim }: { claim: Claim }) {
  return (
    <section aria-label="Claim history">
      {claim.denialWork && (
        <p className="form-message success" role="status">Denial worked: {claim.denialWork.action}. {claim.denialWork.note}</p>
      )}
      {claim.status === "Submitted" && <p className="form-message success" role="status">Submitted to {claim.payer} (simulated 837P).</p>}
      <h3 className="claim-section">History</h3>
      <ol className="claim-history">
        {claim.history.map((entry, index) => (
          <li key={index}><span>{formatWhen(entry.at)}</span>{entry.change}</li>
        ))}
      </ol>
    </section>
  );
}
