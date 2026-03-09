// ---------------------------------------------------------------------------
// Constants for ChartEHR Project
// ---------------------------------------------------------------------------

import type {
  BenchmarkCategory,
  ConfigSnapshot,
  ContextLevel,
  ModelProvider,
  SectionToggles,
} from "./types";

// ── Model Registry ────────────────────────────────────────────────────────

export interface ModelRegistryEntry {
  provider: ModelProvider;
  displayName: string;
  shortLabel: string;
  maxContext: number;
  inputPricePerMToken: number;
  outputPricePerMToken: number;
  recommendedFor: string;
  tier: "stable" | "free-core" | "free-advanced";
}

export const MODEL_REGISTRY: Record<string, ModelRegistryEntry> = {
  "gemini-2.0-flash": {
    provider: "gemini",
    displayName: "Gemini 2.0 Flash",
    shortLabel: "Gemini Flash",
    maxContext: 1_000_000,
    inputPricePerMToken: 0.075,
    outputPricePerMToken: 0.30,
    recommendedFor: "Stable baseline for benchmarking and judging.",
    tier: "stable",
  },
  "gemini-2.5-flash-preview": {
    provider: "gemini",
    displayName: "Gemini 2.5 Flash Preview",
    shortLabel: "Gemini 2.5 Preview",
    maxContext: 1_000_000,
    inputPricePerMToken: 0.15,
    outputPricePerMToken: 0.60,
    recommendedFor: "Higher-context baseline for note-heavy synthesis.",
    tier: "stable",
  },
  "openai/gpt-oss-20b:free": {
    provider: "openrouter",
    displayName: "OpenRouter · GPT-OSS 20B (Free)",
    shortLabel: "GPT-OSS 20B",
    maxContext: 128_000,
    inputPricePerMToken: 0.05,
    outputPricePerMToken: 0.15,
    recommendedFor: "Fast free-tier reasoning baseline.",
    tier: "free-core",
  },
  "openai/gpt-oss-120b:free": {
    provider: "openrouter",
    displayName: "OpenRouter · GPT-OSS 120B (Free)",
    shortLabel: "GPT-OSS 120B",
    maxContext: 128_000,
    inputPricePerMToken: 0.12,
    outputPricePerMToken: 0.36,
    recommendedFor: "Larger free-tier reasoning model for tougher chart synthesis.",
    tier: "free-core",
  },
  "mistralai/mistral-small-3.1-24b-instruct:free": {
    provider: "openrouter",
    displayName: "OpenRouter · Mistral Small 3.1 24B (Free)",
    shortLabel: "Mistral Small 24B",
    maxContext: 128_000,
    inputPricePerMToken: 0.08,
    outputPricePerMToken: 0.22,
    recommendedFor: "Balanced free-tier model for structured answers.",
    tier: "free-core",
  },
  "meta-llama/llama-3.3-70b-instruct:free": {
    provider: "openrouter",
    displayName: "OpenRouter · Llama 3.3 70B Instruct (Free)",
    shortLabel: "Llama 3.3 70B",
    maxContext: 128_000,
    inputPricePerMToken: 0.10,
    outputPricePerMToken: 0.30,
    recommendedFor: "Large free-tier generalist for nuanced chart summaries.",
    tier: "free-core",
  },
  "qwen/qwen3-4b:free": {
    provider: "openrouter",
    displayName: "OpenRouter · Qwen3 4B (Free)",
    shortLabel: "Qwen3 4B",
    maxContext: 64_000,
    inputPricePerMToken: 0.03,
    outputPricePerMToken: 0.09,
    recommendedFor: "Smallest model to illustrate speed and capability tradeoffs.",
    tier: "free-core",
  },
  "qwen/qwen3-coder:free": {
    provider: "openrouter",
    displayName: "OpenRouter · Qwen3 Coder (Free)",
    shortLabel: "Qwen3 Coder",
    maxContext: 128_000,
    inputPricePerMToken: 0.07,
    outputPricePerMToken: 0.21,
    recommendedFor: "Advanced experiment model to compare domain mismatch.",
    tier: "free-advanced",
  },
  "qwen/qwen3-next-80b-a3b-instruct:free": {
    provider: "openrouter",
    displayName: "OpenRouter · Qwen3 Next 80B A3B (Free)",
    shortLabel: "Qwen3 Next 80B",
    maxContext: 128_000,
    inputPricePerMToken: 0.11,
    outputPricePerMToken: 0.32,
    recommendedFor: "Advanced large free-tier comparison model.",
    tier: "free-advanced",
  },
};

