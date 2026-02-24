import { appendFile, mkdir, readFile } from "fs/promises";
import path from "path";

export const PROFESSOR_EMAIL = "msanfilippo4@fordham.edu";
const STORAGE_PATH =
  process.env.SUBMISSIONS_STORAGE_PATH || "/tmp/chatehr_reflection_submissions.jsonl";

export type ReflectionAnswers = {
  q1: string;
  q2: string;
  q3: string;
};

export type ReflectionBenchmark = {
  overallScore: number;
  perQuestion: Array<{
    id: "q1" | "q2" | "q3";
    title: string;
    score: number;
    matchedConcepts: string[];
    missingConcepts: string[];
  }>;
};

export type ReflectionJudge = {
  overallFeedback: string;
  strengths: string[];
  improvements: string[];
  perQuestion: Array<{ id: "q1" | "q2" | "q3"; feedback: string }>;
  model: string | null;
};

export type ReflectionSubmissionRecord = {
  id: string;
  createdAt: string;
  source: "submissions";
  teamName?: string;
  student: {
    name: string;
    email: string;
  };
  answers: ReflectionAnswers;
  benchmark: ReflectionBenchmark;
  judge: ReflectionJudge;
};

export async function appendReflectionSubmission(
  record: ReflectionSubmissionRecord
): Promise<void> {
  const dir = path.dirname(STORAGE_PATH);
  await mkdir(dir, { recursive: true });
  await appendFile(STORAGE_PATH, `${JSON.stringify(record)}\n`, "utf8");
}

export async function readReflectionSubmissions(): Promise<ReflectionSubmissionRecord[]> {
  try {
    const raw = await readFile(STORAGE_PATH, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as ReflectionSubmissionRecord)
      .filter((r) => Boolean(r?.id && r?.student?.email && r?.benchmark?.overallScore >= 0));
  } catch {
    return [];
  }
}

export function buildReflectionAnalytics(
  records: ReflectionSubmissionRecord[],
  viewerEmail: string
): {
  scope: "student" | "class";
  scopeLabel: string;
  submissionCount: number;
  averageOverall: number;
  averageByQuestion: Array<{ id: "q1" | "q2" | "q3"; title: string; avgScore: number }>;
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
      ? Math.round(scoped.reduce((sum, r) => sum + r.benchmark.overallScore, 0) / submissionCount)
      : 0;

  const questionTemplate = scoped[0]?.benchmark.perQuestion || [];
  const averageByQuestion = questionTemplate.map((q) => {
    const sum = scoped.reduce((acc, row) => {
      const found = row.benchmark.perQuestion.find((p) => p.id === q.id);
      return acc + (found?.score || 0);
    }, 0);
    return {
      id: q.id,
      title: q.title,
      avgScore: submissionCount > 0 ? Number((sum / submissionCount).toFixed(1)) : 0,
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
      overallScore: r.benchmark.overallScore,
    }));

  return {
    scope: isProfessor ? "class" : "student",
    scopeLabel: isProfessor ? "Class Analytics" : "Your Analytics",
    submissionCount,
    averageOverall,
    averageByQuestion,
    recent,
  };
}

function stringify(record: ReflectionSubmissionRecord): string {
  const lines: string[] = [];
  lines.push("ChatEHR Reflection Submission");
  lines.push(`Submission ID: ${record.id}`);
  lines.push(`Submitted At: ${record.createdAt}`);
  lines.push(`Student: ${record.student.name} <${record.student.email}>`);
  if (record.teamName) {
    lines.push(`Team: ${record.teamName}`);
  }
  lines.push(`Overall Score: ${record.benchmark.overallScore}/100`);
  lines.push("");
  lines.push("Answers:");
  lines.push(JSON.stringify(record.answers, null, 2));
  lines.push("");
  lines.push("Judge Feedback:");
  lines.push(record.judge.overallFeedback);
  return lines.join("\n");
}

export async function forwardReflectionSubmissionEmail(
  record: ReflectionSubmissionRecord
): Promise<{ forwarded: boolean; message: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { forwarded: false, message: "RESEND_API_KEY is not configured." };
  }

  const to = process.env.EXTRACREDIT_NOTIFY_EMAIL || PROFESSOR_EMAIL;
  const from =
    process.env.RESEND_FROM_EMAIL || "Fordham Submissions <submissions@fordms.com>";

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
        subject: `[ChatEHR Submissions] ${record.student.name || record.student.email} · ${record.benchmark.overallScore}/100`,
        text: stringify(record),
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
