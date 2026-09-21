import { ACTION } from "./actions";
import type { CourseAssignment } from "./config/types";

export type { CourseAssignment } from "./config/types";
export type { AssignmentRequirement } from "./progress";

/**
 * Default FordMS assignment definitions (course configuration version 0).
 * Instructors can publish revised definitions through the admin console;
 * these values remain the fallback and the reference the course documents cite.
 */
export const defaultAssignments: CourseAssignment[] = [
  {
    id: "FORDMS-A1",
    title: "Identity, access, scheduling, and coding",
    shortTitle: "Identity and access",
    estimatedMinutes: 90,
    dueAt: "2026-10-11T23:59:00-04:00",
    dueLabel: "Sunday, October 11, 2026 at 11:59 p.m. ET",
    weightPercent: 4.5,
    weekIntroduced: 3,
    releaseState: "released",
    scenario: "A patient may have two records, needs timely follow-up, and must be scheduled without creating a conflict. You are responsible for protecting identity integrity while completing the front-desk workflow and selecting defensible code examples.",
    objectives: [
      "Use multiple identifiers before acting on a chart.",
      "Document an MPI decision without making an unsafe merge.",
      "Create and reschedule an appointment while preserving workflow history.",
      "Distinguish ICD-10-CM diagnoses from CPT services.",
    ],
    workflow: [
      "Open the possible-duplicate patient chart and send the pair to the HIM identity queue.",
      "Switch to the HIM role, compare the two records, and record a supported identity decision with reasoning.",
      "Switch to Front Desk, create a visit, deliberately test conflict detection, then reschedule the visit to a valid slot.",
      "In the chart Coding tab, record one ICD-10-CM example and one CPT example that fit the scenario.",
      "Review the captured evidence and submit a short explanation of the identity and access risks you controlled.",
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
  },
  {
    id: "FORDMS-A2",
    title: "Clinical documentation, orders, results, and patient follow-up",
    shortTitle: "Clinical loop closure",
    estimatedMinutes: 110,
    dueAt: "2026-11-01T23:59:00-05:00",
    dueLabel: "Sunday, November 1, 2026 at 11:59 p.m. ET",
    weightPercent: 4.5,
    weekIntroduced: 4,
    releaseState: "released",
    scenario: "You are covering an ambulatory team. The chart contains shoulder symptoms, a severe allergy, an abnormal result, and a patient message. Complete the encounter without introducing unsupported documentation and close each follow-up loop.",
    objectives: [
      "Create a source-supported SOAP note.",
      "Preserve signed-note history through an amendment.",
      "Respond to medication and duplicate-order warnings.",
      "Separate result acknowledgment from accountable follow-up.",
      "Route patient communication to the appropriate team.",
    ],
    workflow: [
      "Review the selected patient's problems, medicines, allergies, vitals, results, and prior notes.",
      "Write and sign a complete SOAP note using only available evidence, then add a meaningful amendment.",
      "Test the medication allergy safeguard, record an override reason or choose an alternative, and submit a safe laboratory order.",
      "Acknowledge the result and create a follow-up task with clear ownership.",
      "Route the portal message and record a medication-reconciliation request from the patient view.",
      "Submit a concise explanation of how your work closed the loop and protected note integrity.",
    ],
    requirements: [
      { action: ACTION.SIGNED_SOAP_NOTE, label: "Create and sign a complete SOAP note", minimumCount: 1 },
      { action: ACTION.AMEND_SIGNED_NOTE, label: "Add an amendment without overwriting signed history", minimumCount: 1 },
      { action: ACTION.PLACE_SIMULATED_ORDER, label: "Evaluate warnings and place two appropriate orders", minimumCount: 2 },
      { action: ACTION.REVIEW_RESULT_FOLLOWUP, label: "Acknowledge a result and create accountable follow-up", minimumCount: 1 },
      { action: ACTION.ROUTE_PORTAL_MESSAGE, label: "Route the patient message", minimumCount: 1 },
      { action: ACTION.PATIENT_RECONCILIATION_REQUEST, label: "Submit a patient reconciliation request", minimumCount: 1 },
    ],
    submissionPrompt: "In 175–300 words, identify the evidence supporting your assessment and plan, describe the warning you encountered, and explain how the result, task, message, and amendment preserve accountability.",
    rubric: [
      { criterion: "SOAP documentation quality", points: 30, standard: "Separates subjective and objective evidence and supports the assessment and plan." },
      { criterion: "Medication and order safety", points: 20, standard: "Recognizes the allergy risk and avoids an unsafe or unjustified override." },
      { criterion: "Result and communication loop closure", points: 25, standard: "Creates clear follow-up ownership and routes communication appropriately." },
      { criterion: "Record integrity", points: 15, standard: "Uses an amendment and preserves the signed version history." },
      { criterion: "Written analysis", points: 10, standard: "Uses specific chart evidence and explains limitations." },
    ],
  },
  {
    id: "FORDMS-A3",
    title: "Interoperability, provenance, and population analytics",
    shortTitle: "HIE and analytics",
    estimatedMinutes: 100,
    dueAt: "2026-11-22T23:59:00-05:00",
    dueLabel: "Sunday, November 22, 2026 at 11:59 p.m. ET",
    weightPercent: 4.5,
    weekIntroduced: 8,
    releaseState: "released",
    scenario: "Crescent Health has received external clinical records and needs a reproducible patient cohort for improvement work. Reconcile conflicting information, preserve provenance, and validate the analytical denominator before interpreting results.",
    objectives: [
      "Use source, time, match confidence, and resource type during reconciliation.",
      "Avoid automatic merging of conflicting clinical data.",
      "Define and run reproducible population queries.",
      "Validate patient-level evidence before drawing a population conclusion.",
    ],
    workflow: [
      "Review at least two incoming HIE resources and make documented reconciliation decisions.",
      "Run two different cohort definitions in Population Query Studio.",
      "Inspect patient-level evidence, denominator logic, data status, units, missing values, and coverage distribution.",
      "Record a formal query-validation decision in the app.",
      "Submit an interpretation that separates what the data show from what they cannot establish.",
    ],
    requirements: [
      { action: ACTION.RECONCILE_EXTERNAL_ITEM, label: "Reconcile two external clinical items", minimumCount: 2 },
      { action: ACTION.RUN_POPULATION_QUERY, label: "Run two different population queries", minimumCount: 2 },
      { action: ACTION.VALIDATE_POPULATION_QUERY, label: "Record a denominator and patient-level validation", minimumCount: 1 },
    ],
    submissionPrompt: "In 200–300 words, compare your two reconciliation decisions, state the exact cohort definition you validated, identify one data-quality limitation, and explain why the result does or does not support an intervention.",
    rubric: [
      { criterion: "External record reconciliation", points: 30, standard: "Uses provenance, identity confidence, status, and discrepancy evidence for two resources." },
      { criterion: "Cohort definition and validation", points: 25, standard: "Runs reproducible definitions with an explicit denominator, time, and status logic, then checks patient-level evidence." },
      { criterion: "Data quality and limitations", points: 20, standard: "Identifies missingness, units, or status problems and avoids causal overclaiming." },
      { criterion: "Audit evidence", points: 15, standard: "Required reconciliation and query actions are complete and traceable." },
      { criterion: "Written analysis", points: 10, standard: "States what the data show and what they cannot establish." },
    ],
  },
  {
    id: "FORDMS-A4",
    title: "AI safety review and implementation readiness",
    shortTitle: "AI and implementation",
    estimatedMinutes: 105,
    dueAt: "2026-12-06T23:59:00-05:00",
    dueLabel: "Sunday, December 6, 2026 at 11:59 p.m. ET",
    weightPercent: 4.5,
    weekIntroduced: 10,
    releaseState: "released",
    scenario: "A scripted AI visit summary is proposed for broader use while the organization is preparing for a related clinical-system go-live. Evaluate the draft, update readiness evidence, and make a defensible release recommendation with human oversight.",
    objectives: [
      "Identify unsupported, incorrect, and omitted clinical content.",
      "Record a human review decision tied to source evidence.",
      "Evaluate readiness across workflow, interfaces, training, downtime, and measurement.",
      "Define release conditions, ownership, monitoring, and rollback triggers.",
    ],
    workflow: [
      "Compare every claim in the scripted AI draft with the source chart, classify each error, and record the review decision.",
      "Review all eight implementation domains and update at least three readiness decisions based on the displayed evidence.",
      "Record a go-live recommendation that identifies a release condition, accountable owner, outcome and balancing measures, monitoring, and rollback trigger.",
      "Submit an evaluation that explains the most serious AI risk and the strongest unresolved implementation risk.",
    ],
    requirements: [
      { action: ACTION.AI_DRAFT_REVIEW, label: "Complete the AI draft safety review", minimumCount: 1 },
      { action: ACTION.UPDATE_IMPLEMENTATION_READINESS, label: "Update at least three distinct readiness domains", minimumCount: 3 },
      { action: ACTION.RECORD_GO_LIVE_RECOMMENDATION, label: "Record a release recommendation with safeguards", minimumCount: 1 },
    ],
    submissionPrompt: "In 225–350 words, identify the draft's clinically material errors, state your human-review disposition, recommend go/no-go/conditional go, and specify an owner, outcome measure, balancing measure, and rollback trigger.",
    rubric: [
      { criterion: "AI draft error detection", points: 30, standard: "Finds clinically material errors and ties each finding to a source or missing source." },
      { criterion: "Implementation readiness judgment", points: 25, standard: "Updates three or more domains using evidence rather than optimism." },
      { criterion: "Go-live recommendation and safeguards", points: 25, standard: "States conditions, ownership, outcome and balancing measures, monitoring, and a usable rollback trigger." },
      { criterion: "Audit evidence", points: 10, standard: "Required actions are complete, specific, and traceable." },
      { criterion: "Written analysis", points: 10, standard: "Preserves accountable human review and identifies limits of the simulation." },
    ],
  },
];

export const ASSIGNMENT_IDS = defaultAssignments.map((item) => item.id);

/** Combined course share of the four FordMS assignments (each counts equally within it). */
export const FORDMS_CATEGORY_SHARE = 18;
export const EHRGO_CATEGORY_SHARE = 12;
