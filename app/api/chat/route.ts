import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { authOptions } from "@/lib/auth";
import {
  clampNumber,
  normalizeStringArray,
  readJsonBodyWithLimit,
  trimString,
} from "@/lib/api-request";
import { loadRagCorpusCached } from "@/lib/rag-corpus";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

type GeminiResponse = {
  text: () => string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};

type ChatPayload = {
  messages?: unknown;
  context?: unknown;
  modelName?: unknown;
  systemInstruction?: unknown;
  temperature?: unknown;
  ragChunkIds?: unknown;
};

const MAX_HISTORY_MESSAGES = Math.max(
  6,
  Number.parseInt(process.env.CHAT_HISTORY_MESSAGES || "18", 10) || 18
);
const MAX_BODY_BYTES = Math.max(
  100_000,
  Number.parseInt(process.env.CHAT_MAX_BODY_BYTES || "220000", 10) || 220_000
);
const MAX_MESSAGE_CHARS = Math.max(
  200,
  Number.parseInt(process.env.CHAT_MAX_MESSAGE_CHARS || "1600", 10) || 1600
);
const MAX_CONTEXT_CHARS = Math.max(
  3000,
  Number.parseInt(process.env.CHAT_MAX_CONTEXT_CHARS || "14000", 10) || 14_000
);
const MAX_SYSTEM_INSTRUCTION_CHARS = Math.max(
  200,
  Number.parseInt(process.env.CHAT_MAX_SYSTEM_INSTRUCTION_CHARS || "2000", 10) || 2000
);
const MAX_RAG_CHUNKS = 3;
const RETRY_ATTEMPTS = Math.max(
  0,
  Number.parseInt(process.env.CHAT_RETRY_ATTEMPTS || "2", 10) || 2
);
const RETRY_BASE_DELAY_MS = Math.max(
  100,
  Number.parseInt(process.env.CHAT_RETRY_BASE_DELAY_MS || "350", 10) || 350
);
const DEFAULT_ALLOWED_MODELS = [
  "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
];
const ALLOWED_CHAT_MODELS = new Set(
  (process.env.ALLOWED_CHAT_MODELS || DEFAULT_ALLOWED_MODELS.join(","))
    .split(",")
    .map((model) => model.trim())
    .filter((model) => model.length > 0)
);

function normalizeMessages(input: unknown): IncomingMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-MAX_HISTORY_MESSAGES)
    .map((msg: unknown) => {
      const candidate = msg as Partial<IncomingMessage>;
      const role: IncomingMessage["role"] =
        candidate.role === "user" ? "user" : "assistant";
      const content = trimString(candidate.content, MAX_MESSAGE_CHARS);
      return { role, content };
    })
    .filter((msg) => msg.content.length > 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientProviderError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("503") ||
    lower.includes("service unavailable") ||
    lower.includes("high demand") ||
    lower.includes("429") ||
    lower.includes("rate limit")
  );
}

function isModelConfigError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("not found") || lower.includes("invalid") || lower.includes("models/");
}

function buildModelCandidates(primary: string): string[] {
  const candidates: string[] = [primary];
  const fallback = "gemini-flash-lite-latest";
  if (primary !== fallback && ALLOWED_CHAT_MODELS.has(fallback)) {
    candidates.push(fallback);
  }
  return candidates;
}

async function sendMessageResiliently({
  genAI,
  modelCandidates,
  resolvedSystemInstruction,
  resolvedTemperature,
  history,
  prompt,
}: {
  genAI: GoogleGenerativeAI;
  modelCandidates: string[];
  resolvedSystemInstruction: string;
  resolvedTemperature: number;
  history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
  prompt: string;
}): Promise<{
  response: GeminiResponse;
  modelUsed: string;
  attempts: number;
}> {
  let lastError: unknown = null;
  let totalAttempts = 0;

  for (const candidateModel of modelCandidates) {
    const model = genAI.getGenerativeModel({
      model: candidateModel,
      generationConfig: {
        temperature: resolvedTemperature,
        maxOutputTokens: 1024,
      },
      ...(resolvedSystemInstruction ? { systemInstruction: resolvedSystemInstruction } : {}),
    });
    const chat = model.startChat({ history });

    for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
      totalAttempts += 1;
      try {
        const result = await chat.sendMessage(prompt);
        return {
          response: result.response,
          modelUsed: candidateModel,
          attempts: totalAttempts,
        };
      } catch (error: unknown) {
        lastError = error;
        const message = (error as { message?: string }).message || "";
        if (!isTransientProviderError(message)) {
          throw error;
        }

        const canRetrySameModel = attempt < RETRY_ATTEMPTS;
        if (canRetrySameModel) {
          const delayMs = RETRY_BASE_DELAY_MS * (attempt + 1);
          await sleep(delayMs);
          continue;
        }
        break;
      }
    }
  }

  throw lastError || new Error("Unable to generate response.");
}

