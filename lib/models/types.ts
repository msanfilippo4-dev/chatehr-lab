import type {
  CostBreakdown,
  ModelProvider,
  ModelRequest,
  ModelResponse,
} from "@/lib/types";

export type { CostBreakdown, ModelRequest, ModelResponse };

export interface ModelAdapter {
  provider: ModelProvider;
  modelName: string;
  assertAvailable?(): Promise<void>;
  chat(request: ModelRequest): Promise<ModelResponse>;
  estimateCost(inputTokens: number, outputTokens: number): CostBreakdown;
}
