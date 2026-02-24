const DEFAULT_MAX_BODY_BYTES = 120_000;

export type JsonBodyResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export async function readJsonBodyWithLimit<T = unknown>(
  req: Request,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES
): Promise<JsonBodyResult<T>> {
  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return { ok: false, status: 400, error: "Unable to read request body." };
  }

  const sizeBytes = Buffer.byteLength(raw, "utf8");
  if (sizeBytes > maxBodyBytes) {
    return {
      ok: false,
      status: 413,
      error: `Request payload is too large (${sizeBytes} bytes).`,
    };
  }

  if (!raw.trim()) {
    return { ok: false, status: 400, error: "Request body is required." };
  }

  try {
    const data = JSON.parse(raw) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 400, error: "Request body must be valid JSON." };
  }
}

export function trimString(value: unknown, maxChars: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxChars);
}

export function normalizeStringArray(
  value: unknown,
  opts?: { maxItems?: number; maxItemChars?: number }
): string[] {
  if (!Array.isArray(value)) return [];
  const maxItems = opts?.maxItems ?? 20;
  const maxItemChars = opts?.maxItemChars ?? 200;
  return value
    .slice(0, maxItems)
    .map((item) => trimString(item, maxItemChars))
    .filter((item) => item.length > 0);
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
