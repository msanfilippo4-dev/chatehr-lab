/**
 * Server-only answer keys for the fixed AI draft review, AI-drafted In Basket replies,
 * and analyst tickets. Never import this file from a client component: the keys must
 * not reach the browser. Results appear only in the instructor submission view.
 */
import type { AIReviewRecord, EHRState, InBasketItem, SentenceLabel, Ticket, TicketCategory, TicketPriority } from "../types";

export interface SentenceKey { expected: SentenceLabel; accept: SentenceLabel[]; citations: string[]; why: string }

export const AI_REVIEW_KEY: Record<string, SentenceKey> = {
  D1: { expected: "Supported", accept: ["Supported"], citations: ["S1"], why: "Age 42 and sex match the identity line." },
  D2: { expected: "Contradicts source", accept: ["Contradicts source"], citations: ["S2", "S3"], why: "Right shoulder, lifting injury; the patient denies a fall." },
  D3: { expected: "Supported", accept: ["Supported"], citations: ["S3"], why: "Matches the history." },
  D4: { expected: "Supported", accept: ["Supported"], citations: ["S4"], why: "Matches the vitals." },
  D5: { expected: "Supported", accept: ["Supported"], citations: ["S5"], why: "Matches the exam (laterality omitted but not wrong)." },
  D6: { expected: "Unsupported", accept: ["Unsupported", "Contradicts source"], citations: ["S5"], why: "The neurologic exam was not performed; 'normal' is fabricated." },
  D7: { expected: "Wrong patient detail", accept: ["Wrong patient detail", "Unsupported", "Contradicts source"], citations: ["S6", "S8"], why: "Liu Huang has no diabetes and takes no metformin." },
  D8: { expected: "Supported", accept: ["Supported"], citations: ["S6"], why: "Matches the problem list." },
  D9: { expected: "Unsupported", accept: ["Unsupported", "Contradicts source"], citations: ["S9", "S10", "S7"], why: "Invented plan; amoxicillin conflicts with the penicillin allergy; no imaging or prescriptions were ordered." },
  D10: { expected: "Omission", accept: ["Omission", "Contradicts source", "Unsupported"], citations: ["S7", "S8"], why: "Omits the severe penicillin allergy and the new naproxen from urgent care." },
  D11: { expected: "Supported", accept: ["Supported"], citations: ["S9"], why: "Matches the plan." },
  D12: { expected: "Contradicts source", accept: ["Contradicts source", "Unsupported", "Wrong patient detail"], citations: ["S1"], why: "The visit used a Mandarin interpreter." },
};

export interface AIReviewScore {
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
}

export function scoreAIReview(record: AIReviewRecord): AIReviewScore | null {
  if (!record.classifications?.length) return null;
  const byId = new Map(record.classifications.map((item) => [item.sentenceId, item]));
  const planted = Object.entries(AI_REVIEW_KEY).filter(([, key]) => key.expected !== "Supported");
  const supported = Object.entries(AI_REVIEW_KEY).filter(([, key]) => key.expected === "Supported");
  let plantedFound = 0;
  let exactClass = 0;
  let citedCorrectly = 0;
  const missed: string[] = [];
  for (const [id, key] of planted) {
    const answer = byId.get(id);
    if (answer && answer.label !== "Supported") {
      plantedFound += 1;
      if (key.accept.includes(answer.label)) exactClass += 1;
      if (key.citations.includes(answer.citation)) citedCorrectly += 1;
    } else {
      missed.push(id);
    }
  }
  const falseFlagIds = supported.filter(([id]) => {
    const answer = byId.get(id);
    return answer && answer.label !== "Supported";
  }).map(([id]) => id);
  return {
    reviewedAt: record.reviewedAt,
    disposition: record.disposition,
    plantedTotal: planted.length,
    plantedFound,
    exactClass,
    citedCorrectly,
    falseFlags: falseFlagIds.length,
    unclassified: Object.keys(AI_REVIEW_KEY).filter((id) => !byId.has(id)).length,
    missed,
    falseFlagIds,
  };
}

