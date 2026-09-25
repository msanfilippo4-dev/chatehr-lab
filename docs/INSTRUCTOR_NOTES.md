# FordMS v5 clinical revamp: instructor notes

These notes cover what changed, how live student work is protected, what you need to do (very little), and the answer keys for the parts of A2–A4 that are scored automatically for you.

The student-facing guides are in [`ASSIGNMENT_GUIDES.md`](ASSIGNMENT_GUIDES.md). They are generated from the same source as the in-app guide, and a unit test keeps the two identical.

## 1. What changed

**Framing.** The student is now the clinical informatics analyst at Fordham Health, reporting to Dana Okafor (clinical informatics manager). Every assignment opens with a "Your situation" paragraph, and most of the work arrives as tickets from named staff.

**Charts.** All twelve patients now have hand-authored, clinically coherent charts:

- problems with ICD-10-CM codes;
- medications with dose, route, frequency, prescriber, and indication;
- allergies marked as allergy or intolerance;
- vitals series (3–4 dates);
- labs with units, reference ranges, flags, LOINC codes, and ordering clinician;
- one or two prior signed notes, a care team, a PCP, and encounters.

Two patients are inpatients on 4 West: Sofia Petrov with pneumonia (DNR/DNI, 415-A) and James O'Brien with acute on chronic systolic heart failure (412-B). Each chart supports a course story:

| Patient | Story |
| --- | --- |
| Marcus Reed | Critical potassium 6.1 sitting in an absent NP's inbox |
| James O'Brien | Heart failure, CKD, and diabetes medication complexity |
| Elena Garcia | Home blood-pressure messages in Spanish |
| Mateo Rivera | Proxy access and a confidential adolescent note |
| Devon Brooks | Chosen name and pronouns versus the legal name on coverage |
| Priya Shah | Interpreter needs |
| Liu Huang / Liu H. | Duplicate identity; AI scribe laterality error |

Identity fields (id, MRN, name, DOB) did not change. The PT-001/PT-012 duplicate signals (address, phone) did not change either.

**New views**, each writing audit events:

- **eMAR** (Nurse). Barcode scanning with:
  - a hard stop for the wrong patient: the roommate, "Sofia Petrova";
  - a hard stop for a look-alike drug: metoprolol succinate ER, and hydrOXYzine for hydrALAZINE;
  - warnings for a wrong dose (50 mg tablet for a 25 mg order) and for a late dose;
  - hold and override with a reason, PRN doses with a pain score, and an administration history.
- **Flowsheets** (Nurse). A live simplified NEWS2 early warning score. Filing a high score runs a sepsis screen and creates a rapid-response task. The fall-reassessment row is FS-2203.
- **In Basket** (Physician/APP and Nurse pools). Results, advice requests, refills, co-sign requests, and AI-drafted replies that must be sent, edited, or discarded.
- **Billing & claims** (new Revenue Cycle role). A claim scrubber that checks for:
  - a missing diagnosis pointer;
  - modifier 25 documentation;
  - inactive eligibility;
  - a missing referral.

  Claims are fixed, then submitted. A denial work queue explains CO-16 and CO-197 in plain language; billing the patient for a CO denial is blocked.
- **Analyst Tickets** (Analyst). Ten tickets, each tied to a problem planted in the data. Each is worked in three steps:
  1. triage;
  2. investigate, with deep links and evidence check-offs;
  3. resolve, with a root cause, a fix, who to notify, and a message to the requester.

**AI Review (fixed).** The student no longer ticks pre-labeled findings. The source encounter (S1–S10) sits on the left and the AI draft on the right, split into 12 numbered sentences. The student classifies each sentence and cites a source line. The key is used only on the server.

**Navigation and UI.**

- Every screen has a URL, for example `/?view=emar&patient=PT-008&role=nurse`, and back/forward work. Deep links switch to a role that can see the target view.
- A grouped left rail: Workspace, Clinical, Front office, HIM, Revenue cycle, Analytics, Informatics, Course.
- A dark top bar with quick patient search, a role switcher, and a Workspace menu (Export evidence, Import, Reset all, Sign out).
- A patient banner with allergy, code-status, and flag chips.
- Refreshed cards and tables to match the slide mocks. The large one-line components were split into readable ones.

**Instructor view.** The submission review has a new **Auto-checks against the answer key** panel (see section 4).

## 2. How live work is protected