async function buildRagContextFromIds(rawIds: unknown): Promise<{ text: string; chunkCount: number }> {
  const ids = normalizeStringArray(rawIds, {
    maxItems: MAX_RAG_CHUNKS,
    maxItemChars: 80,
  });
  if (ids.length === 0) return { text: "", chunkCount: 0 };

  const { chunks } = await loadRagCorpusCached();
  if (chunks.length === 0) return { text: "", chunkCount: 0 };

  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk] as const));
  const uniqueIds = Array.from(new Set(ids));
  const selected = uniqueIds
    .map((id) => byId.get(id))
    .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk))
    .slice(0, MAX_RAG_CHUNKS);

  if (selected.length === 0) return { text: "", chunkCount: 0 };

  const text =
    "\n\nRELEVANT CLINICAL GUIDELINES:\n" +
    selected
      .map((chunk) => `[${chunk.source}] ${chunk.title}:\n${trimString(chunk.text, 800)}`)
      .join("\n\n");

  return { text, chunkCount: selected.length };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const routeStartMs = Date.now();
    const parsed = await readJsonBodyWithLimit<ChatPayload>(req, MAX_BODY_BYTES);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const body = parsed.data;

    const normalizedMessages = normalizeMessages(body.messages);
    if (normalizedMessages.length === 0) {
      return NextResponse.json(
        { error: "At least one non-empty message is required" },
        { status: 400 }
      );
    }

    const lastMessage = normalizedMessages[normalizedMessages.length - 1];
    if (lastMessage.role !== "user") {
      return NextResponse.json(
        { error: "Last message must be a user prompt" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY is not configured",
          hint: "Add GEMINI_API_KEY=your_key to .env.local and restart the dev server",
        },
        { status: 500 }
      );
    }

    const resolvedModel = trimString(body.modelName, 120);
    if (!resolvedModel) {
      return NextResponse.json(
        {
          error: "Model name is required",
          hint: "Choose a model in Lab Configuration (for example, gemini-flash-latest).",
        },
        { status: 400 }
      );
    }
    if (!ALLOWED_CHAT_MODELS.has(resolvedModel)) {
      return NextResponse.json(
        {
          error: `Model '${resolvedModel}' is not allowed in this lab environment.`,
          hint: `Use one of: ${Array.from(ALLOWED_CHAT_MODELS).join(", ")}`,
        },
        { status: 400 }
      );
    }

    const resolvedSystemInstruction = trimString(
      body.systemInstruction,
      MAX_SYSTEM_INSTRUCTION_CHARS
    );
    const context = trimString(body.context, MAX_CONTEXT_CHARS);
    const resolvedTemperature = clampNumber(body.temperature, 0, 1, 0.2);
    const rag = await buildRagContextFromIds(body.ragChunkIds);

    const contextBlock = `PATIENT EHR CONTEXT:\n${context || "No patient selected."}${rag.text}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelCandidates = buildModelCandidates(resolvedModel);
    const mappedHistory = normalizedMessages.slice(0, -1).map((msg: IncomingMessage) => ({
      role: (msg.role === "user" ? "user" : "model") as "user" | "model",
      parts: [{ text: msg.content }],
    }));
    // Gemini requires history to start with a user turn; drop leading model messages (welcome text).
    const firstUserIdx = mappedHistory.findIndex((m) => m.role === "user");
    const history = firstUserIdx >= 0 ? mappedHistory.slice(firstUserIdx) : [];

    const contextualizedPrompt = `${contextBlock}\n\nPATIENT QUESTION:\n${lastMessage.content}`;

    const modelStartMs = Date.now();
    const { response, modelUsed, attempts } = await sendMessageResiliently({
      genAI,
      modelCandidates,
      resolvedSystemInstruction,
      resolvedTemperature,
      history,
      prompt: contextualizedPrompt,
    });
    const modelLatencyMs = Date.now() - modelStartMs;
    const responseText = response.text();

    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;
    const estimatedCost =
      (inputTokens / 1_000_000) * 0.075 +
      (outputTokens / 1_000_000) * 0.3;

    return NextResponse.json({
      text: responseText,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCost,
        model: modelUsed,
        modelLatencyMs,
        totalLatencyMs: Date.now() - routeStartMs,
        historyMessagesUsed: normalizedMessages.length,
        ragChunksUsed: rag.chunkCount,
        requestAttempts: attempts,
      },
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);

    const err = error as { message?: string };
    const errorMessage = err.message || "Failed to process chat request";
    let hint = "";

    if (isTransientProviderError(errorMessage)) {
      hint =
        "Gemini is under temporary load. Retry in a few seconds or switch to 'gemini-flash-lite-latest'.";
      return NextResponse.json(
        { error: errorMessage, hint },
        { status: 503 }
      );
    }

    if (isModelConfigError(errorMessage)) {
      hint =
        "Check the model selected in Lab Configuration. Try 'gemini-flash-latest'.";
    } else if (err.message?.includes("API key")) {
      hint = "Check that GEMINI_API_KEY is set in .env.local";
    }

    return NextResponse.json(
      { error: errorMessage, hint },
      { status: 500 }
    );
  }
}
