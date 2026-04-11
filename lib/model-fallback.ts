import { GEMINI_BACKUP_MODEL_ID, GEMINI_CORE_MODEL_ID } from "./constants";
import type { ConfigSnapshot } from "./types";

type FallbackConfig = Pick<
  ConfigSnapshot,
  "modelProvider" | "modelName" | "fallbackModel"
>;

export function getResolvedFallbackModel(config: FallbackConfig) {
  const configuredFallback =
    typeof config.fallbackModel === "string" ? config.fallbackModel.trim() : "";

  if (configuredFallback) {
    return configuredFallback;
  }

  if (
    config.modelProvider === "gemini" &&
    config.modelName === GEMINI_CORE_MODEL_ID
  ) {
    return GEMINI_BACKUP_MODEL_ID;
  }

  return "";
}

export function getRequestedModelChain(config: FallbackConfig) {
  return [config.modelName, getResolvedFallbackModel(config)].filter(
    (value, index, array): value is string =>
      Boolean(value) && array.indexOf(value) === index
  );
}
