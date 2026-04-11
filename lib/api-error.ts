export type ApiErrorCode =
  | "backend_unavailable"
  | "no_team"
  | "instructor_required"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "bad_request"
  | "unknown_error";

export interface ApiErrorPayload {
  error: string;
  code: ApiErrorCode;
}

interface SupabaseErrorLike {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
}

export class ApiRouteError extends Error {
  status: number;
  code: ApiErrorCode;

  constructor(message: string, status: number, code: ApiErrorCode) {
    super(message);
    this.name = "ApiRouteError";
    this.status = status;
    this.code = code;
  }
}

export const BACKEND_UNAVAILABLE_MESSAGE =
  "Backend unavailable. Check the Supabase configuration and try again.";

function getErrorText(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const candidate = error as SupabaseErrorLike;
    return [
      candidate.message,
      candidate.details,
      candidate.hint,
      candidate.code,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return String(error);
}

export function isSupabaseNoRowsError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  return (error as SupabaseErrorLike).code === "PGRST116";
}

export function isBackendUnavailableError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  return [
    "fetch failed",
    "getaddrinfo",
    "enotfound",
    "econnrefused",
    "failed to fetch",
    "network",
    "dns",
    "timeout",
    "timed out",
    "missing supabase env vars",
  ].some((fragment) => text.includes(fragment));
}

export function toApiRouteError(
  error: unknown,
  fallbackMessage = "Request failed."
) {
  if (error instanceof ApiRouteError) return error;
  if (isBackendUnavailableError(error)) {
    return new ApiRouteError(
      BACKEND_UNAVAILABLE_MESSAGE,
      503,
      "backend_unavailable"
    );
  }
  return new ApiRouteError(fallbackMessage, 500, "unknown_error");
}

export function unauthorizedError(message = "Unauthorized") {
  return new ApiRouteError(message, 401, "unauthorized");
}

export function noTeamError(
  message = "You must be on a team to continue.",
  status = 403
) {
  return new ApiRouteError(message, status, "no_team");
}

export function instructorRequiredError(
  message = "Instructor access required."
) {
  return new ApiRouteError(message, 403, "instructor_required");
}

export function notFoundError(message = "Not found.") {
  return new ApiRouteError(message, 404, "not_found");
}
