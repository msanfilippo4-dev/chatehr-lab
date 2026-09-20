# Fordham Practice EHR

This resettable browser application supports HINF 6105 demonstrations and ungraded practice. It extends the chart-and-worksheet model used in EHR Go with connected, stateful workflows in which one action changes later work. All patients and clinical events are fictional. EHR Go and Blackboard remain the systems of record for graded work.

## Local use

Requirements: Node.js 20.9 or later.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The browser stores work in IndexedDB. Use **Export evidence** before clearing browser data or moving to another device. Schema version 2 imports its own exports and migrates compatible version 1 workspaces.

## Role-based simulations

- Front desk: patient search, scheduling, conflict detection, check-in, cancellation, and rescheduling.
- Clinical: longitudinal charts, SOAP notes, signed-note amendments, orders, warnings, results, portal messages, and scripted AI review.
- HIM: master patient index adjudication and exchange reconciliation with provenance.
- Analyst: computable cohort definitions, SQL-style logic previews, patient-level validation, saved query runs, and stratification.
- Implementation lead: evidence, ownership, risk, and readiness decisions across eight implementation domains.
- Patient: a plain-language portal view for medicines, results, messages, and reconciliation requests.

The exercise center contains ten 30-minute team scenarios. Completion is calculated from audit events created by real actions in the app; learners cannot mark work complete manually. **Download learner report** creates a compact evidence package.

The production course site is published at [fordms.com](https://fordms.com/).

## Static build

```bash
npm run build
```

The deployable static site is written to `out/`. Serve that folder with any static host. Core exercises require no account, API key, backend, or network connection after the site loads.

## Teaching safeguards

- The app labels every patient and event as synthetic.
- Signed notes remain in history; amendments create new entries.
- Medication and duplicate-order warnings are teaching simulations.
- The AI review screen uses a scripted draft, not a live model.
- HIE resources, FHIR-style labels, match confidence values, and implementation evidence are authored course simulations.
- Reset clears the local workspace only after a browser confirmation.
- Storage failures leave the active session usable and prompt the learner to export evidence.

## Instructor preparation

Run the application once in Chrome and Safari before class, check local storage, and keep a copy of the version 2 starter JSON available. Do not place EHR Go enrollment keys or private course links in this repository.
