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
  private readonly apiKey: string;

  constructor(modelName: string) {
    const apiKey =
      process.env.OPEN_ROUTER_KEY ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPEN_ROUTER_KEY or OPENROUTER_API_KEY environment variable is not set."
      );
    }

    this.apiKey = apiKey;
    this.modelName = modelName;
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": normalizeOpenRouterReferer(process.env.NEXTAUTH_URL),
        "X-Title": "ChartEHR Project",
      },
    });
  }

  async assertAvailable() {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to verify OpenRouter model availability (${response.status}).`
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ id?: string | null }>;
    };

    const available = payload.data?.some((model) => model.id === this.modelName);
    if (!available) {
      throw new Error(
        `OpenRouter model "${this.modelName}" is not currently available. Choose a different model and try again.`
      );
    }
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

function normalizeOpenRouterReferer(value?: string | null) {
  const fallback = "http://localhost:3000";
  if (!value) return fallback;

  try {
    return new URL(value).toString();
  } catch {
    return new URL(`https://${value}`).toString();
  }
}