export interface ReplyKey { safeToSendAsDrafted: boolean; expectedIssues: string[]; note: string }

export const AI_REPLY_KEY: Record<string, ReplyKey> = {
  "IB-008": { safeToSendAsDrafted: false, expectedIssues: ["Unsafe or incorrect clinical advice", "Makes a decision no clinician has made", "Missing escalation or safety-net advice"], note: "Tells a patient with K 6.1 to stop lisinopril on his own and to eat high-potassium foods; no urgent follow-up." },
  "IB-009": { safeToSendAsDrafted: false, expectedIssues: ["Wrong patient or wrong detail"], note: "Sends to CVS Broadway; the patient asked for Walgreens on Northern Blvd." },
  "IB-010": { safeToSendAsDrafted: false, expectedIssues: ["Language or reading-level mismatch", "Makes a decision no clinician has made"], note: "English reply to a Spanish message; doubles amlodipine without a clinician decision." },
  "IB-011": { safeToSendAsDrafted: true, expectedIssues: [], note: "Accurate and appropriate; sending (with or without light edits) is fine." },
};

export interface ReplyScore { itemId: string; outcome: string | undefined; safe: boolean; issuesFound: number; issuesExpected: number; note: string }

export function scoreAIReplies(items: InBasketItem[]): ReplyScore[] {
  return items
    .filter((item) => item.kind === "AI draft reply" && item.status === "Done" && AI_REPLY_KEY[item.id])
    .map((item) => {
      const key = AI_REPLY_KEY[item.id];
      const sentUnedited = item.outcome === "Send as drafted";
      const issues = item.reviewIssues ?? [];
      return {
        itemId: item.id,
        outcome: item.outcome,
        safe: key.safeToSendAsDrafted || !sentUnedited,
        issuesFound: key.expectedIssues.filter((issue) => issues.includes(issue)).length,
        issuesExpected: key.expectedIssues.length,
        note: key.note,
      };
    });
}

export interface TicketKey {
  rootCauseIndex: number;
  evidence: string[];
  categories: TicketCategory[];
  priorities: TicketPriority[];
  mustNotify: string[];
  expectedFinding: string;
}

export const TICKET_KEY: Record<string, TicketKey> = {
  "TKT-1041": { rootCauseIndex: 1, evidence: ["E1", "E2", "E3"], categories: ["Safety", "Break-fix"], priorities: ["High", "Urgent"], mustNotify: ["Pharmacy operations manager", "4 West nurse manager"], expectedFinding: "Pharmacy stocks 50 mg tablets for a 25 mg order; the scanner is right. Fix the stocking/product build, stop the override workaround, report the event." },
  "TKT-1042": { rootCauseIndex: 3, evidence: ["E1", "E2", "E3"], categories: ["Safety"], priorities: ["Urgent", "High"], mustNotify: ["Sam Brooks, NP", "Laboratory director"], expectedFinding: "Critical result routed to an out-of-office NP with no delegate; escalation rule excludes ambulatory locations; lab callback went to voicemail." },
  "TKT-1043": { rootCauseIndex: 0, evidence: ["E1", "E2", "E3"], categories: ["Safety", "Training", "Break-fix"], priorities: ["Medium", "High"], mustNotify: ["HIM record integrity"], expectedFinding: "AI scribe draft accepted without correction; no post-signature edit; author amendment required." },
  "TKT-1044": { rootCauseIndex: 2, evidence: ["E1", "E2", "E3"], categories: ["Break-fix"], priorities: ["High", "Medium"], mustNotify: ["EHR build team (orders)", "Dr. Ravi Patel"], expectedFinding: "Dr. Patel's lab favorites lack diagnosis association; fix the build, correct and resubmit the three claims." },
  "TKT-1045": { rootCauseIndex: 1, evidence: ["E1", "E2", "E3"], categories: ["Data request", "Break-fix"], priorities: ["High", "Medium"], mustNotify: ["Reporting and analytics team"], expectedFinding: "Measurement artifact: the report counts only retired row FS-1180; recalculated rate ~90%." },
  "TKT-1046": { rootCauseIndex: 3, evidence: ["E1", "E2", "E3"], categories: ["Safety"], priorities: ["Urgent", "High"], mustNotify: ["AI governance committee"], expectedFinding: "No medication-advice guardrail and no edit/attestation requirement; pause or restrict, require review, monitor." },
  "TKT-1047": { rootCauseIndex: 2, evidence: ["E1", "E2", "E3"], categories: ["Training", "Data request", "Break-fix"], priorities: ["Medium", "High"], mustNotify: ["HIM identity team"], expectedFinding: "Quick-registration duplicate; book into MRN 6105100 after verification; HIM decides any merge." },
  "TKT-1048": { rootCauseIndex: 0, evidence: ["E1", "E2", "E3"], categories: ["Enhancement"], priorities: ["Medium", "High"], mustNotify: ["Clinical decision support committee"], expectedFinding: "Alert fires on stale results; add lookback and threshold; measure override rate after change." },
  "TKT-1049": { rootCauseIndex: 1, evidence: ["E1", "E2", "E3"], categories: ["Break-fix", "Enhancement", "Safety"], priorities: ["High", "Medium"], mustNotify: ["Patient portal team", "Language access services"], expectedFinding: "English-only keyword routing; add language-based routing and an owned fallback pool." },
  "TKT-1050": { rootCauseIndex: 2, evidence: ["E1", "E2", "E3"], categories: ["Safety"], priorities: ["Urgent", "High"], mustNotify: ["Privacy officer"], expectedFinding: "Proxy scope never narrowed at age 12; confidential note must be excluded from proxy view." },
};

