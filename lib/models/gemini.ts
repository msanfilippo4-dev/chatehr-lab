// ---------------------------------------------------------------------------
// Gemini model adapter — wraps @google/generative-ai SDK
// ---------------------------------------------------------------------------

import { GoogleGenerativeAI, type ResponseSchema } from "@google/generative-ai";
import type { ModelAdapter, ModelRequest, ModelResponse, CostBreakdown } from "./types";
import { estimateCost } from "../pricing";

export class GeminiAdapter implements ModelAdapter {
  public readonly provider = "gemini";
  public readonly modelName: string;

  private readonly client: GoogleGenerativeAI;

  constructor(modelName: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set.");
    }
    this.modelName = modelName;
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async chat(req: ModelRequest): Promise<ModelResponse> {
    const startMs = Date.now();

    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: req.systemInstruction || undefined,
      generationConfig: {
        temperature: req.temperature,
        topP: req.topP,
        topK: req.topK,
        maxOutputTokens: req.maxOutputTokens,
        responseMimeType: req.responseMimeType,
        responseSchema: req.responseJsonSchema as ResponseSchema | undefined,
      },
    });

    // Build Gemini contents array from message history.
    // Gemini uses "user" and "model" roles (not "assistant").
    // System messages are handled via systemInstruction above,
    // so we filter them out of the contents array.
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const result = await model.generateContent({ contents });
    const response = result.response;
    const text = response.text();

    const latencyMs = Date.now() - startMs;

    // Extract token usage from response metadata
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0;

    // Map finish reason
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason ?? "UNKNOWN";

    return {
      text,
      inputTokens,
      outputTokens,
      model: this.modelName,
      latencyMs,
      finishReason,
    };
  }

  estimateCost(inputTokens: number, outputTokens: number): CostBreakdown {
    return estimateCost(this.modelName, inputTokens, outputTokens);
  }
}
