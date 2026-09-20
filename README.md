# FordMS EHR

FordMS EHR is the authenticated simulation environment for Fordham HINF 6105. Students sign in with a verified `@fordham.edu` Google account. The application combines front-desk, clinical, HIM, analytics, patient, and implementation workflows in one longitudinal synthetic record. All patients and clinical events are fictional.

The course includes four individual FordMS assignments. Each assignment takes approximately 1–2 hours, calculates progress from timestamped EHR actions, accepts a written analysis, and appears in the instructor gradebook for scoring and feedback.

## Course assignments

1. **FORDMS-A1 — Identity, access, scheduling, and coding:** resolve a possible duplicate, create and reschedule an appointment, and distinguish ICD-10-CM from CPT examples.
2. **FORDMS-A2 — Clinical documentation, orders, results, and patient follow-up:** complete a SOAP note and amendment, respond to warnings, and close results and communication loops.
3. **FORDMS-A3 — Interoperability, provenance, and population analytics:** reconcile external records, run computable cohorts, and validate patient-level evidence.
4. **FORDMS-A4 — AI safety review and implementation readiness:** identify unsupported draft content, evaluate readiness evidence, and record a release recommendation with monitoring and rollback conditions.

## Account and grading model

- Google OAuth accepts verified `@fordham.edu` accounts only.
- JWT sessions expire after eight hours.
- Each student has an isolated cloud workspace, action history, progress record, assignment submission, grade, and feedback.
- Instructors can view all enrolled users, inspect captured evidence, apply the published 100-point rubric, and return written feedback.
- Private instructor benchmarks are loaded only by the protected instructor API and are not included in the student bundle.
- IndexedDB remains a local recovery copy. JSON export/import provides an additional portable backup.

## Local development

Requirements: Node.js 20.9 or later and a Supabase project.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Configure the variables in `.env.local`, then apply [`supabase/migrations/008_hinf6105_practice_ehr.sql`](supabase/migrations/008_hinf6105_practice_ehr.sql) to the course database. Open `http://localhost:3000` and sign in with a Fordham account.

Required variables:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INSTRUCTOR_EMAILS`

The Google OAuth client must allow the local and production NextAuth callback URLs:

- `http://localhost:3000/api/auth/callback/google`
- `https://fordms.com/api/auth/callback/google`

## Production build

```bash
npm run build
npm start
```

The application requires a server-capable Next.js deployment because login, synchronization, submission, and grading use protected route handlers. Production is published at [fordms.com](https://fordms.com/).

## Role-based simulations

- Front desk: patient search, scheduling, conflict detection, check-in, cancellation, and rescheduling.
- Clinical: longitudinal charts, SOAP notes, signed-note amendments, orders, warnings, results, portal messages, and scripted AI review.
- HIM: master patient index adjudication and exchange reconciliation with provenance.
- Analyst: computable cohort definitions, SQL-style logic previews, patient-level validation, saved query runs, and stratification.
- Implementation lead: evidence, ownership, risk, and readiness decisions across eight implementation domains.
- Patient: a plain-language portal view for medicines, results, messages, and reconciliation requests.

## Teaching safeguards

- Every patient and event is labeled synthetic.
- Signed notes remain in history; amendments create new entries.
- Medication and duplicate-order warnings are teaching simulations.
- The AI review screen uses a scripted draft, not a live model.
- HIE resources, FHIR-style labels, match confidence values, and implementation evidence are authored course simulations.
- Server routes verify the Fordham session and course role before reading or writing records.
- Database tables use row-level security with no direct browser policies; the service-role key remains server-side.
- Reset requires browser confirmation and returns the learner to the synthetic starting state.
- Storage or synchronization failures leave the active session usable and prompt the learner to export evidence.

## Instructor preparation

1. Confirm that the Google OAuth callback, Supabase migration, and Vercel environment variables are current.
2. Add instructor addresses to `INSTRUCTOR_EMAILS` and verify that the Gradebook tab is visible.
3. Test one student account through sign-in, action sync, submission, grading, feedback, sign-out, and sign-in recovery.
4. Test Chrome and Safari, including keyboard navigation and local-storage recovery.
5. Keep EHR Go enrollment keys and private Blackboard links outside this repository.