- **Workspace version 3 → 4.** The migration is non-destructive and runs in the browser and on the server whenever a workspace is read.
  - Every existing collection, audit event, and id is kept, including learner notes, registered patients, appointments with their history, routed messages, completed tasks, and the MPI decision.
  - Seeded charts gain the new clinical detail. Seeded prior notes are placed before the learner's own notes.
  - The old placeholder addresses ("127 Example Avenue…") are replaced, except the PT-001 and PT-012 addresses that A1 depends on.
  - New seed rows (messages, tasks, appointments) are added only where their ids are absent.
  - The new slices (MAR, flowsheets, In Basket, claims, tickets) are added from the seed.
  - Unit tests run a faithful copy of a mid-A1 v3 workspace through the migration and check it is lossless, idempotent, and leaves A1 progress unchanged.
- **Action names.** The `ACTION` strings were only appended to (14 new ones). No existing value changed.
- **A1 is unchanged.** Id, due date, weight, requirements, and rubric are the same; only the guide text and deep links are new. A2–A4 keep their ids, due dates, and weights, but their content was rewritten (none had meaningful student work).
- **Published configurations still show the new views.**
  - All 19 published versions so far were created by automated test runs from the old defaults.
  - A published config without `meta.contentRevision` (or below 5) is upgraded when it is loaded:
    - role views become the union of the published and default views;
    - the new roles are added, with Nurse and Physician/APP inheriting the legacy Clinical views;
    - catalogs gain the new rows, published rows win, and "Crescent Health" is renamed "Fordham Health";
    - A1–A4 content comes from the new defaults, while each assignment's published due date, release state, and weight are kept.
  - The upgraded config is stamped `contentRevision: 5`. A later publish from the Admin console is therefore authoritative and is never upgraded again.
- **Database.** No database migration is needed; nothing was added after 013. The server now accepts workspace version 4 and stores `schema_version = 4` in `ehr_user_workspaces`.

## 3. Instructor actions

**Required:** none. You deploy as usual.

**Recommended:**

1. **Tell students.**
   - A1 is unchanged. A guide was added, and the app now opens as the Analyst.
   - The "Clinical" role is now Nurse and Physician/APP.
   - Workspace actions (Export, Import, Reset all, Sign out) are in the Workspace menu at top right.
2. **Optional: republish the configuration from Admin** to lock in the upgraded content as a real version.
   - While doing so, delete the ICD-10-CM rows labeled "Teaching example added in test" (codes Z99.xx). Earlier automated test runs published those rows, and students currently see them in the Coding tab.
   - Once you publish, your edits to roles, assignments, and catalogs are respected exactly as published.
3. **Rolling back.** Once students have saved under v5, their workspaces are version 4. The pre-v5 build rejects version 4, so after a rollback it would show those students a fresh workspace. Their audit events stay on the server.
   - If you must roll back, first change the pre-v5 `normalizeState` check in `lib/db.ts` from `[1, 2, 3]` to `[1, 2, 3, 4]`, or redeploy v5.
4. **E2E test run.** The admin e2e test publishes a configuration version to the course database. It now republishes the previously live version at the end. If that test fails partway, restore the prior version in Admin → Versions.
5. **Configuration version history from this work.** Running the e2e suite during this revamp added versions 20–25 in Admin → Versions:
   - v20, v22, and v24 are test publishes;
   - v21, v23, and v25 restore the v19 content;
   - v21 was restored by hand after one interrupted test run, before the admin test learned to restore itself.

   The live published version is v25, which has the same content as v19. No action is needed.
6. **Slide screenshots.** `../assets/screens/01–28` were recaptured. The instructor screens (18, 19) now show only this run's synthetic capture account. Previous captures could show the first real enrolled student, because the gradebook preselects the first roster row. If any older slide still uses an earlier 18 or 19 image, replace it.
7. **Known test failures.**
   - One unit test in `tests/unit/quizzes.test.ts` expects only weeks 1–2 in the installed quiz bank; the bank now has all 12 weeks.
   - One e2e test ("the quiz list shows all twelve weeks with window status") fails for the same reason: it expects starting week 12 to return 404, but the week now exists and returns 409.

   Both belong to the quiz module and were left untouched, as requested.

## 4. Auto-checks and answer keys

The keys live in `lib/server/answer-keys.ts`. A unit test ensures no browser component imports it. In Gradebook, open a submission: the **Auto-checks** panel shows the student's current results from their workspace.

### A4: AI draft review (Liu Huang visit summary)

