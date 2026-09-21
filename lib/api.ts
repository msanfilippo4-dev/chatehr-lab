"use client";

export class ClientApiError extends Error {
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
 * Fetch wrapper for course APIs. A 401 sends the browser back to the login
 * page (the session expired); other errors surface the server's safe message.
 */
export async function apiFetch<T = unknown>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  let payload: { error?: string; code?: string; details?: unknown } & Record<string, unknown> = {};
  const text = await response.text();
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: "The course service returned an unexpected response." };
  }
  if (response.status === 401 && typeof window !== "undefined") {
    window.location.assign(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}&reason=expired`);
    throw new ClientApiError(401, "Your session expired. Sign in again.", "UNAUTHORIZED");
  }
  if (!response.ok) throw new ClientApiError(response.status, payload.error ?? `Request failed (${response.status}).`, payload.code ?? "ERROR", payload.details);
  return payload as T;
}

export function postJson<T = unknown>(input: string, body: unknown): Promise<T> {
  return apiFetch<T>(input, { method: "POST", body: JSON.stringify(body) });
}
