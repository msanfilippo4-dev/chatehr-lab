import { appendFile, mkdir, readFile } from "fs/promises";
import path from "path";
import {
  getFordhamHealthBenchGroundTruth,
  FordhamBenchGroundTruth,
} from "@/lib/bench-ground-truth";

export const PROFESSOR_EMAIL = "msanfilippo4@fordham.edu";
const STORAGE_PATH =
  process.env.EXTRACREDIT_STORAGE_PATH || "/tmp/chatehr_extracredit_submissions.jsonl";

export type ExtraCreditAnswers = {
  exam1Potassium: string;
  exam1ActiveMed: string;
  exam1DiscontinuedMed: string;
  exam2NoFluCount: string;
  exam2CkdCount: string;
  exam3BronxHighA1cCount: string;
  exam3BronxIds: string;
};

export type ExamGrade = {
  examId: string;
  title: string;
  score: number;
  maxScore: number;
  feedback: string;
};

export type ExtraCreditGrade = {
  overallScore: number;
  maxScore: number;
  exams: ExamGrade[];
  groundTruthReference: {
    lab001Potassium: number | null;
    lab001ActiveRiskMedication: string | null;
    lab001DiscontinuedMedication: string | null;
    allPatientsNoFluCount: number;
    allPatientsCkdCount: number;
    bronxA1cHighCount: number;
    bronxA1cHighIds: string[];
  };
};

export type ExtraCreditRecord = {
  id: string;
  createdAt: string;
  source: "extracredit";
  student: {
    name: string;
    email: string;
  };
  answers: ExtraCreditAnswers;
  grade: ExtraCreditGrade;
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseNumeric(value: string): number | null {
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameNumber(a: number | null, b: number | null, tolerance = 0.01): boolean {
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= tolerance;
}

function parsePatientIds(input: string): string[] {
  return normalize(input)
    .split(/[\s,;]+/)
    .map((id) => id.toUpperCase())
    .filter((id) => id.startsWith("PT-"));
}

async function buildGroundTruth(): Promise<FordhamBenchGroundTruth> {
  return getFordhamHealthBenchGroundTruth();
}

export async function gradeExtraCredit(
  answers: ExtraCreditAnswers
): Promise<ExtraCreditGrade> {
  const truth = await buildGroundTruth();
  const exams: ExamGrade[] = [];

  {
    let score = 0;
    const potassium = parseNumeric(answers.exam1Potassium);
    if (sameNumber(potassium, truth.lab001Potassium, 0.11)) score += 10;

    const activeMed = normalize(answers.exam1ActiveMed);
    if (
      truth.lab001ActiveRiskMedication &&
      activeMed.includes(normalize(truth.lab001ActiveRiskMedication))
    ) {
      score += 10;
    }

    const discontinued = normalize(answers.exam1DiscontinuedMed);
    if (
      truth.lab001DiscontinuedMedication &&
      discontinued.includes(normalize(truth.lab001DiscontinuedMedication))
    ) {
      score += 10;
    }

    exams.push({
      examId: "exam1",
      title: "LAB-001 note-vs-structured safety extraction",
      score,
      maxScore: 30,
      feedback:
        score >= 24
          ? "Strong extraction from chart narrative and med status."
          : "Re-check LAB-001 visit note and active/discontinued medication list.",
    });
  }

  {
    let score = 0;
    const noFlu = parseNumeric(answers.exam2NoFluCount);
    const ckd = parseNumeric(answers.exam2CkdCount);
    if (sameNumber(noFlu, truth.allPatientsNoFluCount)) score += 15;
    if (sameNumber(ckd, truth.allPatientsCkdCount)) score += 15;

    exams.push({
      examId: "exam2",
      title: "All-patients operational counts",
      score,
      maxScore: 30,
      feedback:
        score >= 24
          ? "Good cohort-level extraction with tractable metrics."
          : "Use All Patients mode and verify numerator/denominator logic.",
    });
  }

  {
    let score = 0;
    const highA1cCount = parseNumeric(answers.exam3BronxHighA1cCount);
    if (sameNumber(highA1cCount, truth.bronxA1cHighCount)) score += 20;

    const providedIds = parsePatientIds(answers.exam3BronxIds);
    const truthSet = new Set(truth.bronxA1cHighIds);
    const matched = providedIds.filter((id) => truthSet.has(id));
    if (providedIds.length > 0) {
      const idScore = Math.round((matched.length / truth.bronxA1cHighIds.length) * 20);
      score += Math.max(0, Math.min(20, idScore));
    }

    exams.push({
      examId: "exam3",
      title: "Bronx 50 A1c>=8 prevalence + IDs",
      score,
      maxScore: 40,
      feedback:
        score >= 30
          ? "Strong prevalence extraction and patient-level identification."
          : "Re-run Bronx cohort A1c>=8 query and verify IDs against chart output.",
    });
  }

  const maxScore = exams.reduce((sum, e) => sum + e.maxScore, 0);
  const total = exams.reduce((sum, e) => sum + e.score, 0);

  return {
    overallScore: Math.round((total / maxScore) * 100),
    maxScore,
    exams,
    groundTruthReference: {
      lab001Potassium: truth.lab001Potassium,
      lab001ActiveRiskMedication: truth.lab001ActiveRiskMedication,
      lab001DiscontinuedMedication: truth.lab001DiscontinuedMedication,
      allPatientsNoFluCount: truth.allPatientsNoFluCount,
      allPatientsCkdCount: truth.allPatientsCkdCount,
      bronxA1cHighCount: truth.bronxA1cHighCount,
      bronxA1cHighIds: truth.bronxA1cHighIds,
    },
  };
}

export async function appendExtraCredit(record: ExtraCreditRecord): Promise<void> {
  const dir = path.dirname(STORAGE_PATH);
  await mkdir(dir, { recursive: true });
  await appendFile(STORAGE_PATH, `${JSON.stringify(record)}\n`, "utf8");
}

export async function readExtraCredit(): Promise<ExtraCreditRecord[]> {
  try {
    const raw = await readFile(STORAGE_PATH, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as ExtraCreditRecord)
      .filter((r) => Boolean(r?.id && r?.student?.email));
  } catch {
    return [];
  }
}

export function buildExtraCreditAnalytics(
  records: ExtraCreditRecord[],
  viewerEmail: string
): {
  scope: "student" | "class";
  scopeLabel: string;
  submissionCount: number;
  averageOverall: number;
  averageByExam: Array<{ examId: string; title: string; avgScore: number; maxScore: number }>;
  recent: Array<{ id: string; createdAt: string; student: string; overallScore: number }>;
} {
  const lower = viewerEmail.toLowerCase();
  const isProfessor = lower === PROFESSOR_EMAIL;
  const scoped = isProfessor
    ? records
    : records.filter((r) => r.student.email.toLowerCase() === lower);

  const submissionCount = scoped.length;
  const averageOverall =
    submissionCount > 0
      ? Math.round(scoped.reduce((sum, r) => sum + r.grade.overallScore, 0) / submissionCount)
      : 0;

  const examTemplate = scoped[0]?.grade.exams || [];
  const averageByExam = examTemplate.map((exam) => {
    const sum = scoped.reduce((acc, r) => {
      const found = r.grade.exams.find((x) => x.examId === exam.examId);
      return acc + (found?.score || 0);
    }, 0);
    return {
      examId: exam.examId,
      title: exam.title,
      avgScore: submissionCount > 0 ? Number((sum / submissionCount).toFixed(1)) : 0,
      maxScore: exam.maxScore,
    };
  });

  const recent = scoped
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      student: r.student.name || r.student.email,
      overallScore: r.grade.overallScore,
    }));

  return {
    scope: isProfessor ? "class" : "student",
    scopeLabel: isProfessor ? "Class Analytics" : "Your Analytics",
    submissionCount,
    averageOverall,
    averageByExam,
    recent,
  };
}