| Sentence | Draft text (abridged) | Key | Also accepted | Source |
| --- | --- | --- | --- | --- |
| D1 | 42-year-old woman, shoulder follow-up | Supported | | S1 |
| D2 | Worsening **left** shoulder pain **after a fall** | Contradicts source | | S2, S3 |
| D3 | Improves with rest; denies fever, weakness, numbness | Supported | | S3 |
| D4 | BP 124/78, HR 72 | Supported | | S4 |
| D5 | Lateral shoulder tenderness, pain-limited range | Supported | | S5 |
| D6 | "Neurologic examination is normal" | Unsupported | Contradicts source | S5 (not performed) |
| D7 | "Type 2 diabetes well controlled on metformin" | Wrong patient detail | Unsupported, Contradicts | S6, S8 |
| D8 | Assessment: bursitis of the right shoulder (M75.51) | Supported | | S6 |
| D9 | Amoxicillin, MRI, oxycodone | Unsupported | Contradicts source | S9, S10, S7 (penicillin allergy) |
| D10 | "Medications and allergies reviewed with no changes" | Omission | Contradicts, Unsupported | S7, S8 (allergy and naproxen omitted) |
| D11 | PT referral; follow-up in four weeks | Supported | | S9 |
| D12 | "Verbalized understanding … in English" | Contradicts source | Unsupported, Wrong patient detail | S1 (Mandarin interpreter) |

The Auto-checks panel reports:

- **Found X of 6.** Any non-Supported label on a planted error counts as found.
- **Classified correctly.** The label is in the accepted set.
- **Cited correctly.** The source line is in the key.
- **False flags.** A supported sentence was flagged, and the panel lists which ones.

The most clinically material error is D9 (amoxicillin despite a severe penicillin allergy), followed by D2 and D6. The expected disposition is "Reject and redraft from the source" or "Edit and retain with corrections". "Accept without changes" is blocked when any sentence is flagged.

### A4: AI-drafted In Basket replies

| Item | Patient | Safe to send as drafted? | Expected issues |
| --- | --- | --- | --- |
| IB-008 | Marcus Reed | No | Tells him to stop lisinopril on his own and to eat high-potassium foods; no urgent follow-up |
| IB-009 | Grace Kim | No | Wrong pharmacy (CVS Broadway instead of Walgreens, Northern Blvd) |
| IB-010 | Elena Garcia | No | English reply to a Spanish message; doubles amlodipine without a clinician decision |
| IB-011 | Devon Brooks | Yes | Accurate and appropriate |

The panel flags an "Unsafe send" when a student chose "Send as drafted" on IB-008, IB-009, or IB-010, and shows how many expected issues they ticked.

### Tickets (all assignments)

The correct root-cause option sits in a different position for each ticket; students see no correctness feedback. Evidence items E1–E3 are the expected evidence unless the table notes otherwise; the other items are distractors. The panel checks root cause, evidence hits and distractors, triage category and priority, and whether the must-notify people were ticked.

| Ticket | Assignment | Requester | Expected root cause | Category / priority | Must notify |
| --- | --- | --- | --- | --- | --- |
| TKT-1041 | A2 | Jordan Park, RN | Pharmacy stocks 50 mg tablets for a 25 mg order. The scanner is right, and nights override it (three overrides in 48 h). Fix the stocking/product build and stop the workaround. E5 (hold parameters) is also reasonable. | Safety or Break-fix / High–Urgent | Pharmacy operations manager; 4 West nurse manager |
| TKT-1042 | A2 | Dana Okafor | The critical K 6.1 went to Sam Brooks, NP's personal In Basket while he was out of office with no delegate. The critical-result escalation rule is inpatient-only, and the lab call reached after-hours voicemail. Fix: delegation/surrogates, a pool for criticals, and a callback policy to the covering provider. | Safety / Urgent–High | Sam Brooks, NP; Laboratory director |
| TKT-1043 | A2 | Dr. Lin Chen | The 9/14 note came from an AI scribe draft accepted without correction. There was no post-signature edit; the author amends. Recommend review and attestation for scribe drafts. | Safety, Training, or Break-fix / Medium–High | HIM record integrity |
| TKT-1044 | A3 | Tanya Williams | Dr. Patel's lab order favorites carry no diagnosis association, so lab lines drop without a pointer (three CO-16/M76 denials plus Elena's scrubber edit). Fix the build, correct and resubmit, and keep the scrubber rule as a safety net. | Break-fix / High–Medium | EHR build team (orders); Dr. Ravi Patel |
| TKT-1045 | A3 | Rosa Méndez, RN (Quality) | Measurement artifact. The report counts only the retired row FS-1180; reassessments moved to FS-2203 on 9/14. The Sep 14 week is 61% as reported and about 90% recalculated. Fix the report, not nursing practice. | Data request or Break-fix / High–Medium | Reporting and analytics team |
| TKT-1046 | A4 | Dr. Ravi Patel | The drafting tool has no guardrail against medication-change advice, and staff can send drafts without editing or attesting. Fix: block medication advice, require edit/attestation, monitor sends of unedited drafts, and escalate to AI governance. | Safety / Urgent–High | AI governance committee |
| TKT-1047 | A1 (optional) | Maria Diaz | A phone quick-registration created "Liu H." without a search. Book into MRN 6105100 after two-identifier verification; HIM decides any merge. | Training, Data request, or Break-fix / Medium–High | HIM identity team |
| TKT-1048 | Practice | Dr. Lin Chen | The potassium alert fires on any potassium ever flagged High, with no lookback or threshold (412 firings, 97% overridden). Fix: add a lookback and threshold, then re-measure. | Enhancement / Medium–High | Clinical decision support committee |
| TKT-1049 | Practice | Ana Torres, RN | Routing rules match English keywords only, so Spanish messages fall to an unowned pool. Fix: language-based routing and an owned fallback pool. | Break-fix, Enhancement, or Safety / High–Medium | Patient portal team; Language access services |
| TKT-1050 | Practice | Keisha Grant (HIM privacy) | Proxy access stayed "full" after Mateo turned 12, and the confidential note is visible to the proxy. Fix: age-based proxy scopes and confidential-note filtering. | Safety / Urgent–High | Privacy officer |

