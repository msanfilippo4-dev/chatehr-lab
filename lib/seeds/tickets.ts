/**
 * Analyst service-desk queue. Each ticket is tied to a real problem planted in the
 * chart data. The expected root cause and evidence live only in
 * lib/server/answer-keys.ts; the options below are what the learner chooses from.
 */
import type { Ticket } from "../types";

type Seed = Omit<Ticket, "status" | "evidence">;

const seeds: Seed[] = [
  {
    id: "TKT-1041",
    assignment: "A2",
    requester: "Jordan Park, RN",
    requesterRole: "Charge nurse, 4 West",
    subject: "Scanner says wrong dose for Sofia Petrov's metoprolol; night shift keeps overriding",
    body: "Every metoprolol dose for Sofia Petrov in 415-A throws a dose warning when we scan. Nights have been overriding it and splitting tablets. Is the scanner broken? I need this fixed before someone gives the wrong thing.",
    openedAt: "2026-09-21T07:05:00-04:00",
    patientId: "PT-008",
    links: [
      { label: "Open Sofia Petrov's eMAR", view: "eMAR", patientId: "PT-008", role: "Nurse" },
      { label: "Review Sofia Petrov's access and activity log", view: "Audit Review", patientId: "PT-008", role: "HIM" },
    ],
    evidenceOptions: [
      { id: "E1", label: "Active order: metoprolol tartrate 25 mg PO BID with hold parameters" },
      { id: "E2", label: "Medication drawer: only metoprolol tartrate 50 mg tablets stocked for this patient (plus a look-alike ER product)" },
      { id: "E3", label: "Administration history: three dose-mismatch overrides in 48 hours ('pharmacy sent 50 mg')" },
      { id: "E4", label: "Sofia Petrov's allergy list" },
      { id: "E5", label: "Flowsheet vitals (heart rate and blood pressure against the hold parameters)" },
    ],
    rootCauseOptions: [
      "Scanner hardware fault: the device misreads the barcode",
      "Pharmacy stocking mismatch: 50 mg tablets were loaded for a 25 mg order, so every scan correctly flags a dose mismatch and staff work around it",
      "The provider entered the order with the wrong dose",
      "Night-shift nurses need more barcode-scanning training",
    ],
    notifyOptions: ["Jordan Park, RN (requester)", "Pharmacy operations manager", "4 West nurse manager", "Dr. Ana Morales (attending)", "Patient safety event reporting", "Dana Okafor (informatics manager)"],
  },
  {
    id: "TKT-1042",
    assignment: "A2",
    requester: "Dana Okafor",
    requesterRole: "Clinical informatics manager",
    subject: "Marcus Reed's critical potassium sat in an inbox all weekend. Find out why.",
    body: "Potassium 6.1 resulted Saturday morning and nobody acted until Monday. The lab says they called. I need the root cause and a fix before this happens again. Start with the In Basket routing and who the result went to.",
    openedAt: "2026-09-21T08:12:00-04:00",
    patientId: "PT-002",
    links: [
      { label: "Open the physician In Basket (Results)", view: "In Basket", patientId: "PT-002", role: "Physician/APP" },
      { label: "Open Marcus Reed's chart", view: "Patients", patientId: "PT-002", role: "Physician/APP" },
      { label: "Review the audit log", view: "Audit Review", patientId: "PT-002", role: "HIM" },
    ],
    evidenceOptions: [
      { id: "E1", label: "In Basket item: routed to Sam Brooks, NP's personal inbox; out of office 9/18–9/21 with no delegate" },
      { id: "E2", label: "Lab comment: the critical-value phone call reached the clinic's after-hours voicemail" },
      { id: "E3", label: "Routing note: the critical-result escalation rule applies to inpatient locations only" },
      { id: "E4", label: "Marcus Reed's allergy list" },
      { id: "E5", label: "Task TASK-001 'Call patient about high potassium', due 9/22" },
    ],
    rootCauseOptions: [
      "The laboratory did not flag the result as critical",
      "Marcus Reed did not read his portal message",
      "The lab interface dropped the result",
      "The result went to an out-of-office provider's personal In Basket with no delegate, and the critical-result escalation rule excludes ambulatory locations",
    ],
    notifyOptions: ["Dana Okafor (requester)", "Sam Brooks, NP", "Dr. Lin Chen", "Laboratory director", "Ambulatory nurse manager", "Patient safety event reporting"],
  },
  {
    id: "TKT-1043",
    assignment: "A2",
    requester: "Dr. Lin Chen",
    requesterRole: "Internal medicine",
    subject: "A note under my name for Liu Huang says 'left shoulder.' Did someone change my signed note?",
    body: "The 9/14 telehealth note for Liu Huang says left shoulder. Her problem is the right shoulder and I never typed 'left.' Did someone edit my note after I signed it? I want it fixed and I want to know how it happened.",
    openedAt: "2026-09-20T18:30:00-04:00",
    patientId: "PT-001",
    links: [
      { label: "Open Liu Huang's notes", view: "Patients", patientId: "PT-001", role: "Physician/APP" },
      { label: "Review Liu Huang's audit log", view: "Audit Review", patientId: "PT-001", role: "HIM" },
    ],
    evidenceOptions: [
      { id: "E1", label: "Note NOTE-SEED-001B metadata: source 'AI scribe draft accepted', signed 9/14 at 16:05" },
      { id: "E2", label: "No edit or amendment exists after the 9/14 signature" },
      { id: "E3", label: "Earlier note NOTE-SEED-001A (8/10) documents the right shoulder" },
      { id: "E4", label: "Problem list: M75.51 bursitis of right shoulder" },
      { id: "E5", label: "Naproxen from Hudson Urgent Care in the HIE inbox" },
    ],
    rootCauseOptions: [
      "The ambient AI scribe draft contained the laterality error and was signed without correction; the signed note cannot change, so the author must add an amendment",
      "Someone edited the signed note after signature",
      "Copy-forward from another patient's note",
      "An HIE interface overwrote the note",
    ],
    notifyOptions: ["Dr. Lin Chen (requester)", "HIM record integrity", "AI scribe program lead", "Dana Okafor (informatics manager)", "Patient (Liu Huang)"],
  },
  {
    id: "TKT-1044",
    assignment: "A3",
    requester: "Tanya Williams",
    requesterRole: "Billing and coding manager",
    subject: "Three claims denied CO-16 this week; all Dr. Patel's lab orders",
    body: "We got three CO-16 denials this week (RARC M76). Every one is a lab line Dr. Patel ordered. The visit lines paid. Is this a coding problem, a build problem, or something else? I need to know before month-end close.",
    openedAt: "2026-09-18T15:45:00-04:00",
    links: [
      { label: "Open the denial work queue", view: "Billing", role: "Revenue Cycle" },
      { label: "Open the claim scrubber queue", view: "Billing", role: "Revenue Cycle" },
    ],
    evidenceOptions: [
      { id: "E1", label: "Denial queue: three CO-16 / M76 denials, all lab lines ordered by Dr. Patel" },
      { id: "E2", label: "The denied lab lines have no diagnosis pointer; the visit lines on the same claims do" },
      { id: "E3", label: "Scrubber queue: Elena Garcia's 9/14 A1c line (Dr. Patel) is also missing a pointer" },
      { id: "E4", label: "Amina Yusuf's eligibility response" },
      { id: "E5", label: "Dr. Patel's clinic schedule for the week" },
    ],
    rootCauseOptions: [
      "A payer system outage rejected the claims",
      "Coders are deleting diagnosis codes during charge review",
      "Dr. Patel's lab order favorites carry no diagnosis association, so lab charges drop to the claim without a pointer",
      "The patients' coverage had lapsed",
    ],
    notifyOptions: ["Tanya Williams (requester)", "Dr. Ravi Patel", "EHR build team (orders)", "Coding educator", "Revenue cycle director"],
  },
  {
    id: "TKT-1045",
    assignment: "A3",
    requester: "Rosa Méndez, RN",
    requesterRole: "Quality and patient safety",
    subject: "Our fall-reassessment rate dropped to 61% after the flowsheet change",
    body: "The 4 West fall-risk reassessment measure fell from 88% to 61% the week the new flowsheet went live (9/14). Leadership wants a corrective action plan for nursing. Before I send that, can you confirm the drop is real?",
    openedAt: "2026-09-19T09:20:00-04:00",
    links: [
      { label: "Open the fall-reassessment quality panel", view: "Analytics", role: "Analyst" },
      { label: "Open Sofia Petrov's flowsheet", view: "Flowsheets", patientId: "PT-008", role: "Nurse" },
    ],
    evidenceOptions: [
      { id: "E1", label: "Report definition counts only flowsheet row FS-1180" },
      { id: "E2", label: "Flowsheet build change on 9/14 moved fall reassessment to new row FS-2203" },
      { id: "E3", label: "Recalculated rate including FS-2203 is about 90%" },
      { id: "E4", label: "4 West staffing grid" },
      { id: "E5", label: "Sofia Petrov's early warning score trend" },
    ],
    rootCauseOptions: [
      "Nurses stopped reassessing fall risk after the change",
      "The report still counts only the retired row FS-1180; reassessments documented in the new row FS-2203 are missed, so the drop is a measurement artifact",
      "Patients on 4 West are now lower risk",
      "The flowsheet is not saving data",
    ],
    notifyOptions: ["Rosa Méndez, RN (requester)", "4 West nurse manager", "Reporting and analytics team", "Nursing informatics", "Chief nursing officer"],
  },
  {
    id: "TKT-1046",
    assignment: "A4",
    requester: "Dr. Ravi Patel",
    requesterRole: "Family medicine",
    subject: "AI draft replies are telling patients to stop medications",
    body: "I just caught a drafted reply telling a patient to stop his blood pressure medicine. Another one changes a dose. Some of my colleagues send these without reading closely. This needs to stop today.",
    openedAt: "2026-09-21T09:40:00-04:00",
    links: [
      { label: "Open AI-drafted replies in the In Basket", view: "In Basket", role: "Physician/APP" },
      { label: "Open the AI draft review", view: "AI Review", patientId: "PT-001", role: "Analyst" },
    ],
    evidenceOptions: [
      { id: "E1", label: "Marcus Reed's draft reply tells him to stop lisinopril and eat high-potassium foods" },
      { id: "E2", label: "Elena Garcia's draft reply changes her amlodipine dose, in English, although she wrote in Spanish" },
      { id: "E3", label: "Drafts can be sent without edits or an attestation step" },
      { id: "E4", label: "Devon Brooks' draft reply is accurate and appropriate" },
      { id: "E5", label: "Portal login counts for September" },
    ],
    rootCauseOptions: [
      "Patients are misreading replies that were correct",
      "The model needs access to more patient data",
      "One clinician's habits; a training reminder is enough",
      "The drafting tool has no guardrail against medication-change advice, and the workflow lets staff send drafts unedited without attestation",
    ],
    notifyOptions: ["Dr. Ravi Patel (requester)", "AI governance committee", "Ambulatory medical director", "Vendor / model owner", "Patient safety event reporting", "Dana Okafor (informatics manager)"],
  },
  {
    id: "TKT-1047",
    assignment: "A1",
    requester: "Maria Diaz",
    requesterRole: "Front desk lead",
    subject: "Two charts for Liu Huang; which one do I schedule into?",
    body: "Scheduling a physical therapy visit, I found 'Liu Huang' and 'Liu H.' with the same birthday. Which one do I book? Can I just merge them myself so this stops happening?",
    openedAt: "2026-09-21T08:40:00-04:00",
    patientId: "PT-001",
    links: [
      { label: "Open Liu Huang in Patients", view: "Patients", patientId: "PT-001", role: "Front Desk" },
      { label: "Open the MPI identity workbench", view: "MPI", patientId: "PT-001", role: "HIM" },
      { label: "Open the schedule", view: "Schedule", role: "Front Desk" },
    ],
    evidenceOptions: [
      { id: "E1", label: "Same date of birth and language; different phone, MRN, and address format" },
      { id: "E2", label: "Liu H. was created 9/15 by phone quick-registration for the PT referral" },
      { id: "E3", label: "HIM identity review MPI-001 status and decision" },
      { id: "E4", label: "Liu Huang's 8/10 claim" },
    ],
    rootCauseOptions: [
      "The patient has two legal identities",
      "The HIE interface created the duplicate",
      "A phone quick-registration created a second chart without a duplicate search; identity is unverified, so book into the established chart after two-identifier verification and leave any merge to HIM",
      "The charts should be merged immediately by the front desk",
    ],
    notifyOptions: ["Maria Diaz (requester)", "HIM identity team", "Physical therapy scheduling", "Registration trainer"],
  },
  {
    id: "TKT-1048",
    assignment: "GEN",
    requester: "Dr. Lin Chen",
    requesterRole: "Internal medicine",
    subject: "The potassium alert fires on every patient; I've stopped reading it",
    body: "Every time I renew lisinopril I get the high-potassium popup, even when the last potassium is normal. I click through it now without reading. Can it be fixed?",
    openedAt: "2026-09-17T12:10:00-04:00",
    links: [
      { label: "Open the alert dashboard", view: "Analytics", role: "Analyst" },
      { label: "Try an order in Orders & Results", view: "Orders & Results", patientId: "PT-002", role: "Physician/APP" },
    ],
    evidenceOptions: [
      { id: "E1", label: "Alert dashboard: potassium alert fired 412 times in 7 days; 97% overridden" },
      { id: "E2", label: "Rule ALR-K fires on any potassium ever flagged High, with no lookback window or threshold" },
      { id: "E3", label: "Most firings are for patients whose latest potassium is normal" },
      { id: "E4", label: "Penicillin allergy rule definition" },
    ],
    rootCauseOptions: [
      "The rule has no lookback window or threshold, so it fires on stale results and interrupts every prescriber",
      "Clinicians are ignoring a well-designed alert",
      "The laboratory changed potassium units",
      "Nothing is wrong; turn the alert off",
    ],
    notifyOptions: ["Dr. Lin Chen (requester)", "Clinical decision support committee", "Pharmacy informatics", "Dana Okafor (informatics manager)"],
  },
  {
    id: "TKT-1049",
    assignment: "GEN",
    requester: "Ana Torres, RN",
    requesterRole: "Clinic nurse",
    subject: "Portal messages in Spanish are going to the general pool and aging out",
    body: "I found two Spanish messages from last week that nobody owned. One is a blood pressure question. English messages get routed fine. What is going on?",
    openedAt: "2026-09-20T16:05:00-04:00",
    patientId: "PT-003",
    links: [
      { label: "Open Elena Garcia's portal messages", view: "Portal", patientId: "PT-003", role: "Nurse" },
      { label: "Open the nurse In Basket", view: "In Basket", role: "Nurse" },
    ],
    evidenceOptions: [
      { id: "E1", label: "Routing rules match English keywords only" },
      { id: "E2", label: "Elena Garcia's Spanish message (9/16) matched no rule and fell to the unowned general pool" },
      { id: "E3", label: "Carmen Rivera's Spanish message (9/17) is also unrouted" },
      { id: "E4", label: "Portal enrollment rate by clinic" },
    ],
    rootCauseOptions: [
      "Spanish-speaking patients send fewer messages",
      "Keyword routing rules are English-only; unmatched messages fall to an unowned pool with no language-based route to Spanish-speaking staff",
      "Interpreter services are closed on weekends",
      "Portal translation is broken",
    ],
    notifyOptions: ["Ana Torres, RN (requester)", "Ambulatory nurse manager", "Patient portal team", "Language access services", "Dana Okafor (informatics manager)"],
  },
  {
    id: "TKT-1050",
    assignment: "GEN",
    requester: "Keisha Grant",
    requesterRole: "HIM privacy coordinator",
    subject: "Mateo Rivera's mother can see everything in his portal. Is his confidential note exposed?",
    body: "Carmen Rivera is asking us to release Mateo's full visit note. Mateo is 14 and part of that visit was confidential. Why does her proxy access show 'full access'?",
    openedAt: "2026-09-19T10:30:00-04:00",
    patientId: "PT-009",
    links: [
      { label: "Open Mateo Rivera's chart", view: "Patients", patientId: "PT-009", role: "HIM" },
      { label: "Open Mateo's portal (proxy view)", view: "Portal", patientId: "PT-009", role: "Patient" },
    ],
    evidenceOptions: [
      { id: "E1", label: "Proxy scope for Carmen Rivera: 'Full portal access (minor)'" },
      { id: "E2", label: "Note NOTE-SEED-009B is flagged confidential (adolescent)" },
      { id: "E3", label: "Carmen's portal request asks for release of the full note" },
      { id: "E4", label: "Mateo's asthma action plan" },
    ],
    rootCauseOptions: [
      "Carmen should never have had proxy access",
      "The note was filed in the wrong chart",
      "Proxy access stayed at 'full' after Mateo turned 12; age-based proxy rules and confidential-note filtering were never applied",
      "A portal display bug",
    ],
    notifyOptions: ["Keisha Grant (requester)", "Dr. Ravi Patel", "Patient portal team", "Privacy officer", "Carmen Rivera (with a scoped explanation)"],
  },
];

export const tickets: Ticket[] = seeds.map((seed) => ({ ...seed, status: "New", evidence: [] }));

export const TICKET_CATEGORIES = ["Break-fix", "Safety", "Enhancement", "Training", "Data request"] as const;
export const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export const TICKET_OWNERS = [
  "Me (clinical informatics analyst)",
  "Pharmacy informatics",
  "EHR build team",
  "Reporting and analytics",
  "HIM",
  "Clinical decision support committee",
  "AI governance committee",
] as const;

/** Progress context for a ticket: "A2:TKT-1041". Assignments match on the prefix. */
export function ticketContext(ticket: Pick<Ticket, "assignment" | "id">): string {
  return `${ticket.assignment}:${ticket.id}`;
}
