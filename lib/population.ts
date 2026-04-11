import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Patient,
  PopulationCohortDefinition,
  PopulationGroundTruthCheck,
  PopulationTaskDefinition,
} from "./types";
import { loadPatientRecord } from "./patient-loader";

export const POPULATION_COHORTS: PopulationCohortDefinition[] = [
  {
    id: "diabetes-access-risk",
    title: "Diabetes Outreach With Access Barriers",
    summary:
      "12 adults with diabetes, 7 who prefer a language other than English, 6 with food insecurity, 5 with transportation-related missed visits, and 4 with HbA1c above 9%.",
    rationale:
      "This cohort forces teams to connect glycemic risk with interpreter access, transportation, and affordability instead of treating outreach as a generic reminder campaign.",
    snapshotMetrics: [
      { label: "Adults with diabetes", value: "12" },
      { label: "Non-English language preference", value: "7" },
      { label: "Food insecurity", value: "6" },
      { label: "Missed visits from transportation", value: "5" },
      { label: "HbA1c > 9%", value: "4" },
    ],
    disparityIndicators: [
      "Interpreter scheduling failures are affecting visit completion.",
      "Food insecurity changes whether the diabetes plan is realistic.",
      "Transportation barriers distort who appears 'nonadherent' in the chart.",
    ],
    memberPatientIds: ["PT-TCH-002", "PT-TCH-004", "PT-TCH-007"],
    tasks: [
      {
        id: "outreach-priorities",
        title: "Outreach Priorities",
        prompt:
          "COHORT SNAPSHOT: 12 adults with diabetes, 7 prefer a language other than English, 6 report food insecurity, 5 missed at least two visits because of transportation problems, and 4 have HbA1c >9%. Which outreach priorities and fairness checks should the team focus on first?",
        successCriteria:
          "Prioritizes the highest-risk patients while naming interpreter access, transportation, and food insecurity as clinical operations issues.",
      },
      {
        id: "care-gap-prioritization",
        title: "Care-Gap Prioritization",
        prompt:
          "From this diabetes access-risk cohort, rank the top care gaps the outreach team should close in the next two weeks. Explain why those gaps matter clinically and operationally.",
        successCriteria:
          "Uses chart-grounded care gaps, not generic advice, and separates urgent safety gaps from longer-term optimization work.",
      },
      {
        id: "risk-stratification",
        title: "Risk Stratification",
        prompt:
          "Create a practical risk-stratification approach for this diabetes cohort. Which patients should receive the fastest outreach and what chart signals justify that decision?",
        successCriteria:
          "Combines clinical severity with access barriers and avoids blaming patients for structural barriers.",
      },
    ],
  },
  {
    id: "heart-failure-follow-up",
    title: "Heart-Failure Follow-Up Risk",
    summary:
      "18 heart-failure patients, 6 with recent weight gain, 5 with BNP above baseline, 7 who missed cardiology follow-up, and 4 with a non-English language preference.",
    rationale:
      "This cohort makes students distinguish between physiologic worsening, follow-up failures, and communication barriers when deciding who should be called first.",
    snapshotMetrics: [
      { label: "Heart-failure patients", value: "18" },
      { label: "Recent weight gain", value: "6" },
      { label: "BNP above baseline", value: "5" },
      { label: "Missed cardiology follow-up", value: "7" },
      { label: "Non-English language preference", value: "4" },
    ],
    disparityIndicators: [
      "Missed specialty follow-up may reflect access friction, not low motivation.",
      "Language preference changes discharge comprehension and return precautions.",
      "Escalation risk increases when physiologic change and follow-up failure co-occur.",
    ],
    memberPatientIds: ["PT-TCH-003", "PT-TCH-005", "PT-TCH-007"],
    tasks: [
      {
        id: "operational-priorities",
        title: "Operational Follow-Up Priorities",
        prompt:
          "COHORT SNAPSHOT: 18 heart-failure patients, 6 with recent weight gain, 5 with BNP above baseline, 7 missed cardiology follow-up, and 4 prefer a non-English language. Which operational follow-up priorities are most justified?",
        successCriteria:
          "Names which patients need rapid outreach and ties that outreach to specific heart-failure warning signals and communication barriers.",
      },
      {
        id: "risk-bucketing",
        title: "Risk Bucketing",
        prompt:
          "Divide this heart-failure cohort into high, medium, and low follow-up risk buckets. What chart features would move a patient up or down?",
        successCriteria:
          "Creates usable buckets instead of vague prose and explains why each feature changes urgency.",
      },
      {
        id: "equity-check",
        title: "Equity Check",
        prompt:
          "What fairness checks should the team apply before acting on this heart-failure risk list so that language or access barriers do not get mistaken for low engagement?",
        successCriteria:
          "Explicitly addresses interpreter needs, follow-up access, and how the workflow could unfairly bias triage decisions.",
      },
    ],
  },
  {
    id: "preventive-access-gaps",
    title: "Preventive Care and Communication Gaps",
    summary:
      "22 adults with preventive care gaps, 9 overdue for influenza vaccination, 8 with depression follow-up due, 6 needing plain-language communication, and 5 with inconsistent portal access.",
    rationale:
      "This cohort makes students think about population health as communication design and care-gap workflow, not only disease prediction.",
    snapshotMetrics: [
      { label: "Adults with preventive gaps", value: "22" },
      { label: "Overdue influenza vaccine", value: "9" },
      { label: "Depression follow-up due", value: "8" },
      { label: "Need plain-language communication", value: "6" },
      { label: "Inconsistent portal access", value: "5" },
    ],
    disparityIndicators: [
      "Portal-only outreach can miss patients with lower digital access.",
      "Preventive tasks are easier to miss when summaries are jargon-heavy.",
      "Behavioral-health follow-up can disappear when communication is generic.",
    ],
    memberPatientIds: ["PT-TCH-008", "PT-TCH-002", "PT-TCH-006"],
    tasks: [
      {
        id: "care-gap-summary",
        title: "Care-Gap Summary",
        prompt:
          "Summarize the most important preventive and communication gaps in this cohort, using a format a clinic operations lead could act on.",
        successCriteria:
          "Produces a concise, actionable summary and distinguishes outreach work from clinical follow-up work.",
      },
      {
        id: "patient-friendly-outreach",
        title: "Patient-Friendly Outreach Design",
        prompt:
          "Design a patient-friendly outreach plan for this preventive-care cohort. What should be standardized, and where should the workflow adapt to language or health-literacy differences?",
        successCriteria:
          "Shows how communication format changes the usefulness and equity of preventive outreach.",
      },
      {
        id: "prioritize-limited-staffing",
        title: "Prioritize With Limited Staffing",
        prompt:
          "If the clinic only has capacity to proactively contact one-third of this preventive-care cohort this week, how should the list be prioritized?",
        successCriteria:
          "Prioritizes clearly, names tradeoffs, and avoids arbitrary or biased ranking logic.",
      },
    ],
  },
  {
    id: "sensitive-exam-documentation-audit",
    title: "Sensitive Exam Documentation Audit",
    summary:
      "A note-review cohort of four adult charts with recent breast or pelvic exam documentation. Students have to distinguish explicit chaperone use from closely related note patterns that should not be counted.",
    rationale:
      "This turns population health into a documentation audit task: can the model find a specific note-level signal across multiple charts, produce a defensible tally, and avoid false positives from keyword-only matching?",
    snapshotMetrics: [
      { label: "Charts in audit sample", value: "4" },
      { label: "Recent breast or pelvic exam notes", value: "4" },
      { label: "Interpreter-involved visits", value: "2" },
      { label: "Documentation styles represented", value: "Explicit, declined, omitted" },
    ],
    disparityIndicators: [
      "Interpreter use changes how exam documentation and consent details appear in the chart.",
      "Keyword matching alone can overcount charts when chaperones were offered or declined but not used.",
      "Audit tasks test whether the workflow can separate documentation quality from the clinical event itself.",
    ],
    memberPatientIds: ["PT-TCH-001", "PT-TCH-002", "PT-TCH-004", "PT-TCH-008"],
    tasks: [
      {
        id: "tally-explicit-chaperone-use",
        title: "Tally Explicit Chaperone Use",
        prompt:
          "Review the note excerpts and identify only the charts where the note explicitly documents that a chaperone was present during a breast or pelvic exam. Do not count charts where a chaperone was only offered, declined, or not mentioned. Return a structured answer with: 1. Count: <number> 2. Patient IDs: <comma-separated IDs> 3. Evidence: one bullet per counted chart with a short quoted phrase 4. One sentence on the main documentation pitfall in this cohort.",
        successCriteria:
          "Counts only charts with explicit chaperone use, lists the correct patients, and avoids false positives from notes where the exam is documented but chaperone use is declined or omitted.",
        contextMode: "note-review",
        accuracyMeasurement:
          "After each run, the app compares the model's tally and patient list against hidden ground truth from the seeded notes. Precision and recall are based on which charts it flagged correctly.",
        groundTruth: {
          label: "Charts with explicit chaperone use documented in the note",
          expectedCount: 2,
          matchingPatientIds: ["PT-TCH-002", "PT-TCH-004"],
          note: "Only actual chaperone use counts. Offered or declined chaperones do not count.",
        },
      },
    ],
  },
];