export interface TicketScore {
  id: string;
  subject: string;
  status: Ticket["status"];
  rootCauseCorrect: boolean | null;
  evidenceHits: number;
  evidenceExpected: number;
  distractorsCited: number;
  categoryOk: boolean | null;
  priorityOk: boolean | null;
  notifyMissing: string[];
  expectedFinding: string;
}

export function scoreTickets(tickets: Ticket[], assignment?: string): TicketScore[] {
  return tickets
    .filter((ticket) => !assignment || ticket.assignment === assignment)
    .filter((ticket) => TICKET_KEY[ticket.id])
    .map((ticket) => {
      const key = TICKET_KEY[ticket.id];
      const cited = ticket.evidence.map((item) => item.id);
      const resolved = ticket.resolution;
      return {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        rootCauseCorrect: resolved ? ticket.rootCauseOptions.indexOf(resolved.rootCause) === key.rootCauseIndex : null,
        evidenceHits: key.evidence.filter((id) => cited.includes(id)).length,
        evidenceExpected: key.evidence.length,
        distractorsCited: cited.filter((id) => !key.evidence.includes(id)).length,
        categoryOk: ticket.triage ? key.categories.includes(ticket.triage.category) : null,
        priorityOk: ticket.triage ? key.priorities.includes(ticket.triage.priority) : null,
        notifyMissing: resolved ? key.mustNotify.filter((name) => !resolved.notify.includes(name)) : key.mustNotify,
        expectedFinding: key.expectedFinding,
      };
    });
}

export interface AutoChecks {
  aiReview: AIReviewScore | null;
  aiReplies: ReplyScore[];
  tickets: TicketScore[];
}

/** Instructor-facing auto-checks for one assignment, computed from the student's workspace. */
export function buildAutoChecks(assignmentId: string, workspace: Partial<EHRState> | null): AutoChecks | null {
  if (!workspace) return null;
  const code = assignmentId.replace("FORDMS-", "");
  const tickets = scoreTickets(workspace.tickets ?? [], code);
  if (code === "A4") {
    const latest = (workspace.aiReviews ?? []).find((review) => review.classifications?.length);
    return { aiReview: latest ? scoreAIReview(latest) : null, aiReplies: scoreAIReplies(workspace.inBasket ?? []), tickets };
  }
  if (!tickets.length) return null;
  return { aiReview: null, aiReplies: [], tickets };
}
