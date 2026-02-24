import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { authOptions } from "@/lib/auth";
import {
  appendReflectionSubmission,
  buildReflectionAnalytics,
  forwardReflectionSubmissionEmail,
  readReflectionSubmissions,
  ReflectionSubmissionRecord,
} from "../_lib";

type SubmissionAnswers = {
  q1: string;
  q2: string;
  q3: string;
};

type ConceptRubric = {
  id: string;
  description: string;
  terms: string[];
};

type QuestionRubric = {
  id: keyof SubmissionAnswers;
  title: string;
  concepts: ConceptRubric[];
};

type PerQuestionScore = {
  id: keyof SubmissionAnswers;
  title: string;
  score: number;
  matchedConcepts: string[];
  missingConcepts: string[];
};

type JudgeFeedback = {
  overallFeedback: string;
  strengths: string[];
  improvements: string[];
  perQuestion: Array<{ id: keyof SubmissionAnswers; feedback: string }>;
  model: string | null;
};

const RUBRIC: QuestionRubric[] = [
  {
    id: "q1",
    title: "Medication safety + chart evidence",
    concepts: [
      {
        id: "q1-risk",
        description: "Identifies a concrete safety risk from chart context.",
        terms: ["risk", "unsafe", "hyperkalemia", "ckd", "kidney", "potassium"],
      },
      {
        id: "q1-evidence",
        description: "Cites chart evidence (labs/meds/history) to justify claim.",
        terms: ["lab", "med", "history", "lisinopril", "spironolactone", "5.8", "evidence"],
      },
      {
        id: "q1-mitigation",
        description: "Provides an actionable mitigation or safer alternative.",
        terms: ["avoid", "hold", "monitor", "follow-up", "mitigation", "safer", "alternative"],
      },
    ],
  },
  {
    id: "q2",
    title: "RAG comparison quality",
    concepts: [
      {
        id: "q2-compare",
        description: "Explicitly compares RAG OFF vs RAG ON behavior.",
        terms: ["rag off", "without rag", "rag on", "with rag", "compare"],
      },
      {
        id: "q2-specificity",
        description: "Discusses specificity/grounding changes.",
        terms: ["specific", "ground", "guideline", "evidence", "generic"],
      },
      {
        id: "q2-uncertainty",
        description: "Comments on confidence/uncertainty calibration.",
        terms: ["confidence", "uncertain", "uncertainty", "limitations", "verify"],
      },
    ],
  },
  {
    id: "q3",
    title: "Minimum necessary privacy decision",
    concepts: [
      {
        id: "q3-context",
        description: "Chooses a context level and explains why.",
        terms: ["limited", "standard", "full", "context level", "minimum necessary"],
      },
      {
        id: "q3-privacy",
        description: "Addresses privacy/sensitive-info exposure risk.",
        terms: ["privacy", "sensitive", "over-share", "redact", "need to know"],
      },
      {
        id: "q3-safe",
        description: "Balances privacy with clinical safety and usefulness.",
        terms: ["safe", "safety", "useful", "clinically relevant", "tradeoff", "balance"],
      },
    ],
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAny(answer: string, terms: string[]): boolean {
  const a = normalize(answer);
  return terms.some((term) => a.includes(term.toLowerCase()));
}

function scoreAnswers(answers: SubmissionAnswers): {
  overallScore: number;
  perQuestion: PerQuestionScore[];
} {
  const perQuestion = RUBRIC.map((q): PerQuestionScore => {
    const answer = answers[q.id] || "";
    const matched = q.concepts.filter((c) => containsAny(answer, c.terms));
    const missing = q.concepts.filter((c) => !containsAny(answer, c.terms));
    const score = Math.round((matched.length / q.concepts.length) * 100);
    return {
      id: q.id,
      title: q.title,
      score,
      matchedConcepts: matched.map((c) => c.description),
      missingConcepts: missing.map((c) => c.description),
    };
  });

  const overallScore = Math.round(
    perQuestion.reduce((sum, q) => sum + q.score, 0) / perQuestion.length
  );

  return { overallScore, perQuestion };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced =
    trimmed.match(/```json\s*([\s\S]*?)```/i) ||
    trimmed.match(/```([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Unable to parse judge JSON");
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").slice(0, 3);
}

function defaultJudgeFeedback(
  benchmark: { perQuestion: PerQuestionScore[] },
  reason?: string
): JudgeFeedback {
  return {
    overallFeedback:
      reason ||
      "Automated benchmark completed. Review missing concepts and strengthen evidence citations.",
    strengths: benchmark.perQuestion
      .filter((q) => q.score >= 67)
      .map((q) => `Strong coverage in ${q.title}.`)
      .slice(0, 3),
    improvements: benchmark.perQuestion
      .filter((q) => q.score < 67)
      .map((q) => `Improve ${q.title} by adding evidence and clearer reasoning.`)
      .slice(0, 3),
    perQuestion: benchmark.perQuestion.map((q) => ({
      id: q.id,
      feedback:
        q.score >= 67
          ? "Good foundation. Tighten wording and keep claims chart-grounded."
          : "Needs more concrete evidence and clearer justification.",
    })),
    model: null,
  };
}

async function getJudgeFeedback(
  answers: SubmissionAnswers,
  benchmark: { overallScore: number; perQuestion: PerQuestionScore[] }
): Promise<JudgeFeedback> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return defaultJudgeFeedback(benchmark, "Judge model unavailable: GEMINI_API_KEY is not configured.");
  }

  try {
    const judgeModel = "gemini-flash-lite-latest";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: judgeModel,
      generationConfig: { temperature: 0.1, maxOutputTokens: 600 },
      systemInstruction:
        "You are a strict but constructive evaluator for a healthcare AI lab. " +
        "Provide formative feedback only. Do not reveal full canonical answers.",
    });

    const rubricSummary = RUBRIC.map((q) => ({
      id: q.id,
      title: q.title,
      concepts: q.concepts.map((c) => c.description),
    }));

    const prompt = [
      "Evaluate the student's submission.",
      "Return ONLY valid JSON with this schema:",
      JSON.stringify(
        {
          overall_feedback: "string",
          strengths: ["string"],
          improvements: ["string"],
          per_question: [{ id: "q1|q2|q3", feedback: "string" }],
        },
        null,
        2
      ),
      "",
      `Benchmark score: ${benchmark.overallScore}`,
      `Rubric: ${JSON.stringify(rubricSummary)}`,
      `Per-question benchmark: ${JSON.stringify(benchmark.perQuestion)}`,
      `Student answers: ${JSON.stringify(answers)}`,
      "Keep feedback concise and actionable.",
    ].join("\n");

    const result = await model.generateContent(prompt);
    const parsed = extractJsonObject(result.response.text()) as Record<string, unknown>;
    const perQuestionRaw = Array.isArray(parsed.per_question) ? parsed.per_question : [];

    const perQuestion = perQuestionRaw
      .map((item) => {
        const obj = item as Record<string, unknown>;
        const id = obj.id;
        const feedback = obj.feedback;
        if ((id === "q1" || id === "q2" || id === "q3") && typeof feedback === "string") {
          return { id, feedback };
        }
        return null;
      })
      .filter((v): v is { id: keyof SubmissionAnswers; feedback: string } => v !== null);

    const judge: JudgeFeedback = {
      overallFeedback:
        typeof parsed.overall_feedback === "string"
          ? parsed.overall_feedback
          : "Feedback generated.",
      strengths: asStringArray(parsed.strengths),
      improvements: asStringArray(parsed.improvements),
      perQuestion:
        perQuestion.length > 0
          ? perQuestion
          : defaultJudgeFeedback(benchmark).perQuestion,
      model: judgeModel,
    };

    return judge;
  } catch {
    return defaultJudgeFeedback(
      benchmark,
      "Judge model was unavailable for this run. Deterministic benchmark is still shown."
    );
  }
}

function parseAnswers(payload: unknown): SubmissionAnswers | null {
  const body = payload as { answers?: Record<string, unknown> };
  const answers = body?.answers;
  if (!answers || typeof answers !== "object") return null;

  const q1 = typeof answers.q1 === "string" ? answers.q1.trim() : "";
  const q2 = typeof answers.q2 === "string" ? answers.q2.trim() : "";
  const q3 = typeof answers.q3 === "string" ? answers.q3.trim() : "";

  if (!q1 || !q2 || !q3) return null;
  return { q1, q2, q3 };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const answers = parseAnswers(payload);
    if (!answers) {
      return NextResponse.json(
        { error: "Please answer all benchmark questions before submitting." },
        { status: 400 }
      );
    }

    const benchmark = scoreAnswers(answers);
    const judge = await getJudgeFeedback(answers, benchmark);
    const now = new Date().toISOString();
    const record: ReflectionSubmissionRecord = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      source: "submissions",
      student: {
        name: session.user?.name || "Student",
        email: session.user?.email || "unknown@fordham.edu",
      },
      answers,
      benchmark,
      judge,
    };
    await appendReflectionSubmission(record);
    const delivery = await forwardReflectionSubmissionEmail(record);
    const allRecords = await readReflectionSubmissions();
    const analytics = buildReflectionAnalytics(
      allRecords,
      session.user?.email || "unknown@fordham.edu"
    );

    return NextResponse.json({
      submission: {
        id: record.id,
        createdAt: record.createdAt,
      },
      submittedAt: now,
      benchmark,
      judge,
      analytics,
      delivery,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { error: "Failed to evaluate submission.", details: err.message },
      { status: 500 }
    );
  }
}
