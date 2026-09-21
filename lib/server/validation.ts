import type { ZodTypeAny, z } from "zod";
import { ApiError } from "./errors";

const DEFAULT_MAX_BYTES = 256 * 1024;
export const WORKSPACE_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Parse and validate a JSON request body. The Content-Length header is checked
 * before the body is read, and the serialized size is checked again afterwards.
 */
export async function parseJsonBody<S extends ZodTypeAny>(request: Request, schema: S, maxBytes = DEFAULT_MAX_BYTES): Promise<z.infer<S>> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared && declared > maxBytes) throw new ApiError(413, "The request is too large.", "PAYLOAD_TOO_LARGE");
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new ApiError(400, "The request body could not be read.", "BAD_REQUEST");
  }
  if (text.length > maxBytes) throw new ApiError(413, "The request is too large.", "PAYLOAD_TOO_LARGE");
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "The request body must be valid JSON.", "BAD_REQUEST");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`);
    throw new ApiError(400, issues[0] ?? "Invalid request.", "VALIDATION", issues);
  }
  return parsed.data;
}

export function queryParam(request: Request, name: string, fallback = ""): string {
  return new URL(request.url).searchParams.get(name) ?? fallback;
}
