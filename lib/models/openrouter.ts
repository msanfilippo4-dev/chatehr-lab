// ---------------------------------------------------------------------------
// OpenRouter model adapter — uses the OpenAI-compatible OpenRouter API
// ---------------------------------------------------------------------------

import OpenAI from "openai";
import type {
  CostBreakdown,
  ModelAdapter,
  ModelRequest,
  ModelResponse,
} from "./types";
import { estimateCost } from "../pricing";

export class OpenRouterAdapter implements ModelAdapter {
  public readonly provider = "openrouter";
  public readonly modelName: string;

  private readonly client: OpenAI;

  constructor(modelName: string) {
    const apiKey = process.env.OPEN_ROUTER_KEY;
    if (!apiKey) {
      throw new Error("OPEN_ROUTER_KEY environment variable is not set.");
    }

    this.modelName = modelName;
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL || "http://localhost:3000",
        "X-Title": "ChartEHR Project",
      },
    });
  }

  async chat(req: ModelRequest): Promise<ModelResponse> {
    const startMs = Date.now();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (req.systemInstruction) {
      messages.push({ role: "system", content: req.systemInstruction });
    }

    for (const message of req.messages) {
      messages.push({
        role:
          message.role === "system"
            ? "system"
            : message.role === "assistant"
              ? "assistant"
              : "user",
        content: message.content,
      });
    }

    const completion = await this.client.chat.completions.create({
      model: this.modelName,
      messages,
      temperature: req.temperature,
      max_tokens: req.maxOutputTokens,
      top_p: req.topP,
    });

    const latencyMs = Date.now() - startMs;
    const choice = completion.choices[0];
    const usage = completion.usage;

    return {
      text: choice?.message?.content ?? "",
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      model: this.modelName,
      latencyMs,
      finishReason: choice?.finish_reason ?? "unknown",
    };
  }

  estimateCost(inputTokens: number, outputTokens: number): CostBreakdown {
    return estimateCost(this.modelName, inputTokens, outputTokens);
  }
}
