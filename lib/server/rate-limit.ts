import type { AdminClient } from "./course-db";
import { ApiError } from "./errors";

/**
 * Database-backed fixed-window rate limit. Fails open (with a log line) if the
 * function is missing, so a partially applied migration never locks students out.
 */
export async function enforceRateLimit(admin: AdminClient, bucket: string, limit: number, windowSeconds: number) {
  const { data, error } = await admin.rpc("ehr_rate_limit_hit", { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) {
    console.error("[fordms] rate limit unavailable", error.message);
    return;
  }
  if (data === false) throw new ApiError(429, "Too many requests. Wait a moment and try again.", "RATE_LIMITED");
}
