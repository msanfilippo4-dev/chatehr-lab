import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = "ERROR", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Convert any thrown value into a JSON response without leaking database or
 * framework internals to the browser.
 */
export function apiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code, details: error.details ?? undefined }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Sign in with your Fordham account to continue.", code: "UNAUTHORIZED" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "Your course role does not permit this action.", code: "FORBIDDEN" }, { status: 403 });
  if (message === "DROPPED") return NextResponse.json({ error: "This account is not currently enrolled. Contact the instructor.", code: "FORBIDDEN" }, { status: 403 });
  console.error("[fordms] unexpected route error", error);
  return NextResponse.json({ error: "The course service could not complete the request. Try again, and export your evidence if the problem continues.", code: "INTERNAL" }, { status: 500 });
}

export function ok<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}
