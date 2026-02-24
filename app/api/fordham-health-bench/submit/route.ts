import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  BenchSubmissionRecord,
  FordhamHealthBenchAnswers,
  appendBenchSubmission,
  buildBenchAnalytics,
  forwardBenchSubmissionEmail,
  gradeFordhamHealthBench,
  readBenchSubmissions,
} from "../_lib";

function parseAnswers(payload: unknown): FordhamHealthBenchAnswers | null {
  const body = payload as { answers?: Record<string, unknown> };
  const answers = body?.answers;
  if (!answers || typeof answers !== "object") return null;

  const required = [
    "case1Potassium",
    "case1Medication",
    "case2A1c",
    "case2Ldl",
    "case3Medication",
    "case3Hcg",
    "case4FluCount",
    "case5A1cCount",
    "case5PatientIds",
  ] as const;

  const parsed: Record<string, string> = {};
  for (const key of required) {
    const value = answers[key];
    if (typeof value !== "string") return null;
    parsed[key] = value.trim();
  }

  if (
    !parsed.case1Potassium ||
    !parsed.case1Medication ||
    !parsed.case2A1c ||
    !parsed.case2Ldl ||
    !parsed.case3Medication ||
    !parsed.case3Hcg ||
    !parsed.case4FluCount ||
    !parsed.case5A1cCount
  ) {
    return null;
  }

  return parsed as FordhamHealthBenchAnswers;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const answers = parseAnswers(payload);
    if (!answers) {
      return NextResponse.json(
        { error: "Please complete all required benchmark fields." },
        { status: 400 }
      );
    }

    const grade = await gradeFordhamHealthBench(answers);

    const record: BenchSubmissionRecord = {
      id: `fhb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      source: "fordham-health-bench",
      student: {
        name: session.user.name || "Student",
        email: session.user.email,
      },
      answers,
      grade,
    };

    await appendBenchSubmission(record);
    const emailStatus = await forwardBenchSubmissionEmail(record);

    const allRecords = await readBenchSubmissions();
    const analytics = buildBenchAnalytics(allRecords, session.user.email);

    return NextResponse.json({
      submission: {
        id: record.id,
        createdAt: record.createdAt,
      },
      grade,
      analytics,
      delivery: emailStatus,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { error: "Failed to process benchmark submission.", details: err.message },
      { status: 500 }
    );
  }
}
