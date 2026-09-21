# FordMS EHR

FordMS is the authenticated practice electronic health record for Fordham University's HINF 6105 Electronic Health Records course. It is a teaching simulation: every patient, result, warning, match score, and AI draft is synthetic and scripted. It is not a certified clinical system and must never be used for patient care.

Production: <https://fordms.com/> (Vercel, deployed from the `main` branch of the course repository).

## What students get

- Sign-in with a verified `@fordham.edu` Google account; sessions last eight hours.
- Twelve fictional longitudinal charts and six simulated roles (Front Desk, Clinical, HIM, Patient, Analyst, Implementation Lead), each with its own worklist-first views.
- Workflows: registration with duplicate prevention, eligibility verification, referrals, scheduling with conflict and availability rules, reminders, no-shows, wait-list, MPI identity review, SOAP documentation with templates, copy-forward safeguards, signing, co-signature and amendments, orders with allergy, duplicate and interaction alerts plus override reasons, result acknowledgment and owned follow-up tasks, portal messaging with routing rules and proxy access, HIE reconciliation with provenance and match confidence, population queries with denominators, missingness and stratification, scripted AI draft review with an error taxonomy, implementation readiness and go-live recommendations, audit review, release of information, and downtime drills.
- Four graded assignments (FORDMS-A1 to A4) that together form the FordMS share (18%) of the Applied EHR activities category (30%); each assignment counts equally. Progress is computed on the server from timestamped audit events, each required action is credited once per distinct item, imported evidence is labeled separately, submissions are versioned, and the instructor can return work for revision.
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

Apply the migrations in `supabase/migrations/` to the course database in order (`008_hinf6105_practice_ehr.sql`, then `009_fordms_course_ops.sql`). Row-level security stays enabled with no browser policies; all database access goes through server routes with the service-role key.

## Tests

```bash
npm run typecheck
npm test                 # Vitest unit tests: progress engine, config schema, reducer, resets, CSV, auth guard
npm run build
npm run test:e2e         # Playwright, Chromium and WebKit, against `next start` with test sign-in enabled
```

The browser tests enable a credentials provider that accepts only `e2e-*@fordham.edu` addresses and records those accounts with `enrollment_status = 'test'`. Test accounts are hidden from the roster, analytics, and exports by default and are deleted by `npm run cleanup:test-users` (also run automatically after the suite). The provider is registered only when `FORDMS_TEST_AUTH=1`, and the application refuses to start with that flag on a production deployment.

Screens for the course slides are captured with `npm run capture:screens` against a test server (see `scripts/capture_screens.mjs`).

## Deployment

1. `npm run typecheck && npm test && npm run build && npm run test:e2e`.
2. Apply any new migration to the production database (SQL editor or `psql -1 -f`).
3. Sync this directory to the deployment checkout and push `main`; Vercel builds and promotes automatically.
4. Verify on production: unauthenticated `/` redirects to `/login`, unauthenticated `/api/course/bootstrap` returns JSON 401, the instructor sees Gradebook and Admin, and a test student can save, submit, and receive feedback. Then run the cleanup script.

Rollback: redeploy the previous Vercel build (older code ignores the new tables and columns) and, only if necessary, run `009_fordms_course_ops_down.sql`.

## Integrity limits of a course simulator

Progress evidence originates in the learner's browser and is mirrored to the server, where it is de-duplicated and recomputed. Imported workspaces are labeled and never outrank evidence earned in place; submission versions carry a workspace hash and an immutable snapshot. A determined learner could still fabricate client events. The instructor evidence view, version history, and grading log make that reviewable, and the written analysis remains the primary graded artifact.