function stringifySubmission(record: ExtraCreditRecord): string {
  const lines: string[] = [];
  lines.push("ChatEHR Extra Credit Submission");
  lines.push(`Submission ID: ${record.id}`);
  lines.push(`Submitted At: ${record.createdAt}`);
  lines.push(`Student: ${record.student.name} <${record.student.email}>`);
  lines.push(`Overall Score: ${record.grade.overallScore}/100`);
  lines.push("");
  lines.push("Per-exam scores:");
  for (const exam of record.grade.exams) {
    lines.push(`- ${exam.title}: ${exam.score}/${exam.maxScore}`);
  }
  lines.push("");
  lines.push("Answers:");
  lines.push(JSON.stringify(record.answers, null, 2));
  return lines.join("\n");
}

export async function forwardExtraCreditEmail(
  record: ExtraCreditRecord
): Promise<{ forwarded: boolean; message: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { forwarded: false, message: "RESEND_API_KEY is not configured." };
  }

  const to = process.env.EXTRACREDIT_NOTIFY_EMAIL || PROFESSOR_EMAIL;
  const from =
    process.env.RESEND_FROM_EMAIL || "Fordham Extra Credit <extracredit@fordms.com>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `[ChatEHR Extra Credit] ${record.student.name || record.student.email} · ${record.grade.overallScore}/100`,
        text: stringifySubmission(record),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { forwarded: false, message: `Resend error (${response.status}): ${body}` };
    }
    return { forwarded: true, message: `Forwarded to ${to}` };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { forwarded: false, message: e.message || "Email forwarding failed." };
  }
}
