import { appendFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { Patient } from "@/lib/types";
import { getBronxHospitalCohort } from "@/lib/cohort-context";

export const PROFESSOR_EMAIL = "msanfilippo4@fordham.edu";
const STORAGE_PATH =
  process.env.FHB_STORAGE_PATH || "/tmp/fordham_health_bench_submissions.jsonl";

export type FordhamHealthBenchAnswers = {
  case1Potassium: string;
  case1Medication: string;
  case2A1c: string;
  case2Ldl: string;
  case3Medication: string;
  case3Hcg: string;
  case4FluCount: string;
  case5A1cCount: string;
  case5PatientIds: string;
};

export type CaseGrade = {
  caseId: string;
  title: string;
  score: number;
  maxScore: number;
  feedback: string;
};

export type BenchGrade = {
  overallScore: number;
  maxScore: number;
  cases: CaseGrade[];
  groundTruthReference: {
    lab001Potassium: number | null;
    lab002A1c: number | null;
    lab002Ldl: number | null;
    lab003Hcg: number | null;
    bronxFluCount: number;
    bronxA1cHighCount: number;
    bronxA1cHighIds: string[];
  };
};

export type BenchSubmissionRecord = {
  id: string;
  createdAt: string;
  student: {
    name: string;
    email: string;
  };
  answers: FordhamHealthBenchAnswers;
  grade: BenchGrade;
};

type GroundTruth = {
  lab001Potassium: number | null;
  lab002A1c: number | null;
  lab002Ldl: number | null;
  lab003Hcg: number | null;
  bronxFluCount: number;
  bronxA1cHighCount: number;
  bronxA1cHighIds: string[];
};

let patientsCache: Patient[] | null = null;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseNumeric(value: string): number | null {
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameNumber(a: number | null, b: number | null, tolerance = 0.11): boolean {
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= tolerance;
}

function latestLab(patient: Patient, name: string): number | null {
  const lab = patient.labs
    .filter((l) => l.name.toLowerCase() === name.toLowerCase())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  return lab ? lab.value : null;
}

function hasFluShot(patient: Patient): boolean {
  return patient.immunizations.some((i) => i.name.toLowerCase().includes("influenza"));
}

function hasHighA1c(patient: Patient): boolean {
  const a1c = latestLab(patient, "Hemoglobin A1c");
  return a1c !== null && a1c >= 8;
}

async function loadPatients(): Promise<Patient[]> {
  if (patientsCache) return patientsCache;
  const p = path.join(process.cwd(), "public", "data", "patients.json");
  const raw = await readFile(p, "utf8");
  patientsCache = JSON.parse(raw) as Patient[];
  return patientsCache;
}

async function buildGroundTruth(): Promise<GroundTruth> {
  const patients = await loadPatients();
  const lab001 = patients.find((p) => p.id === "LAB-001") || null;
  const lab002 = patients.find((p) => p.id === "LAB-002") || null;
  const lab003 = patients.find((p) => p.id === "LAB-003") || null;
  const bronx = getBronxHospitalCohort(patients);
  const bronxA1cHigh = bronx.filter(hasHighA1c);

  return {
    lab001Potassium: lab001 ? latestLab(lab001, "Potassium") : null,
    lab002A1c: lab002 ? latestLab(lab002, "Hemoglobin A1c") : null,
    lab002Ldl: lab002 ? latestLab(lab002, "LDL Cholesterol") : null,
    lab003Hcg: lab003 ? latestLab(lab003, "Pregnancy test (hCG)") : null,
    bronxFluCount: bronx.filter(hasFluShot).length,
    bronxA1cHighCount: bronxA1cHigh.length,
    bronxA1cHighIds: bronxA1cHigh.map((p) => p.id).sort(),
  };
}

export async function gradeFordhamHealthBench(
  answers: FordhamHealthBenchAnswers
): Promise<BenchGrade> {
  const truth = await buildGroundTruth();
  const cases: CaseGrade[] = [];

  {
    let score = 0;
    const userK = parseNumeric(answers.case1Potassium);
    if (sameNumber(userK, truth.lab001Potassium)) score += 10;
    const med = normalize(answers.case1Medication);
    if (med.includes("lisinopril") || med.includes("spironolactone")) score += 10;
    cases.push({
      caseId: "case1",
      title: "LAB-001 potassium + medication risk extraction",
      score,
      maxScore: 20,
      feedback:
        score >= 16
          ? "Strong extraction of key safety details."
          : "Re-check LAB-001 latest potassium and active potassium-risk medications.",
    });
  }

  {
    let score = 0;
    const userA1c = parseNumeric(answers.case2A1c);
    const userLdl = parseNumeric(answers.case2Ldl);
    if (sameNumber(userA1c, truth.lab002A1c)) score += 10;
    if (sameNumber(userLdl, truth.lab002Ldl)) score += 10;
    cases.push({
      caseId: "case2",
      title: "LAB-002 A1c + LDL extraction",
      score,
      maxScore: 20,
      feedback:
        score >= 16
          ? "Good extraction of cardiometabolic targets."
          : "Re-check the latest LAB-002 HbA1c and LDL values in labs.",
    });
  }

  {
    let score = 0;
    const med = normalize(answers.case3Medication);
    if (med.includes("isotretinoin")) score += 10;
    const userHcg = parseNumeric(answers.case3Hcg);
    if (sameNumber(userHcg, truth.lab003Hcg)) score += 10;
    cases.push({
      caseId: "case3",
      title: "LAB-003 teratogenic med + pregnancy test extraction",
      score,
      maxScore: 20,
      feedback:
        score >= 16
          ? "Good extraction of pregnancy-related safety signals."
          : "Re-check LAB-003 current acne med and latest hCG result.",
    });
  }

  {
    let score = 0;
    const userFlu = parseNumeric(answers.case4FluCount);
    if (sameNumber(userFlu, truth.bronxFluCount, 0.01)) score += 20;
    cases.push({
      caseId: "case4",
      title: "Bronx 50 cohort influenza count",
      score,
      maxScore: 20,
      feedback:
        score === 20
          ? "Correct cohort-level immunization count."
          : "Re-run Bronx cohort influenza count and verify denominator = 50.",
    });
  }

  {
    let score = 0;
    const userA1cCount = parseNumeric(answers.case5A1cCount);
    if (sameNumber(userA1cCount, truth.bronxA1cHighCount, 0.01)) score += 15;

    const providedIds = normalize(answers.case5PatientIds)
      .split(/[\s,;]+/)
      .map((id) => id.toUpperCase())
      .filter((id) => id.startsWith("PT-"));
    const truthIdSet = new Set(truth.bronxA1cHighIds);
    const matched = providedIds.filter((id) => truthIdSet.has(id));
    if (providedIds.length > 0 && matched.length === truth.bronxA1cHighIds.length) {
      score += 5;
    }

    cases.push({
      caseId: "case5",
      title: "Bronx 50 cohort A1c>=8 count (+ optional IDs)",
      score,
      maxScore: 20,
      feedback:
        score >= 15
          ? "Count extraction is on track."
          : "Re-check Bronx cohort A1c>=8 calculation and patient IDs.",
    });
  }

  const maxScore = cases.reduce((sum, c) => sum + c.maxScore, 0);
  const total = cases.reduce((sum, c) => sum + c.score, 0);

  return {
    overallScore: Math.round((total / maxScore) * 100),
    maxScore,
    cases,
    groundTruthReference: {
      ...truth,
    },
  };
}

export async function appendBenchSubmission(record: BenchSubmissionRecord): Promise<void> {
  const dir = path.dirname(STORAGE_PATH);
  await mkdir(dir, { recursive: true });
  await appendFile(STORAGE_PATH, `${JSON.stringify(record)}\n`, "utf8");
}

export async function readBenchSubmissions(): Promise<BenchSubmissionRecord[]> {
  try {
    const raw = await readFile(STORAGE_PATH, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as BenchSubmissionRecord)
      .filter((r) => Boolean(r?.id && r?.student?.email));
  } catch {
    return [];
  }
}

export function buildBenchAnalytics(
  records: BenchSubmissionRecord[],
  viewerEmail: string
): {
  scope: "student" | "class";
  scopeLabel: string;
  submissionCount: number;
  averageOverall: number;
  averageByCase: Array<{ caseId: string; title: string; avgScore: number; maxScore: number }>;
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
      ? Math.round(
          scoped.reduce((sum, r) => sum + r.grade.overallScore, 0) / submissionCount
        )
      : 0;

  const caseTemplate = scoped[0]?.grade.cases || [];
  const averageByCase = caseTemplate.map((c) => {
    const sum = scoped.reduce((acc, r) => {
      const found = r.grade.cases.find((x) => x.caseId === c.caseId);
      return acc + (found?.score || 0);
    }, 0);
    return {
      caseId: c.caseId,
      title: c.title,
      avgScore: submissionCount > 0 ? Number((sum / submissionCount).toFixed(1)) : 0,
      maxScore: c.maxScore,
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
    averageByCase,
    recent,
  };
}

function stringifySubmissionForEmail(record: BenchSubmissionRecord): string {
  const lines: string[] = [];
  lines.push("Fordham Health Bench Submission");
  lines.push(`Submission ID: ${record.id}`);
  lines.push(`Submitted At: ${record.createdAt}`);
  lines.push(`Student: ${record.student.name} <${record.student.email}>`);
  lines.push(`Overall Score: ${record.grade.overallScore}/100`);
  lines.push("");
  lines.push("Per-case scores:");
  for (const c of record.grade.cases) {
    lines.push(`- ${c.title}: ${c.score}/${c.maxScore}`);
  }
  lines.push("");
  lines.push("Answers:");
  lines.push(JSON.stringify(record.answers, null, 2));
  return lines.join("\n");
}

export async function forwardBenchSubmissionEmail(
  record: BenchSubmissionRecord
): Promise<{ forwarded: boolean; message: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { forwarded: false, message: "RESEND_API_KEY is not configured." };
  }

  const to = process.env.EXTRACREDIT_NOTIFY_EMAIL || PROFESSOR_EMAIL;
  const from =
    process.env.RESEND_FROM_EMAIL || "Fordham Health Bench <bench@fordms.com>";

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
        subject: `[Fordham Health Bench] ${record.student.name || record.student.email} · ${record.grade.overallScore}/100`,
        text: stringifySubmissionForEmail(record),
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
