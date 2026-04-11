import { DEFAULT_CONFIG, TEACHING_PRESETS } from "./constants";
import type { ConfigSnapshot, TeachingPresetId } from "./types";

const STALE_PRESET_MODEL_OVERRIDES: Partial<
  Record<
    TeachingPresetId,
    Array<Pick<ConfigSnapshot, "modelProvider" | "modelName">>
  >
> = {
  "small-cheap": [
    {
      modelProvider: "openrouter",
      modelName: "qwen/qwen3-4b:free",
    },
    {
      modelProvider: "openrouter",
      modelName: "openai/gpt-oss-20b:free",
    },
    {
      modelProvider: "openrouter",
      modelName: "openai/gpt-oss-20b",
    },
  ],
  "high-variance-creative": [
    {
      modelProvider: "openrouter",
      modelName: "mistralai/mistral-small-3.1-24b-instruct:free",
    },
    {
      modelProvider: "openrouter",
      modelName: "meta-llama/llama-3.3-70b-instruct:free",
    },
  ],
  "large-synthesis": [
    {
      modelProvider: "openrouter",
      modelName: "openai/gpt-oss-120b:free",
    },
  ],
};

const CONFIG_COMPARISON_KEYS: Array<keyof ConfigSnapshot> = [
  "modelProvider",
  "modelName",
  "fallbackModel",
  "maxOutputTokens",
  "requestTimeoutMs",
  "retries",
  "temperature",
  "topP",
  "topK",
  "frequencyPenalty",
  "presencePenalty",
  "systemInstruction",
  "styleProfile",
  "responseFormat",
  "fewShotCount",
  "safetyPreambleEnabled",
  "citationRequired",
  "abstainRule",
  "contextLevel",
  "noteWindow",
  "sectionToggles",
  "summaryPrepass",
  "ragEnabled",
  "ragTopK",
  "ragMethod",
  "ragReranker",
  "historyDepth",
  "memoryStrategy",
  "confidenceFloor",
  "perTurnTokenBudget",
  "perRunBudgetCap",
];

const NON_MODEL_COMPARISON_KEYS = CONFIG_COMPARISON_KEYS.filter(
  (key) => key !== "modelProvider" && key !== "modelName"
);
const NON_MODEL_OR_FALLBACK_COMPARISON_KEYS = NON_MODEL_COMPARISON_KEYS.filter(
  (key) => key !== "fallbackModel"
);

function buildExpectedPresetConfig(
  presetId: TeachingPresetId,
  modelOverride?: Pick<ConfigSnapshot, "modelProvider" | "modelName">
) {
  const preset = TEACHING_PRESETS.find((item) => item.id === presetId);
  if (!preset) {
    return null;
  }

  return {
    ...DEFAULT_CONFIG,
    ...preset.config,
    ...(modelOverride ?? {}),
    presetId,
  } satisfies ConfigSnapshot;
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, normalizeValue(nestedValue)])
    );
  }

  return value;
}

function valuesMatch(left: unknown, right: unknown) {
  return JSON.stringify(normalizeValue(left)) === JSON.stringify(normalizeValue(right));
}

function findStarterPresetCandidate(config: ConfigSnapshot) {
  if (config.presetId) {
    return TEACHING_PRESETS.find((item) => item.id === config.presetId) ?? null;
  }

  if (!config.name) {
    return null;
  }

  return (
    TEACHING_PRESETS.find(
      (item) => item.title === config.name || item.config.name === config.name
    ) ?? null
  );
}

export function isExactStarterPresetMatch(
  config: ConfigSnapshot,
  presetId: TeachingPresetId
) {
  const expected = buildExpectedPresetConfig(presetId);
  const preset = TEACHING_PRESETS.find((item) => item.id === presetId);

  if (!expected || !preset) {
    return false;
  }

  if (config.name !== preset.title) {
    return false;
  }

  return CONFIG_COMPARISON_KEYS.every((key) =>
    valuesMatch(config[key], expected[key])
  );
}

export function getRepairableStarterPreset(
  config: ConfigSnapshot
) {
  const starterPreset = findStarterPresetCandidate(config);
  const presetId = starterPreset?.id;

  if (!presetId || config.isFrozen) {
    return null;
  }

  const currentExpected = buildExpectedPresetConfig(presetId);
  if (!currentExpected) {
    return null;
  }

  const matchesCurrentPreset = CONFIG_COMPARISON_KEYS.every((key) =>
    valuesMatch(config[key], currentExpected[key])
  );

  if (matchesCurrentPreset) {
    return null;
  }

  const staleOverrides = STALE_PRESET_MODEL_OVERRIDES[presetId];

  if (
    config.name !== starterPreset.title &&
    config.name !== starterPreset.config.name
  ) {
    return null;
  }

  const matchesStarterPresetShape = NON_MODEL_COMPARISON_KEYS.every((key) =>
    valuesMatch(config[key], currentExpected[key])
  );
  const matchesStarterPresetWithoutFallback =
    NON_MODEL_OR_FALLBACK_COMPARISON_KEYS.every((key) =>
      valuesMatch(config[key], currentExpected[key])
    );

  if (
    matchesStarterPresetWithoutFallback &&
    valuesMatch(config.modelProvider, currentExpected.modelProvider) &&
    valuesMatch(config.modelName, currentExpected.modelName) &&
    typeof config.fallbackModel === "string" &&
    config.fallbackModel.trim().length === 0
  ) {
    return starterPreset;
  }

  if (
    matchesStarterPresetShape &&
    config.modelProvider === "openrouter" &&
    config.modelName.endsWith(":free")
  ) {
    return starterPreset;
  }

  for (const staleOverride of staleOverrides ?? []) {
    const staleExpected = buildExpectedPresetConfig(presetId, staleOverride);
    if (
      staleExpected &&
      CONFIG_COMPARISON_KEYS.every((key) =>
        valuesMatch(config[key], staleExpected[key])
      )
    ) {
      return starterPreset;
    }
  }

  return null;
}
