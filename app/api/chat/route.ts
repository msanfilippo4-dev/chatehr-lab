import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface IncomingRagChunk {
  source: string;
  title: string;
  text: string;
}

const MAX_HISTORY_MESSAGES = Math.max(
  6,
  Number.parseInt(process.env.CHAT_HISTORY_MESSAGES || "18", 10) || 18
);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const routeStartMs = Date.now();
    const body = await req.json();
    const { messages, context, modelName, systemInstruction, temperature, ragChunks } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const normalizedMessages = (messages as unknown[])
      .map((msg: unknown) => {
        const candidate = msg as Partial<IncomingMessage>;
        const role = candidate.role === "user" ? "user" : "assistant";
        const content = typeof candidate.content === "string" ? candidate.content.trim() : "";
        return { role, content };
      })
      .filter((msg) => msg.content.length > 0) as IncomingMessage[];

    if (normalizedMessages.length === 0) {
      return NextResponse.json(
        { error: "At least one non-empty message is required" },
        { status: 400 }
      );
    }
    const clippedMessages = normalizedMessages.slice(-MAX_HISTORY_MESSAGES);

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

    // -----------------------------------------------------------------------
    // STUDENT-CONFIGURABLE: Model name from LabConfigPanel dropdown
    // Wrong/retired model names produce API errors by design for the lab.
    // -----------------------------------------------------------------------
    const resolvedModel =
      typeof modelName === "string" && modelName.trim() ? modelName.trim() : "";

    if (!resolvedModel) {
      return NextResponse.json(
          {
            error: "Model name is required",
            hint: "Choose a model in Lab Configuration (for example, gemini-flash-latest).",
          },
          { status: 400 }
        );
    }

    // -----------------------------------------------------------------------
    // STUDENT-CONFIGURABLE: System instruction from textarea
    // -----------------------------------------------------------------------
    const ragContext =
      Array.isArray(ragChunks) && ragChunks.length > 0
        ? `\n\nRELEVANT CLINICAL GUIDELINES:\n${ragChunks
            .map(
              (c: IncomingRagChunk) =>
                `[${c.source}] ${c.title}:\n${c.text}`
            )
            .join("\n\n")}`
        : "";

    const resolvedSystemInstruction =
      typeof systemInstruction === "string" ? systemInstruction.trim() : "";

    const contextBlock = `PATIENT EHR CONTEXT:\n${
      typeof context === "string" && context.trim() ? context : "No patient selected."
    }${ragContext}`;

    // -----------------------------------------------------------------------
    // STUDENT-CONFIGURABLE: Temperature from slider (0.0 – 1.0)
    // High temperature = inconsistent answers; low = deterministic
    // -----------------------------------------------------------------------
    const resolvedTemperature =
      typeof temperature === "number"
        ? Math.max(0, Math.min(1, temperature))
        : 0.2;

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelConfig: {
      model: string;
      systemInstruction?: string;
      generationConfig: {
        temperature: number;
        maxOutputTokens: number;
      };
    } = {
      model: resolvedModel,
      generationConfig: {
        temperature: resolvedTemperature,
        maxOutputTokens: 1024,
      },
    };
    if (resolvedSystemInstruction) {
      modelConfig.systemInstruction = resolvedSystemInstruction;
    }
    const model = genAI.getGenerativeModel(modelConfig);

    const mappedHistory = clippedMessages.slice(0, -1).map((msg: IncomingMessage) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));
    // Gemini requires history to start with a user turn; drop any leading model messages (e.g. welcome message)
    const firstUserIdx = mappedHistory.findIndex((m) => m.role === "user");
    const history = firstUserIdx >= 0 ? mappedHistory.slice(firstUserIdx) : [];

    const chat = model.startChat({ history });
    const lastMessage = clippedMessages[clippedMessages.length - 1];
    if (lastMessage.role !== "user") {
      return NextResponse.json(
        { error: "Last message must be a user prompt" },
        { status: 400 }
      );
    }

    const contextualizedPrompt = `${contextBlock}\n\nPATIENT QUESTION:\n${lastMessage.content}`;
    const modelStartMs = Date.now();
    const result = await chat.sendMessage(contextualizedPrompt);
    const modelLatencyMs = Date.now() - modelStartMs;
    const response = result.response;
    const responseText = response.text();

    // Extract token usage
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;

    // Lab estimate only: simplified flash-tier pricing for side-by-side comparisons.
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
        model: resolvedModel,
        modelLatencyMs,
        totalLatencyMs: Date.now() - routeStartMs,
        historyMessagesUsed: clippedMessages.length,
      },
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);

    const err = error as { message?: string };
    let errorMessage = err.message || "Failed to process chat request";
    let hint = "";

    if (
      err.message?.includes("not found") ||
      err.message?.includes("invalid") ||
      err.message?.includes("models/")
    ) {
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
