"use client";

import { Panel, Status } from "@/components/ui/primitives";

/** Shape returned by /api/instructor/submissions (computed server-side from the answer keys). */
export interface AutoChecksPayload {
  aiReview: {
    reviewedAt: string;
    disposition: string;
    plantedTotal: number;
    plantedFound: number;
    exactClass: number;
    citedCorrectly: number;
    falseFlags: number;
    unclassified: number;
    missed: string[];
    falseFlagIds: string[];
  } | null;
  aiReplies: { itemId: string; outcome?: string; safe: boolean; issuesFound: number; issuesExpected: number; note: string }[];
  tickets: {
    id: string;
    subject: string;
    status: string;
    rootCauseCorrect: boolean | null;
    evidenceHits: number;
    evidenceExpected: number;
    distractorsCited: number;
    categoryOk: boolean | null;
    priorityOk: boolean | null;
    notifyMissing: string[];
    expectedFinding: string;
  }[];
}

function yesNo(value: boolean | null, yes = "Yes", no = "No") {
  if (value === null) return <Status tone="neutral">—</Status>;
  return <Status tone={value ? "good" : "danger"}>{value ? yes : no}</Status>;
}

/** Instructor-only accuracy view for the AI review, AI replies, and tickets. Never shown to students. */
export function AutoChecks({ checks }: { checks: AutoChecksPayload | null | undefined }) {
  if (!checks || (!checks.aiReview && !checks.aiReplies.length && !checks.tickets.length)) return null;
  return (
    <Panel title="Auto-checks against the answer key" subtitle="Computed on the server from the student's current workspace; students never see the key">
      <div className="autochecks">
        {checks.aiReview && (
          <section>
            <h3>AI draft review (sentence level)</h3>
            <p>
              Found <strong>{checks.aiReview.plantedFound} of {checks.aiReview.plantedTotal}</strong> planted errors ·
              {" "}{checks.aiReview.exactClass} classified correctly · {checks.aiReview.citedCorrectly} cited the right source line ·
              {" "}<strong>{checks.aiReview.falseFlags}</strong> false flag(s){checks.aiReview.falseFlagIds.length ? ` (${checks.aiReview.falseFlagIds.join(", ")})` : ""}
              {checks.aiReview.unclassified ? ` · ${checks.aiReview.unclassified} unclassified` : ""}.
            </p>
            {checks.aiReview.missed.length > 0 && <p className="help">Missed: {checks.aiReview.missed.join(", ")}. Disposition: {checks.aiReview.disposition}.</p>}
          </section>
        )}
        {checks.aiReplies.length > 0 && (
          <section>
            <h3>AI-drafted In Basket replies</h3>
            <table>
              <thead><tr><th>Item</th><th>Decision</th><th>Safe</th><th>Issues named</th><th>Key</th></tr></thead>
              <tbody>
                {checks.aiReplies.map((reply) => (
                  <tr key={reply.itemId}>
                    <td>{reply.itemId}</td>
                    <td>{reply.outcome ?? "—"}</td>
                    <td>{yesNo(reply.safe, "Safe", "Unsafe send")}</td>
                    <td>{reply.issuesFound}/{reply.issuesExpected}</td>
                    <td><small>{reply.note}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {checks.tickets.length > 0 && (
          <section>
            <h3>Analyst tickets</h3>
            <table>
              <thead><tr><th>Ticket</th><th>Status</th><th>Root cause</th><th>Evidence</th><th>Triage</th><th>Notify missing</th><th>Expected finding</th></tr></thead>
              <tbody>
                {checks.tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td><strong>{ticket.id}</strong><small>{ticket.subject}</small></td>
                    <td>{ticket.status}</td>
                    <td>{yesNo(ticket.rootCauseCorrect, "Correct", "Incorrect")}</td>
                    <td>{ticket.evidenceHits}/{ticket.evidenceExpected}{ticket.distractorsCited ? <small>{ticket.distractorsCited} distractor(s)</small> : null}</td>
                    <td>{yesNo(ticket.categoryOk, "Category ok", "Category off")} {yesNo(ticket.priorityOk, "Priority ok", "Priority off")}</td>
                    <td><small>{ticket.notifyMissing.join(", ") || "—"}</small></td>
                    <td><small>{ticket.expectedFinding}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </Panel>
  );
}