// ── Benchmark Categories ──────────────────────────────────────────────────

export const BENCHMARK_CATEGORIES: BenchmarkCategory[] = [
  "medication_safety",
  "lab_interpretation",
  "guideline_adherence",
  "clinical_summarization",
  "population_health",
  "safety_robustness",
  "bias_equity",
];

// ── Default Section Toggles ───────────────────────────────────────────────

export const DEFAULT_SECTION_TOGGLES: SectionToggles = {
  demographics: true,
  conditions: true,
  medications: true,
  allergies: true,
  labs: true,
  vitals: true,
  immunizations: true,
  visits: true,
  imaging: false,
  socialHistory: false,
  clinicalNotes: false,
};

// ── Default Config Snapshot ───────────────────────────────────────────────

export const DEFAULT_CONFIG: ConfigSnapshot = {
  // Provider / Model
  modelProvider: "gemini",
  modelName: "gemini-2.0-flash",
  fallbackModel: "",
  maxOutputTokens: 1024,
  requestTimeoutMs: 30_000,
  retries: 1,

  // Sampling
  temperature: 0.3,
  topP: 0.95,
  topK: 40,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,

  // Prompt Engineering
  systemInstruction:
    "You are a clinical decision-support assistant. Answer based only on the patient record and any retrieved guidelines. If unsure, say so.",
  styleProfile: "clinical",
  responseFormat: "free-form",
  fewShotCount: 0,
  safetyPreambleEnabled: true,
  citationRequired: false,
  abstainRule: "If you cannot answer with confidence, state that clearly.",

  // Context / RAG
  contextLevel: "STANDARD",
  noteWindow: 5,
  sectionToggles: { ...DEFAULT_SECTION_TOGGLES },
  summaryPrepass: false,
  ragEnabled: false,
  ragTopK: 3,
  ragMethod: "keyword",
  ragReranker: false,

  // Memory
  historyDepth: 10,
  memoryStrategy: "sliding-window",

  // Guardrails
  confidenceFloor: 0.0,
  perTurnTokenBudget: 2048,

  // Budget
  perRunBudgetCap: 1.0,

  // Versioning
  version: 1,
  configHash: "",
  isFrozen: false,
};

// ── Context Levels ────────────────────────────────────────────────────────

export const CONTEXT_LEVELS: Record<ContextLevel, { label: string; description: string }> = {
  LIMITED: {
    label: "Limited",
    description: "Demographics + active conditions only. Minimal token usage.",
  },
  STANDARD: {
    label: "Standard",
    description: "Demographics, conditions, medications, allergies, recent labs, and vitals.",
  },
  FULL: {
    label: "Full",
    description: "Complete patient record including visits, imaging, social history, and notes.",
  },
};

// ── Style Profiles ────────────────────────────────────────────────────────

export const STYLE_PROFILES: Record<string, { label: string; description: string }> = {
  clinical: {
    label: "Clinical",
    description: "Professional medical language, structured format.",
  },
  conversational: {
    label: "Conversational",
    description: "Accessible plain-language explanations for patient communication.",
  },
  terse: {
    label: "Terse",
    description: "Minimal, bullet-point answers. Lowest token usage.",
  },
};

// ── Response Formats ──────────────────────────────────────────────────────

export const RESPONSE_FORMATS: Record<string, { label: string; description: string }> = {
  "free-form": {
    label: "Free-form",
    description: "Natural prose response with no enforced structure.",
  },
  structured: {
    label: "Structured",
    description: "Headings, numbered lists, and labeled sections.",
  },
  "chain-of-thought": {
    label: "Explain With Evidence",
    description: "Show concise reasoning anchored in chart evidence before the answer.",
  },
};

// ── Tournament Weights ────────────────────────────────────────────────────

export const TOURNAMENT_WEIGHTS = {
  accuracy: 0.55,
  safety: 0.25,
  biasEquity: 0.2,
} as const;

export const CORE_MODEL_IDS = Object.entries(MODEL_REGISTRY)
  .filter(([, entry]) => entry.tier !== "free-advanced")
  .map(([modelId]) => modelId);

export const ADVANCED_MODEL_IDS = Object.entries(MODEL_REGISTRY)
  .filter(([, entry]) => entry.tier === "free-advanced")
  .map(([modelId]) => modelId);
