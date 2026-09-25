import { ACTION } from "./actions";
import type { CourseAssignment } from "./config/types";

export type { CourseAssignment } from "./config/types";
export type { AssignmentRequirement } from "./progress";

/**
 * Default FordMS assignment definitions (content revision 5).
 *
 * The learner is the clinical informatics analyst at Fordham Health, reporting to
 * Dana Okafor. Each assignment carries an in-app guide (parts → steps with deep links,
 * "You should see…" confirmations, and analyst tips). Guide steps with a `check`
 * tick off as matching audit evidence arrives.
 *
 * Constraints (live course): assignment ids, due dates, and weights are fixed, and the
 * FORDMS-A1 requirements are unchanged because students are mid-way through A1.
 */
export const defaultAssignments: CourseAssignment[] = [
  {
    id: "FORDMS-A1",
    contentRevision: 5,
    title: "Identity, access, scheduling, and coding",
    shortTitle: "Identity and access",
    estimatedMinutes: 90,
    dueAt: "2026-10-11T23:59:00-04:00",
    dueLabel: "Sunday, October 11, 2026 at 11:59 p.m. ET",
    weightPercent: 4.5,
    weekIntroduced: 3,
    releaseState: "released",
    scenario: "Maria Diaz, the front desk lead, found two charts for Liu Huang while booking a physical therapy visit (ticket TKT-1047). As the clinical informatics analyst, you protect identity integrity, route the duplicate to HIM, complete the scheduling workflow without creating a conflict, and show the difference between diagnosis and service codes.",
    objectives: [
      "Use multiple identifiers before acting on a chart.",
      "Document an MPI decision without making an unsafe merge.",
      "Create and reschedule an appointment while preserving workflow history.",
      "Distinguish ICD-10-CM diagnoses from CPT services.",
    ],
    workflow: [
      "Open Liu Huang's chart as Front Desk and send the possible duplicate to the HIM identity queue.",
      "Switch to HIM, compare the two records in the MPI workbench, and record a decision with reasoning.",
      "Switch to Front Desk, test the conflict rule, create a valid visit, then reschedule it.",
      "In Liu Huang's Coding tab, record one ICD-10-CM example and one CPT example.",
      "Review the evidence checklist and submit your written analysis.",
    ],
    requirements: [
      { action: ACTION.OPEN_CHART, label: "Open and verify a patient chart", minimumCount: 1 },
      { action: ACTION.ESCALATE_IDENTITY_REVIEW, label: "Send a possible duplicate to the HIM queue", minimumCount: 1 },
      { action: ACTION.RESOLVE_IDENTITY_REVIEW, label: "Record an MPI decision with reasoning", minimumCount: 1 },
      { action: ACTION.CREATE_APPOINTMENT, label: "Create a valid appointment", minimumCount: 1 },
      { action: ACTION.RESCHEDULE_APPOINTMENT, label: "Reschedule while preserving the appointment record", minimumCount: 1 },
      { action: ACTION.USE_CODE_EXAMPLE, label: "Record an ICD-10-CM diagnosis example", minimumCount: 1, contextMatch: "ICD-10-CM" },
      { action: ACTION.USE_CODE_EXAMPLE, label: "Record a CPT service example", minimumCount: 1, contextMatch: "CPT" },
    ],
    submissionPrompt: "In 150–250 words, explain which identity evidence drove your MPI decision, how you resolved the scheduling conflict, and why the two selected codes represent different code systems.",
    rubric: [
      { criterion: "Patient identity and MPI reasoning", points: 30, standard: "Uses several identifiers, recognizes uncertainty, and records a safe next step." },
      { criterion: "Scheduling and access workflow", points: 25, standard: "Creates and reschedules accurately and responds appropriately to conflict detection." },
      { criterion: "Coding distinction", points: 20, standard: "Selects and correctly distinguishes ICD-10-CM and CPT examples." },
      { criterion: "Audit evidence", points: 15, standard: "Required actions are complete, attributable, and internally consistent." },
      { criterion: "Written analysis", points: 10, standard: "Explains decisions clearly and acknowledges limits." },
    ],
    guide: {
      situation: "You are the clinical informatics analyst at Fordham Health; your manager is Dana Okafor. Monday, 9:40 a.m.: Maria Diaz, the front desk lead, opened ticket TKT-1047. While booking a physical therapy visit she found two charts, \"Liu Huang\" and \"Liu H.\", with the same birthday, and she wants to know which one to use and whether she can merge them herself. This week you will protect identity integrity, get visits scheduled without conflicts, and show the front desk how diagnosis codes differ from service codes. Everything you do is written to the audit trail your instructor reviews.",
      parts: [
        {
          title: "Read the ticket and open the chart",
          minutes: 15,
          steps: [
            { text: "Open the Tickets queue and read TKT-1047 from Maria Diaz. You do not have to resolve it for A1; it frames the problem.", link: { label: "Open the Tickets queue", view: "Tickets", role: "Analyst" }, expect: "Ten tickets. TKT-1047, \"Two charts for Liu Huang…\", is tagged A1." },
            { text: "Switch to the Front Desk role and open Liu Huang (MRN 6105100). The link does this for you; you can also search \"Liu\" in Patients and click Liu Huang.", link: { label: "Open Liu Huang in Patients", view: "Patients", patient: "PT-001", role: "Front Desk" }, expect: "The patient banner shows Liu Huang · MRN 6105100 with a red Penicillin allergy chip and an amber \"Possible duplicate\" chip.", check: { action: ACTION.OPEN_CHART } },
            { text: "Read the yellow \"Possible duplicate record\" box. Before you click anything, list which identifiers match and which differ.", expect: "Liu H. (MRN 6105111) has the same date of birth (1984-03-19) and language; the phone and the address format differ." },
            { text: "Click \"Send to HIM identity queue\".", expect: "The button changes to \"Sent to HIM identity queue ✓\".", check: { action: ACTION.ESCALATE_IDENTITY_REVIEW } },
          ],
          tip: "Never merge on name alone. Two matching identifiers can still belong to different people, and two differing ones can still be the same person. An analyst routes the question to the people authorized to decide, with the evidence attached.",
        },
        {
          title: "Record an MPI decision as HIM",
          minutes: 20,
          steps: [
            { text: "Switch to HIM and open the MPI identity workbench.", link: { label: "Open the MPI workbench", view: "MPI", role: "HIM" }, expect: "Review MPI-001 compares PT-001 and PT-012 on six signals: two Match, two Unverified, two Difference." },
            { text: "Choose the identity decision you can defend from the evidence. Ask yourself: if I am wrong, can this decision be undone safely?" },
            { text: "In \"Reasoning and next step\", write at least 20 characters that name the identifiers you compared and the verification still needed. Click Record identity decision.", expect: "A green message: \"Decision recorded. Any actual merge remains queued for authorized HIM review.\"", check: { action: ACTION.RESOLVE_IDENTITY_REVIEW } },
          ],
          tip: "Document uncertainty. \"Need more information: verify phone and address with the patient at check-in using two identifiers\" is a stronger note than a confident guess.",
        },
        {
          title: "Schedule and reschedule without a conflict",
          minutes: 25,
          steps: [
            { text: "Switch to Front Desk and open the Schedule.", link: { label: "Open the Schedule", view: "Schedule", role: "Front Desk" }, expect: "A table of appointments and a Create appointment form on the right." },
            { text: "Test the conflict rule: Patient Marcus Reed, Date 2026-09-21, Time 09:00, Provider Dr. Chen. Click Create appointment.", expect: "A red message that starts \"Conflict: Dr. Chen already has…\". Nothing was booked." },
            { text: "Change to a future weekday inside Dr. Chen's hours (for example 2026-09-28 at 10:00) and click Create appointment.", expect: "\"Appointment created.\" and a new row in the table.", check: { action: ACTION.CREATE_APPOINTMENT } },
            { text: "In the new row, click Reschedule, change the time (for example to 11:00), and click Save reschedule.", expect: "\"Appointment rescheduled. The original identifier and its change history are preserved.\" The row shows \"1 change(s) recorded\".", check: { action: ACTION.RESCHEDULE_APPOINTMENT } },
          ],
          tip: "Rescheduling keeps one appointment ID with a history. Canceling and rebooking creates two records, which distorts no-show and access measures.",
        },
        {
          title: "Diagnosis codes versus service codes",
          minutes: 15,
          steps: [
            { text: "Open Liu Huang's chart on the Coding tab.", link: { label: "Open Liu Huang's Coding tab", view: "Patients", patient: "PT-001", role: "Front Desk", tab: "Coding" }, expect: "A teaching code list with a notice that FY2027 ICD-10-CM applies to dates of service from October 1, 2026." },
            { text: "Click Record use on one ICD-10-CM diagnosis that fits Liu's visit (for example M75.51, bursitis of right shoulder).", expect: "This step ticks off here within a few seconds.", check: { action: ACTION.USE_CODE_EXAMPLE, contextMatch: "ICD-10-CM" } },
            { text: "Click Record use on one CPT service code for the office visit (for example 99213 or 99214).", check: { action: ACTION.USE_CODE_EXAMPLE, contextMatch: "CPT" } },
          ],
          tip: "ICD-10-CM answers \"why\" (the condition). CPT answers \"what was done\" (the service). A claim needs both, linked by a diagnosis pointer; in A3 you will see what happens when that link is missing.",
        },
        {
          title: "Check your evidence and submit",
          minutes: 15,
          steps: [
            { text: "Confirm the Action evidence panel shows 7 of 7, then write 150–250 words in Submit for grading and click Submit assignment.", expect: "The progress bar reads 100% and the status changes to \"Submitted v1\"." },
          ],
          tip: "Cite what you saw: the identifiers, the exact conflict message, and the two codes. Optional practice: triage and resolve TKT-1047 in Tickets. It is not graded in A1.",
        },
      ],
    },
  },
  {
    id: "FORDMS-A2",
    contentRevision: 5,
    title: "Closing clinical loops",
    shortTitle: "Closing clinical loops",
    estimatedMinutes: 110,
    dueAt: "2026-11-01T23:59:00-05:00",
    dueLabel: "Sunday, November 1, 2026 at 11:59 p.m. ET",
    weightPercent: 4.5,
    weekIntroduced: 4,
    releaseState: "released",
    scenario: "Dana Okafor forwarded three tickets: Marcus Reed's critical potassium sat unread all weekend (TKT-1042), the scanner keeps flagging Sofia Petrov's metoprolol (TKT-1041), and Dr. Chen wants to know who changed his note (TKT-1043). Work each problem the way clinicians do, then find out why the system allowed it.",
    objectives: [
      "Protect note integrity with signing and amendments.",
      "Respond to order warnings instead of reflexively overriding them.",
      "Separate result acknowledgment from accountable follow-up.",
      "Use barcode scanning and the five rights to decide whether to administer or hold a dose.",
      "Trace a safety ticket to its root cause with evidence and communicate the fix.",
    ],
    workflow: [
      "Triage Dr. Chen's note ticket, review Liu Huang's notes, write and sign a SOAP note, and add an amendment.",
      "Work Marcus Reed's critical result from the In Basket, place two orders while handling the warning, and resolve Dana's ticket.",
      "As a nurse, scan Sofia Petrov's metoprolol on the eMAR, respond to the warnings, administer or hold with a reason, and resolve Jordan's ticket.",
      "Route a portal message.",
      "Submit your written analysis.",
    ],
    requirements: [
      { action: ACTION.SIGNED_SOAP_NOTE, label: "Write and sign a complete SOAP note", minimumCount: 1 },
      { action: ACTION.AMEND_SIGNED_NOTE, label: "Add an amendment without overwriting the signed note", minimumCount: 1 },
      { action: ACTION.PLACE_SIMULATED_ORDER, label: "Place two orders, handling the warning you meet", minimumCount: 2 },
      { action: ACTION.REVIEW_RESULT_FOLLOWUP, label: "Acknowledge a result and assign accountable follow-up", minimumCount: 1 },
      { action: ACTION.ROUTE_PORTAL_MESSAGE, label: "Route a patient portal message", minimumCount: 1 },
      { action: ACTION.MAR_SCAN, label: "Scan a wristband and a medication on the eMAR", minimumCount: 1 },
      { action: ACTION.ADMINISTER_MEDICATION, anyOf: [ACTION.HOLD_MEDICATION], label: "Administer a scanned dose or hold it with a reason", minimumCount: 1 },
      { action: ACTION.RESOLVE_TICKET, label: "Resolve two A2 tickets with root cause and communication", minimumCount: 2, contextMatch: "A2:" },
    ],
    submissionPrompt: "In 175–300 words: (1) for one ticket you resolved, state the root cause, the evidence that proves it, and the fix you recommended; (2) explain your eMAR decision (administer, hold, or override) and why; (3) explain how acknowledging Marcus Reed's result differs from closing the loop.",
    rubric: [
      { criterion: "Ticket investigation and root cause", points: 25, standard: "Names the root cause, cites the specific evidence that proves it, and recommends a fix aimed at the system rather than an individual." },
      { criterion: "Medication safety (orders and eMAR)", points: 25, standard: "Handles the order warning without an unjustified override; responds correctly to wrong-patient, look-alike, and dose warnings; administers or holds with a defensible reason." },
      { criterion: "Result and communication loop closure", points: 20, standard: "Assigns follow-up to a named owner with a due date and routes patient communication appropriately." },
      { criterion: "Documentation integrity", points: 15, standard: "Signs a source-supported SOAP note and uses an amendment rather than altering signed content." },
      { criterion: "Written analysis", points: 15, standard: "Uses specific chart and audit evidence and acknowledges the limits of the simulation." },
    ],
    guide: {
      situation: "Monday morning, Dana Okafor forwards three tickets with a note: \"All three landed over the weekend. Work them like a clinician first, then tell me why our system let it happen.\" Marcus Reed's critical potassium (6.1 mmol/L) sat in an inbox from Saturday to Monday (TKT-1042). Jordan Park, the 4 West charge nurse, says the scanner keeps flagging Sofia Petrov's metoprolol and night shift overrides it (TKT-1041). Dr. Lin Chen wants to know who changed his note on Liu Huang (TKT-1043). Resolve at least two of the three.",
      parts: [
        {
          title: "Note integrity (Dr. Chen's ticket)",
          minutes: 25,
          steps: [
            { text: "Open TKT-1043 in Tickets. In Step 1 (Triage), choose a category, priority, and owner, then click Save triage.", link: { label: "Open the Tickets queue", view: "Tickets", role: "Analyst" }, expect: "The ticket status changes from New to Triaged.", check: { action: ACTION.TRIAGE_TICKET, contextMatch: "A2:TKT-1043" } },
            { text: "Open Liu Huang's Notes tab as Physician/APP and read both signed notes.", link: { label: "Open Liu Huang's notes", view: "Patients", patient: "PT-001", role: "Physician/APP", tab: "Notes" }, expect: "Two signed notes: 8/10 (typed, right shoulder) and 9/14 (source \"AI scribe draft accepted\", says left shoulder)." },
            { text: "Open Encounter and write today's SOAP note using only the Chart evidence panel. Fill all four sections and click Sign note.", link: { label: "Open Liu Huang's encounter", view: "Encounter", patient: "PT-001", role: "Physician/APP" }, expect: "\"Note signed. Signed content cannot be edited; use an amendment for corrections.\"", check: { action: ACTION.SIGNED_SOAP_NOTE } },
            { text: "Type an amendment reason (for example, clarify that the neurologic exam was not performed) and click Add amendment.", expect: "\"Amendment added. The original signed note remains in history.\"", check: { action: ACTION.AMEND_SIGNED_NOTE } },
            { text: "Back in TKT-1043, tick the evidence you actually checked (Step 2), then complete Step 3: root cause, fix, who to notify, and a short message to Dr. Chen. Click Resolve ticket.", expect: "The ticket shows Resolved with your root cause.", check: { action: ACTION.RESOLVE_TICKET, contextMatch: "A2:TKT-1043" } },
          ],
          tip: "Signed notes are legal records: nobody edits them after signature. Corrections are amendments by the author that point back to the original. When a note says something the author never typed, check the note's source before suspecting a person.",
        },
        {
          title: "The critical potassium (Dana's ticket)",
          minutes: 30,
          steps: [
            { text: "Switch to Physician/APP and open the In Basket. Select the Results folder.", link: { label: "Open the physician In Basket", view: "In Basket", role: "Physician/APP" }, expect: "IB-001 \"CRITICAL: Potassium 6.1 mmol/L\" for Marcus Reed, received Saturday 8:05 a.m., recipient Sam Brooks, NP (out of office, no delegate set)." },
            { text: "Select the item, choose \"Acknowledge and create follow-up task\", pick an owner and due date, and click Complete.", expect: "The item moves to Done and the new task appears in the Worklist under My tasks.", check: { action: ACTION.REVIEW_RESULT_FOLLOWUP } },
            { text: "Open Orders & Results for Marcus Reed. Set Order type to Medication and choose Lisinopril 10 mg tablet.", link: { label: "Open Marcus Reed's orders", view: "Orders & Results", patient: "PT-002", role: "Physician/APP" }, expect: "An amber \"Interaction warning\" box: recent potassium is high; an override reason would be required." },
            { text: "Do not override. Change the medication to Sodium zirconium cyclosilicate 10 g oral packet (a potassium binder) and click Submit simulated order. Then set Order type to Laboratory, choose Basic metabolic panel, and submit again.", expect: "\"Order placed.\" then \"Laboratory order placed. A simulated final result is now waiting for acknowledgment.\"", check: { action: ACTION.PLACE_SIMULATED_ORDER } },
            { text: "Open TKT-1042, triage it, record the evidence you used (the In Basket item, the lab comment, the routing note), and resolve it with a root cause, fix, notification list, and message to Dana.", link: { label: "Open the Tickets queue", view: "Tickets", role: "Analyst" }, check: { action: ACTION.RESOLVE_TICKET, contextMatch: "A2:TKT-1042" } },
          ],
          tip: "\"Acknowledged\" means someone saw it. \"Closed\" means a named person owns the next action and it has a due date. Critical results also need a route that works when the ordering clinician is away: a delegate, a pool, or a phone call to the covering provider.",
        },
        {
          title: "Barcode scanning on the eMAR (Jordan's ticket)",
          minutes: 30,
          steps: [
            { text: "Switch to Nurse and open Sofia Petrov's eMAR.", link: { label: "Open Sofia Petrov's eMAR", view: "eMAR", patient: "PT-008", role: "Nurse" }, expect: "A grid of scheduled times. Metoprolol tartrate 25 mg at 09:00 shows Overdue. The banner shows DNR/DNI, the sulfa allergy, and fall risk." },
            { text: "Click Scan on the 09:00 metoprolol. In Scan wristband, choose \"Sofia Petrova · Rm 415-B\" (the roommate) and click Scan.", expect: "A red WRONG PATIENT hard stop. Nothing can be given." },
            { text: "Scan the correct wristband (Sofia Petrov · Rm 415-A). In Scan medication, choose Metoprolol succinate ER 25 mg and click Scan.", expect: "A red LOOK-ALIKE DRUG hard stop: succinate ER is not the ordered tartrate." },
            { text: "Scan Metoprolol tartrate 50 mg instead.", expect: "An amber DOSE MISMATCH warning (50 mg scanned, 25 mg ordered) plus a LATE warning. Giving it now would require an override reason.", check: { action: ACTION.MAR_SCAN } },
            { text: "Decide. Hold the dose with a reason (for example \"Wrong strength dispensed; pharmacy notified\"), or override with a specific reason if you can defend it.", expect: "The 09:00 cell shows Held (or Override) and your entry appears in the Administration history.", check: { action: ACTION.ADMINISTER_MEDICATION, anyOf: [ACTION.HOLD_MEDICATION] } },
            { text: "Read the Administration history below the grid: three earlier overrides. Then resolve TKT-1041 in Tickets with evidence, root cause, fix, and a message to Jordan.", link: { label: "Open the Tickets queue", view: "Tickets", role: "Analyst" }, check: { action: ACTION.RESOLVE_TICKET, contextMatch: "A2:TKT-1041" } },
          ],
          tip: "When staff override the same warning every shift, the warning is usually right and the process around it is broken. Look upstream (pharmacy stocking, product build) before you blame the scanner or the nurses.",
        },
        {
          title: "Route a patient message",
          minutes: 10,
          steps: [
            { text: "Open the Portal for Elena Garcia as Nurse.", link: { label: "Open Elena Garcia's portal messages", view: "Portal", patient: "PT-003", role: "Nurse" }, expect: "An English blood-pressure message with a suggested route, and a Spanish message that matched no routing rule." },
            { text: "Route the blood-pressure message to the suggested pool.", expect: "Its status changes to \"Routed → Clinical team pool\".", check: { action: ACTION.ROUTE_PORTAL_MESSAGE } },
          ],
          tip: "Look at where the Spanish message would go. That is TKT-1049 (optional practice): rules that only match English keywords leave some patients without an owner.",
        },
        {
          title: "Check your evidence and submit",
          minutes: 15,
          steps: [
            { text: "Confirm the Action evidence panel shows 10 of 10, then write 175–300 words and submit." },
          ],
          tip: "Strong answers quote the evidence (the exact warning text, the recipient on the In Basket item, the override history) and propose a fix aimed at the system, not at a person.",
        },
      ],
    },
  },
  {
    id: "FORDMS-A3",
    contentRevision: 5,
    title: "Exchange, analytics, and revenue integrity",
    shortTitle: "Exchange, analytics, revenue",
    estimatedMinutes: 110,
    dueAt: "2026-11-22T23:59:00-05:00",
    dueLabel: "Sunday, November 22, 2026 at 11:59 p.m. ET",
    weightPercent: 4.5,
    weekIntroduced: 8,
    releaseState: "released",
    scenario: "Month-end is coming. Tanya Williams has three CO-16 denials that all trace to Dr. Patel's lab orders (TKT-1044), Quality reports the fall-reassessment rate on 4 West fell to 61% after a flowsheet change (TKT-1045), and outside records are waiting in the HIE inbox. Reconcile external data, test whether a number is real before anyone acts on it, and fix claims at the source.",
    objectives: [
      "Use source, time, match confidence, and resource type during reconciliation.",
      "Define, run, and validate reproducible population queries.",
      "Tell a real performance change from a measurement artifact.",
      "Correct claim edits at the source and work a denial with the right action.",
    ],
    workflow: [
      "Reconcile two incoming HIE items with documented decisions.",
      "Run two cohort queries, validate one, and investigate the fall-reassessment drop.",
      "In Billing, scrub, correct, and submit a claim; work one denial.",
      "Resolve TKT-1044 and TKT-1045, then submit your analysis.",
    ],
    requirements: [
      { action: ACTION.RECONCILE_EXTERNAL_ITEM, label: "Reconcile two external clinical items", minimumCount: 2 },
      { action: ACTION.RUN_POPULATION_QUERY, label: "Run two different population queries", minimumCount: 2 },
      { action: ACTION.VALIDATE_POPULATION_QUERY, label: "Record a denominator and patient-level validation", minimumCount: 1 },
      { action: ACTION.CORRECT_CLAIM, label: "Correct a claim that failed the scrubber", minimumCount: 1 },
      { action: ACTION.SUBMIT_CLAIM, label: "Submit a clean claim", minimumCount: 1 },
      { action: ACTION.WORK_DENIAL, label: "Work a denial with the right action and a note", minimumCount: 1 },
      { action: ACTION.RESOLVE_TICKET, label: "Resolve the billing (TKT-1044) and quality (TKT-1045) tickets", minimumCount: 2, contextMatch: "A3:" },
    ],
    submissionPrompt: "In 200–300 words: (1) compare your two reconciliation decisions; (2) state the exact cohort definition you validated and one data-quality limitation; (3) explain whether the fall-reassessment drop is real and how you know; (4) name the root cause of the CO-16 denials and the fix that prevents the next one.",
    rubric: [
      { criterion: "External record reconciliation", points: 20, standard: "Uses provenance, identity confidence, timing, and discrepancy evidence for two resources." },
      { criterion: "Query validation and measurement", points: 25, standard: "States the denominator and status logic, checks patient-level evidence, and identifies the fall-report artifact with numbers." },
      { criterion: "Revenue integrity", points: 25, standard: "Corrects the edit at its source, submits a clean claim, and works the denial with an action allowed for the group code." },
      { criterion: "Ticket root cause and communication", points: 15, standard: "Resolves both tickets with evidence, a system-level fix, and a clear message to the requester." },
      { criterion: "Written analysis", points: 15, standard: "Separates what the data show from what they cannot establish." },
    ],
    guide: {
      situation: "It is the week before month-end close. Tanya Williams, the billing and coding manager, has three CO-16 denials, all on lab lines Dr. Patel ordered (TKT-1044). Rosa Méndez from Quality says the 4 West fall-reassessment rate fell from 88% to 61% the week the new flowsheet went live and wants a corrective action plan for nursing (TKT-1045). Outside records are also arriving through the HIE. Dana's advice: \"Before anyone acts on a number, prove the number.\"",
      parts: [
        {
          title: "Reconcile outside records",
          minutes: 20,
          steps: [
            { text: "Open the HIE reconciliation inbox as Analyst.", link: { label: "Open the HIE inbox", view: "HIE", role: "Analyst" }, expect: "Five pending items with source, received time, identity confidence, and local versus incoming values." },
            { text: "Decide two items: Accept into chart, Keep local, or Defer. Compare identity confidence (below 85% is not auto-linked), timing, and specificity before you choose.", expect: "Each decided card shows its status and a reviewer note.", check: { action: ACTION.RECONCILE_EXTERNAL_ITEM } },
          ],
          tip: "An older, less specific, low-confidence record should never overwrite a newer, more specific local value. Deferring with a reason is a legitimate decision.",
        },
        {
          title: "Prove the number (Quality's ticket)",
          minutes: 35,
          steps: [
            { text: "Open Query Studio. Run two different cohort definitions (for example \"A1c ≥ 8%\" and \"Abnormal potassium\").", link: { label: "Open Query Studio", view: "Query Studio", role: "Analyst" }, expect: "Each run lists matched patients, the denominator, and patients with missing or non-final values shown separately.", check: { action: ACTION.RUN_POPULATION_QUERY } },
            { text: "Write a validation note (80+ characters) that states the denominator, one patient you checked in the chart, and one limitation. Click Record validation.", expect: "\"Validation evidence recorded.\"", check: { action: ACTION.VALIDATE_POPULATION_QUERY } },
            { text: "Open Analytics and find the Fall-risk reassessment panel. Read the report definition, then turn on \"Include new flowsheet row FS-2203\".", link: { label: "Open the quality panel in Analytics", view: "Analytics", role: "Analyst" }, expect: "The week of Sep 14 jumps from 61% to about 90% when the new row is included." },
            { text: "Resolve TKT-1045 in Tickets with the evidence you used, the root cause, and a message to Rosa that explains what to tell leadership.", link: { label: "Open the Tickets queue", view: "Tickets", role: "Analyst" }, check: { action: ACTION.RESOLVE_TICKET, contextMatch: "A3:TKT-1045" } },
          ],
          tip: "When a measure moves sharply the same week a build changed, suspect the measurement first. Check the definition, the data element it reads, and whether documentation moved.",
        },
        {
          title: "Fix claims at the source (Tanya's ticket)",
          minutes: 40,
          steps: [
            { text: "Switch to Revenue Cycle and open Billing. In Charge review, select Elena Garcia's claim CLM-26-0412 and click Run scrubber.", link: { label: "Open Billing", view: "Billing", role: "Revenue Cycle" }, expect: "A red edit: line 2 (83036 Hemoglobin A1c) has no diagnosis pointer.", check: { action: ACTION.SCRUB_CLAIM } },
            { text: "Use the fix control on the edit to point line 2 to E11.9, then click Run scrubber again.", expect: "\"Correct claim\" is recorded in the claim history and the scrubber shows no edits.", check: { action: ACTION.CORRECT_CLAIM } },
            { text: "Click Submit claim.", expect: "The claim moves to Submitted.", check: { action: ACTION.SUBMIT_CLAIM } },
            { text: "Open the Denials tab. Select one CO-16 denial (for example Noah Williams, CLM-26-0388), read the plain-language reason, choose an action, and write a note (for a CO denial, the patient cannot be billed).", expect: "The claim moves to Denial worked with your action and note.", check: { action: ACTION.WORK_DENIAL } },
            { text: "Look across all three CO-16 denials and the Elena Garcia edit: what do they share? Resolve TKT-1044 with evidence, root cause, fix, and a message to Tanya.", link: { label: "Open the Tickets queue", view: "Tickets", role: "Analyst" }, check: { action: ACTION.RESOLVE_TICKET, contextMatch: "A3:TKT-1044" } },
          ],
          tip: "Working denials one by one treats symptoms. If every denial shares an ordering provider and a missing field, the fix is in the build (order favorites, required fields), with a scrubber rule as the safety net.",
        },
        {
          title: "Check your evidence and submit",
          minutes: 15,
          steps: [
            { text: "Confirm the Action evidence panel shows 10 of 10, then write 200–300 words and submit." },
          ],
          tip: "Put numbers in your analysis: 61% versus about 90%, three denials, one ordering provider. Numbers with their definitions are what leaders act on.",
        },
      ],
    },
  },
  {
    id: "FORDMS-A4",
    contentRevision: 5,
    title: "AI safety review and go-live readiness",
    shortTitle: "AI safety and go-live",
    estimatedMinutes: 105,
    dueAt: "2026-12-06T23:59:00-05:00",
    dueLabel: "Sunday, December 6, 2026 at 11:59 p.m. ET",
    weightPercent: 4.5,
    weekIntroduced: 10,
    releaseState: "released",
    scenario: "Fordham Health wants to expand AI-drafted patient replies and ambient AI notes to every clinic next month, at the same time as barcode medication administration goes live on 4 West. Dr. Patel just reported drafts telling patients to stop medications (TKT-1046). Review the AI output sentence by sentence, oversee drafted replies, and make a defensible go/no-go recommendation.",
    objectives: [
      "Classify AI-generated sentences against source evidence.",
      "Decide whether an AI-drafted reply is safe to send, needs editing, or must be discarded.",
      "Evaluate readiness across workflow, interfaces, training, downtime, and measurement.",
      "Define release conditions, ownership, monitoring, and rollback triggers.",
    ],
    workflow: [
      "Classify all twelve sentences of the scripted AI visit summary with citations, then record a disposition.",
      "Review at least two AI-drafted replies in the In Basket.",
      "Resolve Dr. Patel's AI ticket.",
      "Update three readiness domains and record a go-live recommendation with safeguards.",
      "Submit your evaluation.",
    ],
    requirements: [
      { action: ACTION.AI_DRAFT_REVIEW, label: "Complete the sentence-level AI draft review", minimumCount: 1 },
      { action: ACTION.REVIEW_AI_DRAFT_REPLY, label: "Review two AI-drafted In Basket replies", minimumCount: 2 },
      { action: ACTION.UPDATE_IMPLEMENTATION_READINESS, label: "Update at least three distinct readiness domains", minimumCount: 3 },
      { action: ACTION.RECORD_GO_LIVE_RECOMMENDATION, label: "Record a release recommendation with safeguards", minimumCount: 1 },
      { action: ACTION.RESOLVE_TICKET, label: "Resolve Dr. Patel's AI ticket (TKT-1046)", minimumCount: 1, contextMatch: "A4:" },
    ],
    submissionPrompt: "In 225–350 words: identify the most clinically material errors in the AI draft and how you found them; explain what you did with each AI-drafted reply and why; recommend go, conditional go, or no-go; and name an owner, an outcome measure, a balancing measure, and a rollback trigger.",
    rubric: [
      { criterion: "AI draft error detection", points: 30, standard: "Finds the clinically material errors, classifies them accurately, and cites the source line for each; few false flags." },
      { criterion: "Oversight of AI-drafted replies", points: 20, standard: "Does not send unsafe drafts; edits or discards with the specific issue named; resolves the AI ticket with a system-level fix." },
      { criterion: "Implementation readiness judgment", points: 20, standard: "Updates three or more domains using the displayed evidence rather than optimism." },
      { criterion: "Go-live recommendation and safeguards", points: 20, standard: "States conditions, ownership, outcome and balancing measures, monitoring, and a usable rollback trigger." },
      { criterion: "Written analysis", points: 10, standard: "Keeps humans accountable and names the limits of the simulation." },
    ],
    guide: {
      situation: "The steering committee meets Friday. Fordham Health wants to turn on AI-drafted patient replies and ambient AI notes in every clinic next month, the same month barcode medication administration (BCMA) goes live on 4 West. This morning Dr. Ravi Patel reported drafts that tell patients to stop medications (TKT-1046). Dana needs three things from you: a sentence-level safety review of a real AI draft, a judgment on the drafted replies clinicians are sending, and a go/no-go recommendation she can defend.",
      parts: [
        {
          title: "Sentence-level review of an AI visit summary",
          minutes: 35,
          steps: [
            { text: "Open AI Review as Analyst. The source encounter is on the left (lines S1–S10); the AI draft is on the right, split into twelve numbered sentences.", link: { label: "Open the AI draft review", view: "AI Review", patient: "PT-001", role: "Analyst" }, expect: "Twelve sentences, each marked \"Not reviewed\"." },
            { text: "Click each sentence. Choose Supported, Unsupported, Contradicts source, Wrong patient detail, or Omission, and choose the source line that proves it (or \"No source\").", expect: "The counter reaches \"12 of 12 classified\"." },
            { text: "Choose a disposition and write a reviewer note naming the most serious error. Click Finish review.", expect: "\"Review recorded.\" You will not see an answer key; your instructor sees your accuracy.", check: { action: ACTION.AI_DRAFT_REVIEW } },
          ],
          tip: "Read the source first, then the draft. A fluent sentence is not evidence. Watch for laterality, mechanism, invented exams or plans, details from another patient, and safety facts that are silently left out.",
        },
        {
          title: "Oversee AI-drafted replies",
          minutes: 20,
          steps: [
            { text: "Switch to Physician/APP, open the In Basket, and select the AI Draft Replies folder.", link: { label: "Open AI-drafted replies", view: "In Basket", role: "Physician/APP" }, expect: "Drafted replies for Marcus Reed and Grace Kim (and more in the Nurse pool) marked \"AI-drafted reply · review before sending\"." },
            { text: "For at least two drafts: compare the draft with the patient's message and chart, tick every issue you find, and choose Send as drafted, Edit and send, Discard and write own reply, or Discard and route to clinician. Click Complete.", expect: "Each reviewed item moves to Done with your decision.", check: { action: ACTION.REVIEW_AI_DRAFT_REPLY } },
            { text: "Resolve TKT-1046 in Tickets with evidence, root cause, fix, and a message to Dr. Patel.", link: { label: "Open the Tickets queue", view: "Tickets", role: "Analyst" }, check: { action: ACTION.RESOLVE_TICKET, contextMatch: "A4:" } },
          ],
          tip: "The clinician who clicks Send owns the reply. A good guardrail makes the safe path the easy path: block medication-change advice, require an edit or attestation, and monitor what is sent unedited.",
        },
        {
          title: "Readiness and the go-live recommendation",
          minutes: 35,
          steps: [
            { text: "Switch to Implementation Lead and open Implementation. Read the evidence on all eight domains.", link: { label: "Open the readiness board", view: "Implementation", role: "Implementation Lead" }, expect: "Eight domain cards with owner, evidence, risk, and status; two high-risk domains are not ready." },
            { text: "Update at least three readiness decisions based on the evidence shown.", expect: "Each updated card shows an Updated timestamp.", check: { action: ACTION.UPDATE_IMPLEMENTATION_READINESS } },
            { text: "Record a recommendation (No go, Conditional go, or Go) and complete every safeguard field.", expect: "\"Go-live recommendation recorded in the audit trail.\"", check: { action: ACTION.RECORD_GO_LIVE_RECOMMENDATION } },
          ],
          tip: "Pair every outcome measure with a balancing measure (for example: faster replies versus unsafe advice sent) and make the rollback trigger a number someone can check on day three.",
        },
        {
          title: "Check your evidence and submit",
          minutes: 15,
          steps: [
            { text: "Confirm the Action evidence panel shows 8 of 8, then write 225–350 words and submit." },
          ],
          tip: "Tie your recommendation to what you found today: the draft errors, the unsafe replies, and the open high-risk domains.",
        },
      ],
    },
  },
];

export const ASSIGNMENT_IDS = defaultAssignments.map((item) => item.id);

/** Combined course share of the four FordMS assignments (each counts equally within it). */
export const FORDMS_CATEGORY_SHARE = 18;
export const EHRGO_CATEGORY_SHARE = 12;
