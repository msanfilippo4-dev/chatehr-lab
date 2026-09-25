# FordMS v5 clinical revamp: specification

Goal: make FordMS a more robust, realistic, modern practice EHR in which students work as the
**clinical informatics analyst at Fordham Health** who oversees the EHR and collaborates with
nurses, physicians, scheduling/registration, HIM, billing, and administrators. Exercises must be
crystal clear and take 1–2 hours each.

The course cast (use everywhere): patients Liu Huang (PT-001, MRN 6105100) and possible
duplicate "Liu H." (PT-012, MRN 6105111); Marcus Reed (PT-002, 57, HTN on lisinopril, potassium
high); Elena Garcia (PT-003, Spanish, home BP readings); Amina Yusuf (PT-004); James O'Brien
(PT-005, 67, T2DM/HTN/CKD 3a, penicillin allergy); Priya Shah (PT-006, proxy daughter); Devon
Brooks (PT-007, they/them); Sofia Petrov (PT-008, 78, Russian, inpatient 4 West, pneumonia);
Mateo Rivera (PT-009, 14, proxy Carmen Rivera); Grace Kim (PT-010); Noah Williams (PT-011).
Staff: Dr. Lin Chen (internal medicine), Dr. Ravi Patel (family medicine), Sam Brooks NP, Jordan
Park RN (4 West charge nurse), Maria Diaz (front desk lead), Tanya Williams (billing and coding
manager), Dana Okafor (clinical informatics manager; the student's boss).

## Hard constraints (live course)

- Students are mid-way through A1 (due Oct 11). Their workspaces are saved server-side as JSONB.
  **Never break an existing workspace**: bump the state version (3 → 4) with a non-destructive
  migration that adds new slices from seed and leaves existing data, audit events, and IDs intact.
  Existing patient IDs, MRNs, names, DOBs, and the PT-001/PT-012 duplicate signals stay the same.
  Check `lib/server/assignment-benchmarks.ts` and any tests before changing A1-related data.
- `ACTION` string values are a wire format: append new ones only; never rename existing ones.
- Assignment IDs, due dates, weights, and A1 requirements stay the same. A2–A4 may be restructured
  (none has meaningful student work yet), but keep existing requirement actions where sensible.
- The instructor has published course config versions (`ehr_config_versions`, v13+) that override
  `lib/config/defaults.ts` (e.g. `simulatedRoles[].views`). New views must still appear for
  students: merge new defaults into loaded configs (e.g. union of views per role) or bump a config
  schema version with a migration; document what the instructor must do, if anything.
- Quiz module files were just rebuilt by another agent (lib/server/quizzes.ts, app/api/quizzes/*,
  components/views/Quizzes.tsx, Gradebook quizzes tab, migration 012). Do not change their logic.
- No deploys, pushes, or database migrations applied. New SQL, if any, goes in a numbered
  migration file (next free number after 013) with a down file, and must degrade gracefully.

## 1. Realistic data (lib/seed.ts)

Replace formula-generated charts with hand-authored, clinically coherent charts for all 12
patients (keep identity fields as above; realistic NYC addresses except where A1 depends on the
existing ones; realistic payers such as NY Medicaid managed care, Medicare, commercial PPO/HMO):
problems with ICD-10-CM codes, medication lists with doses/routes/frequencies, allergies with
type (allergy vs intolerance), reaction, severity, vitals series (3–6 dates), labs with units,
reference ranges, flags, and LOINC codes, one or two prior signed notes, care team, PCP,
encounters (ambulatory; inpatient for Sofia Petrov and one other). Make each chart tell a story
used by the course (Marcus's potassium; James's CHF/CKD med complexity; Elena's BP messages;
Mateo's proxy/confidential adolescent note; Devon's pronouns/name; Priya's interpreter needs).

## 2. New views (each with realistic UI and audit events)

1. **eMAR with barcode scanning** (nurse): MAR grid by scheduled time for inpatients; "Scan
   wristband" (choose from a list that includes the wrong patient) and "Scan medication" (choose
   from the med drawer, including a wrong-dose and a look-alike drug); five-rights check with
   clear warnings; administer, hold (with reason), or override (reason required); PRN with pain
   score; late administration flag. New actions: `MAR scan`, `Administer medication`,
   `Hold medication`, `Override MAR warning`.
2. **Flowsheets** (nurse): vitals, pain, I&O, early warning score (simplified NEWS2) computed
   live; documenting a deteriorating set triggers a sepsis screen / rapid-response task.
   Action: `Document flowsheet`.
3. **In Basket** (physician/APP and nurse pools): unified queue of results to acknowledge,
   patient medical advice requests, refill requests, co-sign requests, and AI-drafted replies
   that must be reviewed (edit/send/discard). Reuse existing messages/orders/tasks where possible.
   Actions: `Complete in-basket item`, `Review AI draft reply`.
4. **Billing & claims** (new simulated role "Revenue Cycle"): charge review for completed
   encounters, claim scrubber edits (missing diagnosis pointer, modifier 25 documentation,
   inactive eligibility, referral missing), fix and submit, denial work queue with plain-language
   reason codes (e.g. CO-16 missing information, CO-197 no prior authorization), appeal note.
   Actions: `Scrub claim`, `Correct claim`, `Submit claim`, `Work denial`.
5. **Analyst Tickets** (Analyst role): a service-desk queue of 8–10 tickets from named staff,
   each tied to a real problem in the chart data, e.g.:
   - Jordan Park RN: "Scanner says wrong dose for Sofia Petrov's metoprolol; night shift keeps overriding."
   - Dr. Chen: "The potassium alert fires on every patient; I've stopped reading it."
   - Maria Diaz: "Two charts for Liu Huang; which one do I schedule into?" (A1 link)
   - Tanya Williams: "Three claims denied CO-16 this week; all Dr. Patel's lab orders."
   - Dana Okafor: "Marcus Reed's critical potassium sat in an inbox all weekend. Find out why."
   - Clinic RN: "Portal messages in Spanish are going to the general pool and aging out."
   - Quality: "Our fall-reassessment rate dropped to 61% after the flowsheet change."
   - Dr. Patel: "AI draft replies are telling patients to stop medications."
   Student workflow: triage (category: break-fix / safety / enhancement / training / data
   request; priority; owner), investigate (open linked chart/view/audit evidence; record which
   evidence they used), resolve (root cause, fix or recommendation, who to notify, communication
   note to the requester). Actions: `Triage ticket`, `Resolve ticket` (context = ticket id).

## 3. Assignments (lib/assignments.ts): clear, 1–2 hours, analyst framing

Rewrite every assignment with: a one-paragraph "Your situation" in the analyst voice, a numbered
step-by-step guide that names the exact patient, view, and button, what they should see after each
step ("You should see…"), time estimates per part, an "Analyst tip" per part, the submission prompt,
and the rubric. Show this guide in-app (Assignments view) as a checklist that ticks off as the
audit evidence arrives, with deep links ("Open Liu Huang in MPI").

- **A1 (released; due Oct 11): Identity, access, scheduling, and coding.** Keep requirements; only
  improve the text/guide and deep links. Frame it around Maria Diaz's ticket.
- **A2 (due Nov 1): Closing clinical loops.** Tickets from Dana Okafor (Marcus Reed potassium),
  Jordan Park (Sofia Petrov MAR scan), Dr. Chen (note integrity). Requirements: signed SOAP note,
  amendment, two orders with warning handled, result acknowledged with accountable follow-up,
  portal message routed, one eMAR scan with administer or justified hold, two tickets resolved.
- **A3 (due Nov 22): Exchange, analytics, and revenue integrity.** Reconcile two external items,
  run two queries and validate one, correct and submit one claim from the scrubber, work one
  denial, resolve the Tanya Williams ticket and the quality-report ticket.
- **A4 (due Dec 6): AI safety review and go-live readiness.** Fixed AI review (below), review
  and send or discard two AI-drafted in-basket replies, update three readiness domains, record the
  go-live recommendation, resolve Dr. Patel's AI ticket.

Update rubrics to match (keep 100 points). Keep `requirements` machine-checkable via actions and
contexts. Update `lib/server/assignment-benchmarks.ts` and progress tests accordingly.

## 4. Fix the AI Review exercise

Today it shows the six error findings as a pre-labeled checklist (students can tick the answers).
Replace with: the source encounter evidence on the left, the AI draft on the right split into
numbered sentences; the student clicks a sentence to classify it (supported / unsupported /
contradicts source / wrong patient-detail / omission noted) and cites the source line; hidden
answer key used only server-side or in the instructor submission view to show accuracy
(found X of Y planted errors, false flags). Record `AI draft review` when they finish.

## 5. Navigation, routing, and UI refresh

- URL state per view and patient (`/?view=emar&patient=PT-008` or path routes); back/forward
  work; assignment steps deep-link into views.
- Group navigation by area in a left rail (Clinical, Front office, HIM, Revenue cycle, Analytics,
  Informatics) with role-based visibility; keep the role switcher; add Nurse and Physician/APP as
  simulated roles if it helps (map old "Clinical" to both for existing configs).
- Modern visual refresh consistent with the course slides (see v5/content/visuals/ehr.ts for the
  target look: dark top bar, patient banner with allergy/code-status/flag chips, activity
  sidebar, cards, tables with status pills). Improve spacing, typography, focus states, empty
  states, responsive layout. Break the huge one-line JSX components into readable components.
- Keep accessibility (skip link, labels, aria-live) and printing.

## 6. Tests and screenshots

- Unit tests for the state migration (v3 workspace → v4 without loss), new reducers, EWS
  calculation, five-rights logic, claim scrubber rules, ticket progress, AI review scoring.
- E2E happy paths: A1 (unchanged), A2, A3, A4, eMAR scanning, tickets.
- Update `scripts/capture_screens.mjs` to write refreshed screenshots to `../assets/screens`
  (keep the existing 20 filenames for the same views so slides update automatically) plus new
  ones: `21-emar-barcode-scan.png`, `22-flowsheet-ews.png`, `23-in-basket.png`,
  `24-claim-scrubber.png`, `25-denial-queue.png`, `26-analyst-tickets.png`,
  `27-ticket-resolution.png`, `28-ai-review-sentence-classification.png`.
- Run typecheck, unit tests, `next build`, e2e (chromium) and report honestly.
