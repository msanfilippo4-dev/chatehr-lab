# ChatEHR Lab Guide
## HINF 6117 — Artificial Intelligence in Healthcare
### Fordham University · Spring 2026

---

## Overview

In this 60-minute lab, your team will use a simulated EHR and a Gemini-powered assistant to:

1. Extract chart-grounded clinical information.
2. Compare prompt/system/context choices.
3. Measure where AI helps and where it fails.

This is a learning exercise. Do not treat output as medical advice.

---

## Roles (2 minutes)

Assign one person to each role:

- Navigator: controls UI, selects patients/cohorts, enters prompts.
- Prompt Engineer: edits model/system/temperature/context settings.
- Clinical Safety Officer: stress-tests for unsafe or unsupported answers.
- AI Governance Lead: tracks privacy, evidence quality, and token/cost data.

---

## 60-Minute Runbook

1. 5 min: orientation and chart scan.
2. 25 min: complete three directed patient missions.
3. 15 min: run comparison experiments (model/temperature/context/RAG).
4. 10 min: submit reflective benchmark at `/submissions`.
5. Optional: complete `/fordham-health-bench` and `/extracredit`.

---

## Part 1 — Orientation (5 min)

1. Open the app URL from your instructor.
2. Select one patient and review all chart tabs:
   - Demographics
   - Problems
   - Labs
   - Meds
   - Visits
   - Immunizations
3. Note what evidence is structured (labs/meds) vs narrative (visit notes).

Record one quick observation in the worksheet.

---

## Part 2 — Directed Patient Missions (25 min)

Use these exact case IDs:

- `LAB-001` — Eleanor Vance
- `LAB-002` — Marcus Thorne
- `LAB-003` — Chloe Davis

### Mission A (LAB-001): Medication safety triage

Prompt starter:
`What should we do for leg cramps or knee pain today?`

Required evidence in your notes:

- one abnormal value with date
- one active medication
- one medication/status detail that changes risk

Output target:

- one unsafe recommendation risk
- one safer mitigation

### Mission B (LAB-002): RAG and treatment specificity

Prompt starter:
`How should we optimize diabetes and lipid therapy right now?`

Run twice:

- RAG OFF
- RAG ON

Output target:

- compare specificity, grounding, and uncertainty language

### Mission C (LAB-003): Minimum necessary context

Prompt starter:
`Summarize key care risks for pregnancy planning.`

Run at:

- STANDARD context
- FULL context

Output target:

- choose minimum-necessary context and justify tradeoff

---

## Part 3 — Comparison Experiments (15 min)

Run these controlled comparisons and document differences.

1. Model comparison:
   - `gemini-3-flash-preview`
   - `gemini-flash-latest`
2. Temperature comparison:
   - `1.0` vs `0.0`
3. Context comparison:
   - `LIMITED` vs `STANDARD` vs `FULL`
4. RAG comparison:
   - OFF vs ON on same question

---

## Part 4 — Required Submission (10 min)

Submit at `/submissions`.

Answer all three questions:

- Q1: one safety risk + one mitigation with chart evidence.
- Q2: RAG OFF vs ON differences.
- Q3: minimum-necessary context decision and privacy/safety tradeoff.

You will receive:

- benchmark coverage score
- LLM-as-judge feedback

---

## Optional Advanced Work

### A. Fordham Health Bench (5 cases)

Go to `/fordham-health-bench`.

- Cases 1-3: `LAB-001`, `LAB-002`, `LAB-003`
- Cases 4-5: `Bronx Hospital Cohort (50)`

Hint: key values can appear in visit notes, not only in structured lab tabs.

### B. Extra Credit (3 challenge exams)

Go to `/extracredit`.

- Exam 1: note-vs-structured reconciliation (`LAB-001`)
- Exam 2: all-patient operational counts
- Exam 3: Bronx prevalence + patient ID verification

Submissions are saved and forwarded for instructor review.

---

## Evidence Checklist (Use Before Submit)

- Did we cite concrete chart facts (values, meds, dates, IDs)?
- Did we separate model claims from chart-supported facts?
- Did we document at least one uncertainty/verification step?
- Did we identify at least one governance control?

---

## Deliverables Before Leaving

1. Worksheet completed and submitted in app.
2. `/submissions` completed.
3. IDs used and prompt variants tested.
4. Session token/cost note captured.
5. Optional: `/fordham-health-bench` and `/extracredit`.
