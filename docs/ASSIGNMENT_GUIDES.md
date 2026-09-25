# FordMS assignment guides

Student-facing guides for FORDMS-A1 to A4, identical to the step-by-step guide in the FordMS Assignments view.
In the app, steps with a check mark tick off automatically when the audit trail records the action.
Links open the right screen, simulated role, and patient.

You are the clinical informatics analyst at Fordham Health. Your manager is Dana Okafor, the clinical informatics manager.
All patients, staff, and data are fictional. FordMS is a teaching simulation, not a clinical system.

## A1: Identity, access, scheduling, and coding

**Due:** Sunday, October 11, 2026 at 11:59 p.m. ET · **Time:** about 90 minutes · **Assignment id:** FORDMS-A1

### Your situation

You are the clinical informatics analyst at Fordham Health; your manager is Dana Okafor. Monday, 9:40 a.m.: Maria Diaz, the front desk lead, opened ticket TKT-1047. While booking a physical therapy visit she found two charts, "Liu Huang" and "Liu H.", with the same birthday, and she wants to know which one to use and whether she can merge them herself. This week you will protect identity integrity, get visits scheduled without conflicts, and show the front desk how diagnosis codes differ from service codes. Everything you do is written to the audit trail your instructor reviews.

### Part 1: Read the ticket and open the chart (about 15 min)

