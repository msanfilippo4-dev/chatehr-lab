# FordMS EHR

FordMS is the authenticated practice electronic health record for Fordham University's HINF 6105 Electronic Health Records course. It is a teaching simulation: every patient, result, warning, match score, and AI draft is synthetic and scripted. It is not a certified clinical system and must never be used for patient care.

Production: <https://fordms.com/> (Vercel, deployed from the `main` branch of the course repository).

## What students get

- Sign-in with a verified `@fordham.edu` Google account; sessions last eight hours.
- The learner is the clinical informatics analyst at Fordham Health (manager: Dana Okafor). Twelve hand-authored fictional charts (ICD-10-CM problems, dosed medications, allergies versus intolerances, vitals series, LOINC-coded labs with ranges, prior signed notes, care teams, encounters; two 4 West inpatients) and eight simulated roles (Analyst, Front Desk, Nurse, Physician/APP, HIM, Revenue Cycle, Implementation Lead, Patient) with a grouped left navigation (Workspace, Clinical, Front office, HIM, Revenue cycle, Analytics, Informatics, Course).
- Every screen has a URL (`/?view=emar&patient=PT-008&role=nurse`, quizzes at `/quizzes`); back/forward work, and assignment guides and tickets deep-link into the right view, role, and patient.
- v5 clinical modules: eMAR with barcode scanning (wrong-patient and look-alike hard stops, dose/late warnings, hold and override reasons, PRN pain scores), Flowsheets with a simplified NEWS2 early warning score and sepsis-screen escalation, In Basket (results, advice requests, refills, co-sign, AI-drafted replies to review), Billing & claims (scrubber edits, corrected claims, CO-16/CO-197 denial work queue), and an Analyst Tickets service desk (triage → investigate → resolve with root cause and communication).
- Workflows: registration with duplicate prevention, eligibility verification, referrals, scheduling with conflict and availability rules, reminders, no-shows, wait-list, MPI identity review, SOAP documentation with templates, copy-forward safeguards, signing, co-signature and amendments, orders with allergy, duplicate and interaction alerts plus override reasons, result acknowledgment and owned follow-up tasks, portal messaging with routing rules and proxy access, HIE reconciliation with provenance and match confidence, population queries with denominators, missingness and stratification, scripted AI draft review with an error taxonomy, implementation readiness and go-live recommendations, audit review, release of information, and downtime drills.
- Four graded assignments (FORDMS-A1 to A4) that together form the FordMS share (18%) of the Applied EHR activities category (30%); each assignment counts equally. Each has an in-app step-by-step guide (situation, parts with time estimates, deep links, "You should see…" confirmations, analyst tips) that ticks off as audit evidence arrives; the same text is in `docs/ASSIGNMENT_GUIDES.md`. Instructor notes and answer keys are in `docs/INSTRUCTOR_NOTES.md`. Progress is computed on the server from timestamped audit events, each required action is credited once per distinct item, imported evidence is labeled separately, submissions are versioned, and the instructor can return work for revision.
- Weekly quizzes at `/quizzes` (also `/quiz`). Graded weeks 1, 3, 4, 6, 7, 9: two attempts, highest kept, lowest graded week dropped, 6 questions drawn at random from each week's pool with shuffled options, a 15-minute timer, a window from Monday 9:00 PM ET to Sunday 11:59 PM ET, and answers/rationales shown only after the close. Other weeks are untimed review quizzes with unlimited attempts and immediate feedback. Week 1 is a legacy quiz (fixed six items, no timer) so attempts already recorded stay valid. The bank is authored in `v5/build` and installed with `npm run import:quiz-bank` (validates `../../v5final/quiz-bank.json` and writes `lib/server/quiz-bank.json`); weeks not in the bank show as "Not yet available". Timers, draws, per-week settings, and extensions need migration `012_fordms_quiz_windows.sql`; without it quizzes fall back to fixed, untimed questions. Check with `npm run check:migration`. Instructors manage settings, extensions, results, item analysis, and CSV exports in Gradebook → Quizzes.
- A cloud workspace per account, a local IndexedDB recovery copy, and versioned JSON export and import.

## What instructors get

- Roster with enrollment state, status filters (not started, in progress, ready, submitted, revision requested, graded), search, and test-account hiding.
- Per-criterion rubric scoring, partial saves, grade release, return-for-revision with comments, submission version history, evidence bundles with chart context and provenance badges, and an append-only grading log.
- Read-only preview of any student's workspace, scoped or full resets that snapshot first and never touch submissions, cohort analytics with explicit denominators, and a Blackboard-ready CSV export (0-100 or course-percent scale).
- An admin console that versions and audits the entire course configuration: ICD-10-CM and CPT teaching catalogs, insurers and coverage fields, organizations, facilities, departments, locations, specialties, provider roles and providers with availability, visit types, note templates, appointment rules, medication and laboratory examples, alert rules, message categories and routing rules, simulated role views, assignment definitions with requirements and rubrics, release states and due dates. Publishing archives the previous version; any version can be restored.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values from the course vault
npm run dev
```

Apply the migrations in `supabase/migrations/` to the course database in order (`008_hinf6105_practice_ehr.sql`, `009_fordms_course_ops.sql`, `010_fordms_versions_delete.sql`, `011_fordms_quizzes.sql`). Row-level security stays enabled with no browser policies; all database access goes through server routes with the service-role key.

## Tests

```bash
npm run typecheck
npm test                 # Vitest unit tests: progress engine, config schema and upgrade, v3→v4 migration, reducers, EWS, five rights, claim scrubber, tickets, AI review scoring, resets, CSV, auth guard
npm run build
npm run test:e2e         # Playwright, Chromium and WebKit, against `next start` with test sign-in enabled
```

The browser tests enable a credentials provider that accepts only `e2e-*@fordham.edu` addresses and records those accounts with `enrollment_status = 'test'`. Test accounts are hidden from the roster, analytics, and exports by default and are deleted by `npm run cleanup:test-users` (also run automatically after the suite). The provider is registered only when `FORDMS_TEST_AUTH=1`, and the application refuses to start with that flag on a production deployment.

Screens for the course slides are captured with `npm run capture:screens` against a test server (see `scripts/capture_screens.mjs`); they are written to `../assets/screens` (01–20 keep their slide filenames; 21–28 cover the v5 modules). The e2e admin test publishes a configuration version to the course database and then republishes the version that was live before it.

## Deployment

1. `npm run typecheck && npm test && npm run build && npm run test:e2e`.
2. Apply any new migration to the production database (SQL editor or `psql -1 -f`).
3. Sync this directory to the deployment checkout and push `main`; Vercel builds and promotes automatically.
4. Verify on production: unauthenticated `/` redirects to `/login`, unauthenticated `/api/course/bootstrap` returns JSON 401, the instructor sees Gradebook and Admin, and a test student can save, submit, and receive feedback. Then run the cleanup script.

Rollback: redeploy the previous Vercel build (older code ignores the new tables and columns) and, only if necessary, run `009_fordms_course_ops_down.sql`.

## Integrity limits of a course simulator

Progress evidence originates in the learner's browser and is mirrored to the server, where it is de-duplicated and recomputed. Imported workspaces are labeled and never outrank evidence earned in place; submission versions carry a workspace hash and an immutable snapshot. A determined learner could still fabricate client events. The instructor evidence view, version history, and grading log make that reviewable, and the written analysis remains the primary graded artifact.
