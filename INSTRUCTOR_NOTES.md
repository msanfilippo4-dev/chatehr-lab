# Instructor Notes — ChatEHR Lab
## HINF 6117 · Spring 2026

---

## Pre-Lab Technical Checklist

Run this sequence before class:

1. `npm install`
2. `npm run generate`
3. `npm run validate:data`
4. `npm run dev`
5. Sign in with a Fordham account and test:
   - patient selection
   - chat response
   - RAG toggle
   - worksheet submit
   - `/submissions`
   - `/fordham-health-bench`
   - `/extracredit`

If deploying:

1. Ensure env vars on Vercel:
   - `GEMINI_API_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_SECRET`
   - `RESEND_API_KEY` (optional but recommended)
   - `RESEND_FROM_EMAIL` (optional)
   - `EXTRACREDIT_NOTIFY_EMAIL` (optional)

---

## Canonical Directed Cases

Use these exact patient IDs/names in class:

- `LAB-001` — Eleanor Vance
- `LAB-002` — Marcus Thorne
- `LAB-003` — Chloe Davis

Do not reference alternate names in slides or debrief.

---

## Timing (60 min)

1. 5 min — orientation
2. 25 min — directed missions
3. 15 min — controlled experiments
4. 10 min — required submission (`/submissions`)
5. 5 min buffer/debrief (or optional advanced tasks)

Optional stretch work:

- `/fordham-health-bench` (5 extraction cases)
- `/extracredit` (3 challenge exams)

---

## Learning Objectives

By end of class students should be able to:

1. Explain how prompt/system/context choices alter behavior.
2. Distinguish structured chart facts vs narrative note facts.
3. Apply minimum-necessary data principles to LLM prompting.
4. Compare RAG ON/OFF answer grounding.
5. Document one concrete safety control and one verification step.

---

## Directed Mission Guidance

### Mission A (LAB-001)

Prompt starter:
`What should we do for leg cramps or knee pain today?`

Expected teaching point:

- note-derived potassium can conflict with structured labs
- active vs discontinued meds materially change risk

### Mission B (LAB-002)

Prompt starter:
`How should we optimize diabetes and lipid therapy right now?`

Expected teaching point:

- RAG ON generally improves specificity and evidence language
- key values may appear in narrative note text

### Mission C (LAB-003)

Prompt starter:
`Summarize key care risks for pregnancy planning.`

Expected teaching point:

- FULL context can expose unnecessary detail
- students should justify a minimum-necessary choice

---

## Required Student Submission

`/submissions` is required and includes:

- deterministic rubric benchmark
- LLM-as-judge formative feedback
- saved submission + scoped analytics

Instructor can review class-wide analytics via professor account.

---

## Optional Advanced Activities

### Fordham Health Bench (`/fordham-health-bench`)

Designed for deterministic extraction checks.

- Cases 1-3: golden patients (`LAB-*`)
- Cases 4-5: Bronx 50 cohort

Current deterministic Bronx constraints:

- Flu recipients in Bronx 50: **34**
- A1c >= 8 in Bronx 50: **12**

### Extra Credit (`/extracredit`)

Three challenge exams, saved and optionally emailed to instructor.

---

## Troubleshooting

### Slow response (10-20s)

Possible causes:

- large context payload (especially FULL)
- free-tier API throttling
- long conversation history

Current app mitigations include bounded history and latency telemetry.

### Model error

Use models from dropdown only:

- `gemini-3-flash-preview`
- `gemini-flash-latest`
- `gemini-flash-lite-latest`

### Dataset drift suspicion

Rebuild and verify:

1. `npm run generate`
2. `npm run validate:data`

Do not run lab if validation fails.

### Email forwarding missing

Check:

- `RESEND_API_KEY`
- sender domain and `RESEND_FROM_EMAIL`
- domain DNS verification state

Submissions still save locally even when email forwarding fails.

---

## Debrief Prompts

Use 2-3 of these:

1. Which answer looked confident but lacked chart evidence?
2. Where did FULL context improve quality, and where did it over-share?
3. What governance control would you require before clinical deployment?
4. Did RAG improve correctness, or only wording confidence?
5. Which prompt setting had the largest effect on risk?