1. Open the Tickets queue and read TKT-1047 from Maria Diaz. You do not have to resolve it for A1; it frames the problem.
   - Link: [Open the Tickets queue](https://fordms.com/?view=tickets&role=analyst)
   - You should see: Ten tickets. TKT-1047, "Two charts for Liu Huang…", is tagged A1.
2. Switch to the Front Desk role and open Liu Huang (MRN 6105100). The link does this for you; you can also search "Liu" in Patients and click Liu Huang. ✓ *(checked automatically)*
   - Link: [Open Liu Huang in Patients](https://fordms.com/?view=chart&patient=PT-001&role=front-desk)
   - You should see: The patient banner shows Liu Huang · MRN 6105100 with a red Penicillin allergy chip and an amber "Possible duplicate" chip.
3. Read the yellow "Possible duplicate record" box. Before you click anything, list which identifiers match and which differ.
   - You should see: Liu H. (MRN 6105111) has the same date of birth (1984-03-19) and language; the phone and the address format differ.
4. Click "Send to HIM identity queue". ✓ *(checked automatically)*
   - You should see: The button changes to "Sent to HIM identity queue ✓".

> **Analyst tip:** Never merge on name alone. Two matching identifiers can still belong to different people, and two differing ones can still be the same person. An analyst routes the question to the people authorized to decide, with the evidence attached.

### Part 2: Record an MPI decision as HIM (about 20 min)

1. Switch to HIM and open the MPI identity workbench.
   - Link: [Open the MPI workbench](https://fordms.com/?view=mpi&role=him)
   - You should see: Review MPI-001 compares PT-001 and PT-012 on six signals: two Match, two Unverified, two Difference.
2. Choose the identity decision you can defend from the evidence. Ask yourself: if I am wrong, can this decision be undone safely?
3. In "Reasoning and next step", write at least 20 characters that name the identifiers you compared and the verification still needed. Click Record identity decision. ✓ *(checked automatically)*
   - You should see: A green message: "Decision recorded. Any actual merge remains queued for authorized HIM review."

> **Analyst tip:** Document uncertainty. "Need more information: verify phone and address with the patient at check-in using two identifiers" is a stronger note than a confident guess.

### Part 3: Schedule and reschedule without a conflict (about 25 min)

1. Switch to Front Desk and open the Schedule.
   - Link: [Open the Schedule](https://fordms.com/?view=schedule&role=front-desk)
   - You should see: A table of appointments and a Create appointment form on the right.
2. Test the conflict rule: Patient Marcus Reed, Date 2026-09-21, Time 09:00, Provider Dr. Chen. Click Create appointment.
   - You should see: A red message that starts "Conflict: Dr. Chen already has…". Nothing was booked.
3. Change to a future weekday inside Dr. Chen's hours (for example 2026-09-28 at 10:00) and click Create appointment. ✓ *(checked automatically)*
   - You should see: "Appointment created." and a new row in the table.
4. In the new row, click Reschedule, change the time (for example to 11:00), and click Save reschedule. ✓ *(checked automatically)*
   - You should see: "Appointment rescheduled. The original identifier and its change history are preserved." The row shows "1 change(s) recorded".

> **Analyst tip:** Rescheduling keeps one appointment ID with a history. Canceling and rebooking creates two records, which distorts no-show and access measures.

### Part 4: Diagnosis codes versus service codes (about 15 min)

1. Open Liu Huang's chart on the Coding tab.
   - Link: [Open Liu Huang's Coding tab](https://fordms.com/?view=chart&patient=PT-001&role=front-desk&tab=coding)
   - You should see: A teaching code list with a notice that FY2027 ICD-10-CM applies to dates of service from October 1, 2026.
2. Click Record use on one ICD-10-CM diagnosis that fits Liu's visit (for example M75.51, bursitis of right shoulder). ✓ *(checked automatically)*
   - You should see: This step ticks off here within a few seconds.
3. Click Record use on one CPT service code for the office visit (for example 99213 or 99214). ✓ *(checked automatically)*

> **Analyst tip:** ICD-10-CM answers "why" (the condition). CPT answers "what was done" (the service). A claim needs both, linked by a diagnosis pointer; in A3 you will see what happens when that link is missing.

### Part 5: Check your evidence and submit (about 15 min)

1. Confirm the Action evidence panel shows 7 of 7, then write 150–250 words in Submit for grading and click Submit assignment.
   - You should see: The progress bar reads 100% and the status changes to "Submitted v1".

> **Analyst tip:** Cite what you saw: the identifiers, the exact conflict message, and the two codes. Optional practice: triage and resolve TKT-1047 in Tickets. It is not graded in A1.

### What the app checks

- Open and verify a patient chart
- Send a possible duplicate to the HIM queue
- Record an MPI decision with reasoning
- Create a valid appointment
- Reschedule while preserving the appointment record
- Record an ICD-10-CM diagnosis example
- Record a CPT service example

### Written analysis

In 150–250 words, explain which identity evidence drove your MPI decision, how you resolved the scheduling conflict, and why the two selected codes represent different code systems.

### Rubric (100 points)

| Criterion | Points | Standard |
| --- | --- | --- |
| Patient identity and MPI reasoning | 30 | Uses several identifiers, recognizes uncertainty, and records a safe next step. |
| Scheduling and access workflow | 25 | Creates and reschedules accurately and responds appropriately to conflict detection. |
| Coding distinction | 20 | Selects and correctly distinguishes ICD-10-CM and CPT examples. |
| Audit evidence | 15 | Required actions are complete, attributable, and internally consistent. |
| Written analysis | 10 | Explains decisions clearly and acknowledges limits. |

## A2: Closing clinical loops

**Due:** Sunday, November 1, 2026 at 11:59 p.m. ET · **Time:** about 110 minutes · **Assignment id:** FORDMS-A2

### Your situation

Monday morning, Dana Okafor forwards three tickets with a note: "All three landed over the weekend. Work them like a clinician first, then tell me why our system let it happen." Marcus Reed's critical potassium (6.1 mmol/L) sat in an inbox from Saturday to Monday (TKT-1042). Jordan Park, the 4 West charge nurse, says the scanner keeps flagging Sofia Petrov's metoprolol and night shift overrides it (TKT-1041). Dr. Lin Chen wants to know who changed his note on Liu Huang (TKT-1043). Resolve at least two of the three.

### Part 1: Note integrity (Dr. Chen's ticket) (about 25 min)

1. Open TKT-1043 in Tickets. In Step 1 (Triage), choose a category, priority, and owner, then click Save triage. ✓ *(checked automatically)*
   - Link: [Open the Tickets queue](https://fordms.com/?view=tickets&role=analyst)
   - You should see: The ticket status changes from New to Triaged.
2. Open Liu Huang's Notes tab as Physician/APP and read both signed notes.
   - Link: [Open Liu Huang's notes](https://fordms.com/?view=chart&patient=PT-001&role=physician&tab=notes)
   - You should see: Two signed notes: 8/10 (typed, right shoulder) and 9/14 (source "AI scribe draft accepted", says left shoulder).
3. Open Encounter and write today's SOAP note using only the Chart evidence panel. Fill all four sections and click Sign note. ✓ *(checked automatically)*
   - Link: [Open Liu Huang's encounter](https://fordms.com/?view=encounter&patient=PT-001&role=physician)
   - You should see: "Note signed. Signed content cannot be edited; use an amendment for corrections."
4. Type an amendment reason (for example, clarify that the neurologic exam was not performed) and click Add amendment. ✓ *(checked automatically)*
   - You should see: "Amendment added. The original signed note remains in history."
5. Back in TKT-1043, tick the evidence you actually checked (Step 2), then complete Step 3: root cause, fix, who to notify, and a short message to Dr. Chen. Click Resolve ticket. ✓ *(checked automatically)*
   - You should see: The ticket shows Resolved with your root cause.

> **Analyst tip:** Signed notes are legal records: nobody edits them after signature. Corrections are amendments by the author that point back to the original. When a note says something the author never typed, check the note's source before suspecting a person.

### Part 2: The critical potassium (Dana's ticket) (about 30 min)

1. Switch to Physician/APP and open the In Basket. Select the Results folder.
   - Link: [Open the physician In Basket](https://fordms.com/?view=in-basket&role=physician)
   - You should see: IB-001 "CRITICAL: Potassium 6.1 mmol/L" for Marcus Reed, received Saturday 8:05 a.m., recipient Sam Brooks, NP (out of office, no delegate set).
2. Select the item, choose "Acknowledge and create follow-up task", pick an owner and due date, and click Complete. ✓ *(checked automatically)*
   - You should see: The item moves to Done and the new task appears in the Worklist under My tasks.
3. Open Orders & Results for Marcus Reed. Set Order type to Medication and choose Lisinopril 10 mg tablet.
   - Link: [Open Marcus Reed's orders](https://fordms.com/?view=orders&patient=PT-002&role=physician)
   - You should see: An amber "Interaction warning" box: recent potassium is high; an override reason would be required.
4. Do not override. Change the medication to Sodium zirconium cyclosilicate 10 g oral packet (a potassium binder) and click Submit simulated order. Then set Order type to Laboratory, choose Basic metabolic panel, and submit again. ✓ *(checked automatically)*
   - You should see: "Order placed." then "Laboratory order placed. A simulated final result is now waiting for acknowledgment."
5. Open TKT-1042, triage it, record the evidence you used (the In Basket item, the lab comment, the routing note), and resolve it with a root cause, fix, notification list, and message to Dana. ✓ *(checked automatically)*
   - Link: [Open the Tickets queue](https://fordms.com/?view=tickets&role=analyst)

> **Analyst tip:** "Acknowledged" means someone saw it. "Closed" means a named person owns the next action and it has a due date. Critical results also need a route that works when the ordering clinician is away: a delegate, a pool, or a phone call to the covering provider.

### Part 3: Barcode scanning on the eMAR (Jordan's ticket) (about 30 min)

1. Switch to Nurse and open Sofia Petrov's eMAR.
   - Link: [Open Sofia Petrov's eMAR](https://fordms.com/?view=emar&patient=PT-008&role=nurse)
   - You should see: A grid of scheduled times. Metoprolol tartrate 25 mg at 09:00 shows Overdue. The banner shows DNR/DNI, the sulfa allergy, and fall risk.
2. Click Scan on the 09:00 metoprolol. In Scan wristband, choose "Sofia Petrova · Rm 415-B" (the roommate) and click Scan.
   - You should see: A red WRONG PATIENT hard stop. Nothing can be given.
3. Scan the correct wristband (Sofia Petrov · Rm 415-A). In Scan medication, choose Metoprolol succinate ER 25 mg and click Scan.
   - You should see: A red LOOK-ALIKE DRUG hard stop: succinate ER is not the ordered tartrate.
4. Scan Metoprolol tartrate 50 mg instead. ✓ *(checked automatically)*
   - You should see: An amber DOSE MISMATCH warning (50 mg scanned, 25 mg ordered) plus a LATE warning. Giving it now would require an override reason.
5. Decide. Hold the dose with a reason (for example "Wrong strength dispensed; pharmacy notified"), or override with a specific reason if you can defend it. ✓ *(checked automatically)*
   - You should see: The 09:00 cell shows Held (or Override) and your entry appears in the Administration history.
6. Read the Administration history below the grid: three earlier overrides. Then resolve TKT-1041 in Tickets with evidence, root cause, fix, and a message to Jordan. ✓ *(checked automatically)*
   - Link: [Open the Tickets queue](https://fordms.com/?view=tickets&role=analyst)

> **Analyst tip:** When staff override the same warning every shift, the warning is usually right and the process around it is broken. Look upstream (pharmacy stocking, product build) before you blame the scanner or the nurses.

### Part 4: Route a patient message (about 10 min)

1. Open the Portal for Elena Garcia as Nurse.
   - Link: [Open Elena Garcia's portal messages](https://fordms.com/?view=portal&patient=PT-003&role=nurse)
   - You should see: An English blood-pressure message with a suggested route, and a Spanish message that matched no routing rule.
2. Route the blood-pressure message to the suggested pool. ✓ *(checked automatically)*
   - You should see: Its status changes to "Routed → Clinical team pool".

> **Analyst tip:** Look at where the Spanish message would go. That is TKT-1049 (optional practice): rules that only match English keywords leave some patients without an owner.

### Part 5: Check your evidence and submit (about 15 min)

1. Confirm the Action evidence panel shows 10 of 10, then write 175–300 words and submit.

> **Analyst tip:** Strong answers quote the evidence (the exact warning text, the recipient on the In Basket item, the override history) and propose a fix aimed at the system, not at a person.

### What the app checks

- Write and sign a complete SOAP note
- Add an amendment without overwriting the signed note
- Place two orders, handling the warning you meet (2 needed)
- Acknowledge a result and assign accountable follow-up
- Route a patient portal message
- Scan a wristband and a medication on the eMAR
- Administer a scanned dose or hold it with a reason
- Resolve two A2 tickets with root cause and communication (2 needed)

### Written analysis

In 175–300 words: (1) for one ticket you resolved, state the root cause, the evidence that proves it, and the fix you recommended; (2) explain your eMAR decision (administer, hold, or override) and why; (3) explain how acknowledging Marcus Reed's result differs from closing the loop.

### Rubric (100 points)

| Criterion | Points | Standard |
| --- | --- | --- |
| Ticket investigation and root cause | 25 | Names the root cause, cites the specific evidence that proves it, and recommends a fix aimed at the system rather than an individual. |
| Medication safety (orders and eMAR) | 25 | Handles the order warning without an unjustified override; responds correctly to wrong-patient, look-alike, and dose warnings; administers or holds with a defensible reason. |
| Result and communication loop closure | 20 | Assigns follow-up to a named owner with a due date and routes patient communication appropriately. |
| Documentation integrity | 15 | Signs a source-supported SOAP note and uses an amendment rather than altering signed content. |
| Written analysis | 15 | Uses specific chart and audit evidence and acknowledges the limits of the simulation. |

## A3: Exchange, analytics, and revenue integrity

**Due:** Sunday, November 22, 2026 at 11:59 p.m. ET · **Time:** about 110 minutes · **Assignment id:** FORDMS-A3

### Your situation

It is the week before month-end close. Tanya Williams, the billing and coding manager, has three CO-16 denials, all on lab lines Dr. Patel ordered (TKT-1044). Rosa Méndez from Quality says the 4 West fall-reassessment rate fell from 88% to 61% the week the new flowsheet went live and wants a corrective action plan for nursing (TKT-1045). Outside records are also arriving through the HIE. Dana's advice: "Before anyone acts on a number, prove the number."

### Part 1: Reconcile outside records (about 20 min)

1. Open the HIE reconciliation inbox as Analyst.
   - Link: [Open the HIE inbox](https://fordms.com/?view=hie&role=analyst)
   - You should see: Five pending items with source, received time, identity confidence, and local versus incoming values.
2. Decide two items: Accept into chart, Keep local, or Defer. Compare identity confidence (below 85% is not auto-linked), timing, and specificity before you choose. ✓ *(checked automatically)*
   - You should see: Each decided card shows its status and a reviewer note.

> **Analyst tip:** An older, less specific, low-confidence record should never overwrite a newer, more specific local value. Deferring with a reason is a legitimate decision.

### Part 2: Prove the number (Quality's ticket) (about 35 min)

1. Open Query Studio. Run two different cohort definitions (for example "A1c ≥ 8%" and "Abnormal potassium"). ✓ *(checked automatically)*
   - Link: [Open Query Studio](https://fordms.com/?view=query-studio&role=analyst)
   - You should see: Each run lists matched patients, the denominator, and patients with missing or non-final values shown separately.
2. Write a validation note (80+ characters) that states the denominator, one patient you checked in the chart, and one limitation. Click Record validation. ✓ *(checked automatically)*
   - You should see: "Validation evidence recorded."
3. Open Analytics and find the Fall-risk reassessment panel. Read the report definition, then turn on "Include new flowsheet row FS-2203".
   - Link: [Open the quality panel in Analytics](https://fordms.com/?view=analytics&role=analyst)
   - You should see: The week of Sep 14 jumps from 61% to about 90% when the new row is included.
4. Resolve TKT-1045 in Tickets with the evidence you used, the root cause, and a message to Rosa that explains what to tell leadership. ✓ *(checked automatically)*
   - Link: [Open the Tickets queue](https://fordms.com/?view=tickets&role=analyst)

> **Analyst tip:** When a measure moves sharply the same week a build changed, suspect the measurement first. Check the definition, the data element it reads, and whether documentation moved.

### Part 3: Fix claims at the source (Tanya's ticket) (about 40 min)

1. Switch to Revenue Cycle and open Billing. In Charge review, select Elena Garcia's claim CLM-26-0412 and click Run scrubber. ✓ *(checked automatically)*
   - Link: [Open Billing](https://fordms.com/?view=billing&role=revenue-cycle)
   - You should see: A red edit: line 2 (83036 Hemoglobin A1c) has no diagnosis pointer.
2. Use the fix control on the edit to point line 2 to E11.9, then click Run scrubber again. ✓ *(checked automatically)*
   - You should see: "Correct claim" is recorded in the claim history and the scrubber shows no edits.
3. Click Submit claim. ✓ *(checked automatically)*
   - You should see: The claim moves to Submitted.
4. Open the Denials tab. Select one CO-16 denial (for example Noah Williams, CLM-26-0388), read the plain-language reason, choose an action, and write a note (for a CO denial, the patient cannot be billed). ✓ *(checked automatically)*
   - You should see: The claim moves to Denial worked with your action and note.
5. Look across all three CO-16 denials and the Elena Garcia edit: what do they share? Resolve TKT-1044 with evidence, root cause, fix, and a message to Tanya. ✓ *(checked automatically)*
   - Link: [Open the Tickets queue](https://fordms.com/?view=tickets&role=analyst)

> **Analyst tip:** Working denials one by one treats symptoms. If every denial shares an ordering provider and a missing field, the fix is in the build (order favorites, required fields), with a scrubber rule as the safety net.

### Part 4: Check your evidence and submit (about 15 min)

1. Confirm the Action evidence panel shows 10 of 10, then write 200–300 words and submit.

> **Analyst tip:** Put numbers in your analysis: 61% versus about 90%, three denials, one ordering provider. Numbers with their definitions are what leaders act on.

### What the app checks

- Reconcile two external clinical items (2 needed)
- Run two different population queries (2 needed)
- Record a denominator and patient-level validation
- Correct a claim that failed the scrubber
- Submit a clean claim
- Work a denial with the right action and a note
- Resolve the billing (TKT-1044) and quality (TKT-1045) tickets (2 needed)

### Written analysis

In 200–300 words: (1) compare your two reconciliation decisions; (2) state the exact cohort definition you validated and one data-quality limitation; (3) explain whether the fall-reassessment drop is real and how you know; (4) name the root cause of the CO-16 denials and the fix that prevents the next one.

### Rubric (100 points)

| Criterion | Points | Standard |
| --- | --- | --- |
| External record reconciliation | 20 | Uses provenance, identity confidence, timing, and discrepancy evidence for two resources. |
| Query validation and measurement | 25 | States the denominator and status logic, checks patient-level evidence, and identifies the fall-report artifact with numbers. |
| Revenue integrity | 25 | Corrects the edit at its source, submits a clean claim, and works the denial with an action allowed for the group code. |
| Ticket root cause and communication | 15 | Resolves both tickets with evidence, a system-level fix, and a clear message to the requester. |
| Written analysis | 15 | Separates what the data show from what they cannot establish. |

## A4: AI safety review and go-live readiness

**Due:** Sunday, December 6, 2026 at 11:59 p.m. ET · **Time:** about 105 minutes · **Assignment id:** FORDMS-A4

### Your situation

The steering committee meets Friday. Fordham Health wants to turn on AI-drafted patient replies and ambient AI notes in every clinic next month, the same month barcode medication administration (BCMA) goes live on 4 West. This morning Dr. Ravi Patel reported drafts that tell patients to stop medications (TKT-1046). Dana needs three things from you: a sentence-level safety review of a real AI draft, a judgment on the drafted replies clinicians are sending, and a go/no-go recommendation she can defend.

### Part 1: Sentence-level review of an AI visit summary (about 35 min)

1. Open AI Review as Analyst. The source encounter is on the left (lines S1–S10); the AI draft is on the right, split into twelve numbered sentences.
   - Link: [Open the AI draft review](https://fordms.com/?view=ai-review&patient=PT-001&role=analyst)
   - You should see: Twelve sentences, each marked "Not reviewed".
2. Click each sentence. Choose Supported, Unsupported, Contradicts source, Wrong patient detail, or Omission, and choose the source line that proves it (or "No source").
   - You should see: The counter reaches "12 of 12 classified".
3. Choose a disposition and write a reviewer note naming the most serious error. Click Finish review. ✓ *(checked automatically)*
   - You should see: "Review recorded." You will not see an answer key; your instructor sees your accuracy.

> **Analyst tip:** Read the source first, then the draft. A fluent sentence is not evidence. Watch for laterality, mechanism, invented exams or plans, details from another patient, and safety facts that are silently left out.

### Part 2: Oversee AI-drafted replies (about 20 min)

1. Switch to Physician/APP, open the In Basket, and select the AI Draft Replies folder.
   - Link: [Open AI-drafted replies](https://fordms.com/?view=in-basket&role=physician)
   - You should see: Drafted replies for Marcus Reed and Grace Kim (and more in the Nurse pool) marked "AI-drafted reply · review before sending".
2. For at least two drafts: compare the draft with the patient's message and chart, tick every issue you find, and choose Send as drafted, Edit and send, Discard and write own reply, or Discard and route to clinician. Click Complete. ✓ *(checked automatically)*
   - You should see: Each reviewed item moves to Done with your decision.
3. Resolve TKT-1046 in Tickets with evidence, root cause, fix, and a message to Dr. Patel. ✓ *(checked automatically)*
   - Link: [Open the Tickets queue](https://fordms.com/?view=tickets&role=analyst)

> **Analyst tip:** The clinician who clicks Send owns the reply. A good guardrail makes the safe path the easy path: block medication-change advice, require an edit or attestation, and monitor what is sent unedited.

### Part 3: Readiness and the go-live recommendation (about 35 min)

1. Switch to Implementation Lead and open Implementation. Read the evidence on all eight domains.
   - Link: [Open the readiness board](https://fordms.com/?view=implementation&role=implementation-lead)
   - You should see: Eight domain cards with owner, evidence, risk, and status; two high-risk domains are not ready.
2. Update at least three readiness decisions based on the evidence shown. ✓ *(checked automatically)*
   - You should see: Each updated card shows an Updated timestamp.
3. Record a recommendation (No go, Conditional go, or Go) and complete every safeguard field. ✓ *(checked automatically)*
   - You should see: "Go-live recommendation recorded in the audit trail."

> **Analyst tip:** Pair every outcome measure with a balancing measure (for example: faster replies versus unsafe advice sent) and make the rollback trigger a number someone can check on day three.

### Part 4: Check your evidence and submit (about 15 min)

1. Confirm the Action evidence panel shows 8 of 8, then write 225–350 words and submit.

> **Analyst tip:** Tie your recommendation to what you found today: the draft errors, the unsafe replies, and the open high-risk domains.

### What the app checks

- Complete the sentence-level AI draft review
- Review two AI-drafted In Basket replies (2 needed)
- Update at least three distinct readiness domains (3 needed)
- Record a release recommendation with safeguards
- Resolve Dr. Patel's AI ticket (TKT-1046)

### Written analysis

In 225–350 words: identify the most clinically material errors in the AI draft and how you found them; explain what you did with each AI-drafted reply and why; recommend go, conditional go, or no-go; and name an owner, an outcome measure, a balancing measure, and a rollback trigger.

### Rubric (100 points)

| Criterion | Points | Standard |
| --- | --- | --- |
| AI draft error detection | 30 | Finds the clinically material errors, classifies them accurately, and cites the source line for each; few false flags. |
| Oversight of AI-drafted replies | 20 | Does not send unsafe drafts; edits or discards with the specific issue named; resolves the AI ticket with a system-level fix. |
| Implementation readiness judgment | 20 | Updates three or more domains using the displayed evidence rather than optimism. |
| Go-live recommendation and safeguards | 20 | States conditions, ownership, outcome and balancing measures, monitoring, and a usable rollback trigger. |
| Written analysis | 10 | Keeps humans accountable and names the limits of the simulation. |
