// ---------------------------------------------------------------------------
// SHA-256 canonical JSON hashing for frozen config snapshots
// ---------------------------------------------------------------------------

import { createHash } from "crypto";
import type { ConfigSnapshot } from "./types";

/**
 * Fields that are identity / metadata — excluded from the hash because they
 * are not "knobs" that affect model behaviour.
 */
const EXCLUDED_KEYS = new Set<string>([
  "id",
  "teamId",
  "name",
  "version",
  "configHash",
  "isFrozen",
  "createdAt",
  "createdBy",
]);

/**
 * Produce a deterministic SHA-256 hex digest of the knob-only fields in a
 * ConfigSnapshot.  Two configs with the same knob values will always produce
 * the same hash regardless of field ordering in the source object.
 */
export function computeConfigHash(config: ConfigSnapshot): string {
  // 1. Extract only the knob fields
  const knobs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (!EXCLUDED_KEYS.has(key)) {
      knobs[key] = value;
    }
  }

  // 2. JSON.stringify with sorted keys for determinism
  const canonical = JSON.stringify(knobs, Object.keys(knobs).sort());

  // 3. SHA-256 hex digest
  return createHash("sha256").update(canonical).digest("hex");
}