### A2: eMAR and orders

- **Sofia Petrov, metoprolol tartrate 25 mg at 09:00** (overdue at the simulated time of 10:15):
  - roommate wristband → WRONG PATIENT hard stop;
  - metoprolol succinate ER 25 mg → LOOK-ALIKE hard stop;
  - tartrate 50 mg tablet → DOSE MISMATCH plus LATE warning.
- **Model answer:** hold with "Wrong strength dispensed; pharmacy notified". An override needs a specific, defensible reason, for example a pharmacist-verified 25 mg product.
- **Orders.** Lisinopril for Marcus Reed fires the potassium interaction warning. The strong path is not to override: order the potassium binder (sodium zirconium cyclosilicate) plus a repeat BMP. Amoxicillin for Liu Huang still fires the penicillin allergy alert.
- **Result follow-up.** IB-001 "Acknowledge and create follow-up task" credits the result-and-follow-up requirement. So does "Create follow-up" in Orders & Results.

### A3: billing and data

| Claim | Scrubber edit | Correct fix |
| --- | --- | --- |
| CLM-26-0412 (Elena Garcia) | Line 2 (83036) missing pointer | Point to E11.9 |
| CLM-26-0415 (Noah Williams) | Modifier 25 without documentation | Link the note (a separate BP evaluation) or remove the E/M line |
| CLM-26-0410 (Mateo Rivera) | Eligibility inactive | Re-verify; new CHP member ID CHP-77120 |
| CLM-26-0418 (Grace Kim) | HMO referral missing | Attach REF-2026-0908-KIM |
| CLM-26-0402 (Liu Huang) | None | Submit (clean) |

- **Denials:**
  - CLM-26-0388, CLM-26-0391, and CLM-26-0379 are CO-16/M76 on Dr. Patel's lab lines. Correct and resubmit.
  - CLM-26-0366 is CO-197 on James O'Brien's echocardiogram. Request retro-authorization or appeal.
  - "Transfer balance to patient" is blocked for CO denials.
- **Queries.** A validated query should state the denominator and final-status logic and name a patient-level check. The A1c pending for Sofia Petrov is the missingness example.

## 5. Where things live

| Area | Files |
| --- | --- |
| Seeds | `lib/seeds/patients.ts`, `inpatient.ts`, `inbasket.ts`, `billing.ts`, `tickets.ts`, `quality.ts` |
| Rules | `lib/clinical/ews.ts` (EWS and sepsis screen), `mar.ts` (five rights), `billing.ts` (scrubber and denials), `ai-review.ts` (draft and source only) |
| Migration and config | `lib/db.ts` (`normalizeState`, `upgradeSeedPatient`), `lib/config/upgrade.ts` |
| Assignments and navigation | `lib/assignments.ts` (content and guides), `lib/navigation.ts` (URLs and roles) |
| Instructor keys | `lib/server/answer-keys.ts`, `lib/server/assignment-benchmarks.ts` |
| Tests | Unit: `tests/unit/v4.test.ts`, `tests/unit/guides-doc.test.ts`. E2E: `tests/e2e/student-a1…a4`, `emar-flowsheets`, `tickets-navigation` |
