import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readJsonBodyWithLimit, trimString } from "@/lib/api-request";
import {
  ExtraCreditAnswers,
  ExtraCreditRecord,
  appendExtraCredit,
  buildExtraCreditAnalytics,
  forwardExtraCreditEmail,
  gradeExtraCredit,
  readExtraCredit,
} from "../_lib";

function parseAnswers(payload: unknown): ExtraCreditAnswers | null {
  const body = payload as { answers?: Record<string, unknown> };
  const answers = body?.answers;
  if (!answers || typeof answers !== "object") return null;

  const required = [
    "exam1Potassium",
    "exam1ActiveMed",
    "exam1DiscontinuedMed",
    "exam2NoFluCount",
    "exam2CkdCount",
    "exam3BronxHighA1cCount",
    "exam3BronxIds",
  ] as const;

  const parsed: Record<string, string> = {};
  for (const key of required) {
    parsed[key] = trimString(answers[key], 2000);
  }

  if (
    !parsed.exam1Potassium ||
    !parsed.exam1ActiveMed ||
    !parsed.exam1DiscontinuedMed ||
    !parsed.exam2NoFluCount ||
    !parsed.exam2CkdCount ||
    !parsed.exam3BronxHighA1cCount
  ) {
    return null;
  }

  return parsed as ExtraCreditAnswers;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = await readJsonBodyWithLimit<{ answers?: unknown }>(req, 60_000);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const payload = parsed.data;
    const answers = parseAnswers(payload);
    if (!answers) {
      return NextResponse.json(
        { error: "Please complete all required extra credit fields." },
        { status: 400 }
      );
    }

    const grade = await gradeExtraCredit(answers);

    const record: ExtraCreditRecord = {
      id: `ec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      source: "extracredit",
      student: {
        name: session.user.name || "Student",
        email: session.user.email,
      },
      answers,
      grade,
    };

    await appendExtraCredit(record);
    const delivery = await forwardExtraCreditEmail(record);

    const allRecords = await readExtraCredit();
    const analytics = buildExtraCreditAnalytics(allRecords, session.user.email);

    return NextResponse.json({
      submission: { id: record.id, createdAt: record.createdAt },
      grade,
      analytics,
      delivery,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { error: "Failed to process extra credit submission.", details: err.message },
      { status: 500 }
    );
  }
}
