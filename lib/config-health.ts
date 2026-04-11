import { KNOWN_RETIRED_MODEL_IDS, MODEL_REGISTRY } from "@/lib/constants";
import { ModelExecutionError, normalizeModelExecutionError } from "@/lib/model-execution";
import { createModelAdapter } from "@/lib/models";
import { getRepairableStarterPreset } from "@/lib/starter-presets";
import type { ConfigSnapshot } from "@/lib/types";

const PROBE_CACHE_TTL_MS = 5 * 60 * 1000;

type ProbeCacheEntry =
  | { checkedAt: number; ok: true }
  | {
      checkedAt: number;
      ok: false;
      error: ReturnType<ModelExecutionError["toJSON"]>;
    };

const probeCache = new Map<string, ProbeCacheEntry>();

export interface ConfigHealthSummary {
  isBatchRunnable: boolean;
  invalidCode: string | null;
  invalidReason: string | null;
  needsPresetRefresh: boolean;
}

export interface InvalidConfigSummary {
  configId: string | null;
  configName: string;
  reason: string;
  code: string;
}

function getConfigLabel(config: ConfigSnapshot) {
  return config.name?.trim() || config.modelName || "Saved Config";
}

function getProbeCacheKey(config: ConfigSnapshot) {
  return `${config.modelProvider}:${config.modelName}`;
}

function isOpenRouterFreeTierModel(config: ConfigSnapshot) {
  return (
    config.modelProvider === "openrouter" &&
    config.modelName.trim().toLowerCase().endsWith(":free")
  );
}

async function withProbeTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  provider: string,
  modelName: string
) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new ModelExecutionError({
              code: "timeout",
              message: `The model health check timed out after ${Math.round(timeoutMs / 1000)}s.`,
              transient: true,
              provider,
              modelName,
              status: 504,
              rawMessage: `Timed out after ${timeoutMs}ms`,
            })
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function inspectConfigHealth(config: ConfigSnapshot): ConfigHealthSummary {
  const registryEntry = MODEL_REGISTRY[config.modelName];
  const repairablePreset = getRepairableStarterPreset(config);
  const configLabel = getConfigLabel(config);

  if (repairablePreset) {
    return {
      isBatchRunnable: false,
      invalidCode: "needs_preset_refresh",
      invalidReason: `"${configLabel}" still points to a stale starter preset model. Refresh starter presets before batch runs.`,
      needsPresetRefresh: true,
    };
  }

  if (!registryEntry) {
    return {
      isBatchRunnable: false,
      invalidCode: "unknown_model",
      invalidReason: `"${configLabel}" uses a model that is no longer in the supported registry.`,
      needsPresetRefresh: false,
    };
  }

  if (registryEntry.provider !== config.modelProvider) {
    return {
      isBatchRunnable: false,
      invalidCode: "provider_mismatch",
      invalidReason: `"${configLabel}" uses a ${config.modelProvider} config with a ${registryEntry.provider} model identifier.`,
      needsPresetRefresh: false,
    };
  }

  if (KNOWN_RETIRED_MODEL_IDS.has(config.modelName)) {
    return {
      isBatchRunnable: false,
      invalidCode: "retired_model",
      invalidReason: `"${configLabel}" points to a retired model that can no longer complete batch runs.`,
      needsPresetRefresh: false,
    };
  }

  if (isOpenRouterFreeTierModel(config)) {
    return {
      isBatchRunnable: false,
      invalidCode: "free_tier_model",
      invalidReason: `"${configLabel}" uses an OpenRouter free-tier model. Those variants are not stable enough for benchmark or population-health batch runs.`,
      needsPresetRefresh: false,
    };
  }

  return {
    isBatchRunnable: true,
    invalidCode: null,
    invalidReason: null,
    needsPresetRefresh: false,
  };
}

export async function probeBatchRunnableConfig(config: ConfigSnapshot) {
  const staticHealth = inspectConfigHealth(config);
  if (!staticHealth.isBatchRunnable) {
    return {
      ok: false as const,
      error: {
        code: staticHealth.invalidCode ?? "invalid_config",
        reason: staticHealth.invalidReason ?? "This config is not batch-runnable.",
      },
    };
  }

  const cacheKey = getProbeCacheKey(config);
  const cached = probeCache.get(cacheKey);
  if (cached && Date.now() - cached.checkedAt < PROBE_CACHE_TTL_MS) {
    if (cached.ok) {
      return { ok: true as const };
    }

    const cachedError = new ModelExecutionError(cached.error);
    return {
      ok: false as const,
      error: {
        code: cachedError.code,
        reason: cachedError.message,
      },
    };
  }

  try {
    const adapter = createModelAdapter(config.modelName);
    const probeTimeoutMs = Math.min(config.requestTimeoutMs || 5_000, 5_000);
    if (adapter.assertAvailable) {
      await withProbeTimeout(
        adapter.assertAvailable(),
        probeTimeoutMs,
        adapter.provider,
        config.modelName
      );
    }

    await withProbeTimeout(
      adapter.chat({
        messages: [
          {
            role: "user",
            content: "Reply with OK.",
          },
        ],
        systemInstruction:
          "You are running a health check for a course benchmarking workflow. Reply with OK.",
        temperature: 0,
        maxOutputTokens: 8,
        topP: 0.1,
        topK: 1,
        timeout: probeTimeoutMs,
      }),
      probeTimeoutMs,
      adapter.provider,
      config.modelName
    );

    probeCache.set(cacheKey, {
      checkedAt: Date.now(),
      ok: true,
    });

    return { ok: true as const };
  } catch (error) {
    const normalized = normalizeModelExecutionError({
      error,
      provider: config.modelProvider,
      modelName: config.modelName,
    });

    probeCache.set(cacheKey, {
      checkedAt: Date.now(),
      ok: false,
      error: normalized.toJSON(),
    });

    return {
      ok: false as const,
      error: {
        code: normalized.code,
        reason: normalized.message,
      },
    };
  }
}

export async function validateBatchRunnableConfigs(
  configs: ConfigSnapshot[]
): Promise<InvalidConfigSummary[]> {
  const failures: InvalidConfigSummary[] = [];
  const dedupedProbeResults = new Map<
    string,
    Awaited<ReturnType<typeof probeBatchRunnableConfig>>
  >();

  for (const config of configs) {
    const staticHealth = inspectConfigHealth(config);
    if (!staticHealth.isBatchRunnable) {
      failures.push({
        configId: config.id ?? null,
        configName: getConfigLabel(config),
        reason: staticHealth.invalidReason ?? "This config is not batch-runnable.",
        code: staticHealth.invalidCode ?? "invalid_config",
      });
      continue;
    }

    const probeKey = getProbeCacheKey(config);
    if (!dedupedProbeResults.has(probeKey)) {
      dedupedProbeResults.set(probeKey, await probeBatchRunnableConfig(config));
    }

    const probeResult = dedupedProbeResults.get(probeKey);
    if (probeResult && !probeResult.ok) {
      failures.push({
        configId: config.id ?? null,
        configName: getConfigLabel(config),
        reason: probeResult.error.reason,
        code: probeResult.error.code,
      });
    }
  }

  return failures;
}