export function getPopulationCohortById(cohortId: string) {
  return POPULATION_COHORTS.find((cohort) => cohort.id === cohortId) ?? null;
}

export function getPopulationTaskById(
  cohort: PopulationCohortDefinition,
  taskId: string
): PopulationTaskDefinition | null {
  return cohort.tasks.find((task) => task.id === taskId) ?? null;
}

function summarizeConditions(patient: Patient) {
  return patient.conditions
    .slice(0, 3)
    .map((condition) => condition.display)
    .join(", ");
}

function summarizeSignals(patient: Patient) {
  const labSignals = patient.labs
    .slice(0, 2)
    .map((lab) => `${lab.name} ${lab.value}${lab.unit ? ` ${lab.unit}` : ""}`)
    .join("; ");
  const socialSignals = [
    patient.language ? `language ${patient.language}` : null,
    patient.insuranceType ? `insurance ${patient.insuranceType}` : null,
    patient.socialHistory?.livingSituation
      ? `living situation ${patient.socialHistory.livingSituation}`
      : null,
  ]
    .filter(Boolean)
    .join("; ");

  return [labSignals, socialSignals].filter(Boolean).join(" | ");
}

function summarizeNoteReview(patient: Patient) {
  const notes = (patient.clinicalNotes ?? [])
    .slice(0, 3)
    .map((note) => {
      const header = `${note.date} [${note.noteType}] ${note.author}`;
      return `  - ${header}: ${note.content}`;
    })
    .join("\n");

  return [
    `${patient.name} (${patient.id})`,
    `  Quick context: ${summarizeConditions(patient)}${(() => {
      const signals = summarizeSignals(patient);
      return signals ? ` | ${signals}` : "";
    })()}`,
    notes ? `  Recent note excerpts:\n${notes}` : "  Recent note excerpts: none available",
  ].join("\n");
}

