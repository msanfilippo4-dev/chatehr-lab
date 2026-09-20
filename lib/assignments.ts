export interface AssignmentRequirement {
  action: string;
  label: string;
  minimumCount: number;
}

export interface AssignmentRubricItem {
  criterion: string;
  points: number;
  standard: string;
}

export interface CourseAssignment {
  id: string;
  title: string;
  shortTitle: string;
  estimatedMinutes: number;
  dueLabel: string;
  scenario: string;
  objectives: string[];
  workflow: string[];
  requirements: AssignmentRequirement[];
  submissionPrompt: string;
  rubric: AssignmentRubricItem[];
}

export const courseAssignments: CourseAssignment[] = [
  {
    id: "FORDMS-A1",
    title: "Identity, access, scheduling, and coding",
    shortTitle: "Identity and access",
    estimatedMinutes: 90,
    dueLabel: "Sunday, October 11, 2026 at 11:59 p.m. ET",
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
      { action: "Open chart", label: "Open and verify a patient chart", minimumCount: 1 },
      { action: "Escalate identity review", label: "Send a possible duplicate to the HIM queue", minimumCount: 1 },
      { action: "Resolve identity review", label: "Record an MPI decision with reasoning", minimumCount: 1 },
      { action: "Create appointment", label: "Create a valid appointment", minimumCount: 1 },
      { action: "Reschedule appointment", label: "Reschedule while preserving the appointment record", minimumCount: 1 },
      { action: "Use code example", label: "Record both an ICD-10-CM and CPT example", minimumCount: 2 },
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
    dueLabel: "Sunday, October 25, 2026 at 11:59 p.m. ET",
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
      "Test the medication allergy safeguard and submit a safe laboratory order.",
      "Review the result and create a follow-up task with clear ownership.",
      "Route the portal message and record a medication-reconciliation request from the patient view.",
      "Submit a concise explanation of how your work closed the loop and protected note integrity.",
    ],
    requirements: [
      { action: "Signed SOAP note", label: "Create and sign a complete SOAP note", minimumCount: 1 },
      { action: "Amend signed note", label: "Add an amendment without overwriting signed history", minimumCount: 1 },
      { action: "Place simulated order", label: "Evaluate warnings and place two appropriate orders", minimumCount: 2 },
      { action: "Review result and create follow-up", label: "Acknowledge a result and create accountable follow-up", minimumCount: 1 },
      { action: "Route portal message", label: "Route the patient message", minimumCount: 1 },
      { action: "Patient data reconciliation request", label: "Submit a patient reconciliation request", minimumCount: 1 },
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
    dueLabel: "Sunday, November 22, 2026 at 11:59 p.m. ET",
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
      "Inspect patient-level evidence, denominator logic, data status, units, and coverage distribution.",
      "Record a formal query-validation decision in the app.",
      "Submit an interpretation that separates what the data show from what they cannot establish.",
    ],
    requirements: [
      { action: "Reconcile external item", label: "Reconcile two external clinical items", minimumCount: 2 },
      { action: "Run population query", label: "Run two different population queries", minimumCount: 2 },
      { action: "Validate population query", label: "Record a denominator and patient-level validation", minimumCount: 1 },
    ],
    submissionPrompt: "In 200–300 words, compare your two reconciliation decisions, state the exact cohort definition you validated, identify one data-quality limitation, and explain why the result does or does not support an intervention.",
    rubric: [
      { criterion: "HIE reconciliation", points: 30, standard: "Uses provenance, identity confidence, status, and discrepancy evidence for two resources." },
      { criterion: "Computable cohort design", points: 25, standard: "Runs reproducible definitions with an explicit denominator and time/status logic." },
      { criterion: "Patient-level validation", points: 20, standard: "Checks source records, units, status, missingness, and denominator membership." },
      { criterion: "Interpretation and limitations", points: 15, standard: "Avoids causal overclaiming and identifies a material limitation." },
      { criterion: "Audit evidence", points: 10, standard: "Required reconciliation and query actions are complete and traceable." },
    ],
  },
  {
    id: "FORDMS-A4",
    title: "AI safety review and implementation readiness",
    shortTitle: "AI and implementation",
    estimatedMinutes: 105,
    dueLabel: "Sunday, December 6, 2026 at 11:59 p.m. ET",
    scenario: "A scripted AI visit summary is proposed for broader use while the organization is preparing for a related clinical-system go-live. Evaluate the draft, update readiness evidence, and make a defensible release recommendation with human oversight.",
    objectives: [
      "Identify unsupported, incorrect, and omitted clinical content.",
      "Record a human review decision tied to source evidence.",
      "Evaluate readiness across workflow, interfaces, training, downtime, and measurement.",
      "Define release conditions, ownership, monitoring, and rollback triggers.",
    ],
    workflow: [
      "Compare every claim in the scripted AI draft with the source chart and record the review decision.",
      "Review all eight implementation domains and update at least three readiness decisions based on the displayed evidence.",
      "Record a go-live recommendation that identifies a release condition, accountable owner, measure, and rollback trigger.",
      "Submit an evaluation that explains the most serious AI risk and the strongest unresolved implementation risk.",
    ],
    requirements: [
      { action: "AI draft review", label: "Complete the AI draft safety review", minimumCount: 1 },
      { action: "Update implementation readiness", label: "Update at least three readiness domains", minimumCount: 3 },
      { action: "Record go-live recommendation", label: "Record a release recommendation with safeguards", minimumCount: 1 },
    ],
    submissionPrompt: "In 225–350 words, identify the draft's clinically material errors, state your human-review disposition, recommend go/no-go/conditional go, and specify an owner, outcome measure, balancing measure, and rollback trigger.",
    rubric: [
      { criterion: "AI evidence review", points: 30, standard: "Finds clinically material errors and ties each finding to a source or missing source." },
      { criterion: "Implementation readiness", points: 25, standard: "Updates three or more domains using evidence rather than optimism." },
      { criterion: "Release recommendation", points: 25, standard: "States conditions, ownership, monitoring, and a usable rollback trigger." },
      { criterion: "Human oversight and limitations", points: 10, standard: "Preserves accountable review and identifies limits of the simulation." },
      { criterion: "Audit evidence", points: 10, standard: "Required actions are complete, specific, and traceable." },
    ],
  },
];

export function assignmentProgress(assignment: CourseAssignment, actions: string[]) {
  const counts = actions.reduce<Record<string, number>>((result, action) => {
    result[action] = (result[action] ?? 0) + 1;
    return result;
  }, {});
  const requirements = assignment.requirements.map((requirement) => ({
    ...requirement,
    completedCount: Math.min(counts[requirement.action] ?? 0, requirement.minimumCount),
    complete: (counts[requirement.action] ?? 0) >= requirement.minimumCount,
  }));
  const completedUnits = requirements.reduce((sum, item) => sum + item.completedCount, 0);
  const totalUnits = requirements.reduce((sum, item) => sum + item.minimumCount, 0);
  return {
    requirements,
    completedUnits,
    totalUnits,
    percent: totalUnits ? Math.round((completedUnits / totalUnits) * 100) : 0,
    complete: requirements.every((item) => item.complete),
  };
}
