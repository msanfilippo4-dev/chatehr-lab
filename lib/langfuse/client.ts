// ---------------------------------------------------------------------------
// Langfuse singleton — reused across the server process lifetime
// ---------------------------------------------------------------------------

import { Langfuse } from "langfuse";

let instance: Langfuse | null = null;
let disabledReason: string | null = null;

function trimEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export function getLangfuseBaseUrl() {
  return trimEnv("LANGFUSE_BASE_URL") || "https://us.cloud.langfuse.com";
}

export function isLangfuseEnabled() {
  return Boolean(trimEnv("LANGFUSE_PUBLIC_KEY") && trimEnv("LANGFUSE_SECRET_KEY"));
}

export function disableLangfuse(reason: string) {
  if (!disabledReason) {
    console.warn(`[langfuse] disabling tracing: ${reason}`);
  }
  disabledReason = reason;
  instance = null;
}

export function getLangfuseStatus() {
  return {
    configured: isLangfuseEnabled(),
    enabled: isLangfuseEnabled() && !disabledReason,
    reason: disabledReason ?? (!isLangfuseEnabled() ? "missing_credentials" : null),
    baseUrl: getLangfuseBaseUrl(),
  };
}

export function getLangfuse(): Langfuse | null {
  if (!isLangfuseEnabled() || disabledReason) {
    return null;
  }

  if (!instance) {
    instance = new Langfuse({
      publicKey: trimEnv("LANGFUSE_PUBLIC_KEY"),
      secretKey: trimEnv("LANGFUSE_SECRET_KEY"),
      baseUrl: getLangfuseBaseUrl(),
    });
  }
  return instance;
}