export async function loadPopulationCohortMembers(
  supabase: SupabaseClient,
  cohort: PopulationCohortDefinition
) {
  const patients = await Promise.all(
    cohort.memberPatientIds.map((patientId) => loadPatientRecord(supabase, patientId))
  );

  return patients.filter(Boolean) as Patient[];
}

export function buildPopulationContext(
  cohort: PopulationCohortDefinition,
  task: PopulationTaskDefinition,
  members: Patient[],
  taskPrompt: string
) {
  const metricsBlock = cohort.snapshotMetrics
    .map((metric) => `- ${metric.label}: ${metric.value}`)
    .join("\n");

  const equityBlock = cohort.disparityIndicators
    .map((item) => `- ${item}`)
    .join("\n");

  const memberBlock =
    task.contextMode === "note-review"
      ? members.map((patient) => summarizeNoteReview(patient)).join("\n\n")
      : members
          .map((patient) => {
            const conditions = summarizeConditions(patient);
            const signals = summarizeSignals(patient);
            return `- ${patient.name} (${patient.id}) — ${conditions}${
              signals ? ` | ${signals}` : ""
            }`;
          })
          .join("\n");

  return [
    `COHORT: ${cohort.title}`,
    `SUMMARY:\n${cohort.summary}`,
    `RATIONALE:\n${cohort.rationale}`,
    `SNAPSHOT METRICS:\n${metricsBlock}`,
    `DISPARITY INDICATORS:\n${equityBlock}`,
    task.contextMode === "note-review"
      ? [
          "NOTE REVIEW RULES:",
          "- Count only charts where the note explicitly documents that a chaperone was present or used.",
          "- Do not count charts where a chaperone was only offered, declined, or not mentioned.",
          "- Use quoted note evidence for each chart you count.",
        ].join("\n")
      : "",
    memberBlock
      ? `${
          task.contextMode === "note-review"
            ? "CHART NOTE EXCERPTS"
            : "SAMPLE MEMBERS"
        }:\n${memberBlock}`
      : "",
    `TASK:\n${taskPrompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeOutput(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseCountToken(token: string) {
  const normalized = token.trim().toLowerCase();
  const numberWords: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  if (normalized in numberWords) {
    return numberWords[normalized];
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractExplicitTally(output: string) {
  const patterns = [
    /(?:count|tally|total)\s*(?:charts|patients)?\s*[:=-]?\s*(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)/i,
    /(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:charts|patients)\s+(?:with|show|document|meet)/i,
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (!match?.[1]) continue;
    const parsed = parseCountToken(match[1]);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function extractStructuredPatientList(output: string, members: Patient[]) {
  const lineMatch = output.match(
    /(?:patient ids?|counted charts?|matching charts?)\s*:\s*([^\n]+)/i
  );
  if (!lineMatch?.[1]) {
    return null;
  }

  const listValue = lineMatch[1].trim();
  if (!listValue || /\b(?:none|n\/a|no charts?)\b/i.test(listValue)) {
    return [];
  }

  const normalizedList = normalizeOutput(listValue);
  return Array.from(
    new Set(
      members
        .filter((member) => {
          const normalizedName = normalizeOutput(member.name);
          return (
            normalizedList.includes(member.id.toLowerCase()) ||
            normalizedList.includes(normalizedName)
          );
        })
        .map((member) => member.id)
    )
  );
}

function extractMentionedPatients(output: string, members: Patient[]) {
  const normalizedOutput = normalizeOutput(output);
  return Array.from(
    new Set(
      members
        .filter((member) => {
          const normalizedName = normalizeOutput(member.name);
          return (
            normalizedOutput.includes(member.id.toLowerCase()) ||
            normalizedOutput.includes(normalizedName)
          );
        })
        .map((member) => member.id)
    )
  );
}

function mapPatientIdsToNames(ids: string[], members: Patient[]) {
  return ids.map(
    (id) => members.find((member) => member.id === id)?.name ?? id
  );
}

function buildGroundTruthSummary(args: {
  expectedCount: number;
  extractedCount: number;
  matchedNames: string[];
  missedNames: string[];
  unexpectedNames: string[];
}) {
  const summaryParts = [
    `Model tally ${args.extractedCount} vs ground truth ${args.expectedCount}.`,
  ];

  if (args.matchedNames.length > 0) {
    summaryParts.push(
      `Correct charts: ${args.matchedNames.join(", ")}.`
    );
  } else {
    summaryParts.push("No correct charts were explicitly identified.");
  }

  if (args.missedNames.length > 0) {
    summaryParts.push(`Missed: ${args.missedNames.join(", ")}.`);
  }

  if (args.unexpectedNames.length > 0) {
    summaryParts.push(`Unexpected: ${args.unexpectedNames.join(", ")}.`);
  }

  return summaryParts.join(" ");
}

export function evaluatePopulationGroundTruth(
  task: PopulationTaskDefinition,
  members: Patient[],
  output: string
): PopulationGroundTruthCheck | null {
  if (!task.groundTruth) {
    return null;
  }

  const explicitTally = extractExplicitTally(output);
  const structuredPatientIds = extractStructuredPatientList(output, members);
  const predictedPatientIds =
    structuredPatientIds ??
    (explicitTally === 0 ? [] : extractMentionedPatients(output, members));
  const extractedCount = explicitTally ?? predictedPatientIds.length;
  const countSource =
    explicitTally === null ? "listed-charts" : "explicit-tally";
  const expectedIds = Array.from(new Set(task.groundTruth.matchingPatientIds));
  const expectedIdSet = new Set(expectedIds);
  const predictedIdSet = new Set(predictedPatientIds);

  const matchedPatientIds = predictedPatientIds.filter((id) =>
    expectedIdSet.has(id)
  );
  const missedPatientIds = expectedIds.filter((id) => !predictedIdSet.has(id));
  const unexpectedPatientIds = predictedPatientIds.filter(
    (id) => !expectedIdSet.has(id)
  );

  const matchedPatientNames = mapPatientIdsToNames(matchedPatientIds, members);
  const missedPatientNames = mapPatientIdsToNames(missedPatientIds, members);
  const unexpectedPatientNames = mapPatientIdsToNames(
    unexpectedPatientIds,
    members
  );

  return {
    label: task.groundTruth.label,
    expectedCount: task.groundTruth.expectedCount,
    extractedCount,
    countDelta: extractedCount - task.groundTruth.expectedCount,
    countSource,
    matchedPatientIds,
    matchedPatientNames,
    missedPatientIds,
    missedPatientNames,
    unexpectedPatientIds,
    unexpectedPatientNames,
    precision:
      predictedPatientIds.length > 0
        ? matchedPatientIds.length / predictedPatientIds.length
        : null,
    recall:
      expectedIds.length > 0 ? matchedPatientIds.length / expectedIds.length : null,
    summary: buildGroundTruthSummary({
      expectedCount: task.groundTruth.expectedCount,
      extractedCount,
      matchedNames: matchedPatientNames,
      missedNames: missedPatientNames,
      unexpectedNames: unexpectedPatientNames,
    }),
    note: task.groundTruth.note,
  };
}

export function getPublicPopulationTask(task: PopulationTaskDefinition) {
  const { groundTruth: _groundTruth, ...publicTask } = task;
  return publicTask;
}

export function getPublicPopulationCohort(cohort: PopulationCohortDefinition) {
  return {
    ...cohort,
    tasks: cohort.tasks.map((task) => getPublicPopulationTask(task)),
  };
}
