import type { ApiErrorCode, ApiErrorPayload } from "@/lib/api-error";

export class ApiClientError extends Error {
  status: number;
  code?: ApiErrorCode;

  constructor(message: string, status: number, code?: ApiErrorCode) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

async function readResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function parseApiResponse<T>(res: Response): Promise<T> {
  const payload = await readResponseBody(res);

  if (!res.ok) {
    const errorPayload =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Partial<ApiErrorPayload>)
        : null;

    throw new ApiClientError(
      errorPayload?.error || `Request failed with status ${res.status}.`,
      res.status,
      errorPayload?.code
    );
  }

  return payload as T;
}

export async function fetchApiJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  return parseApiResponse<T>(res);
}

export function getApiErrorMessage(
  error: unknown,
  options?: {
    backendUnavailable?: string;
    noTeam?: string;
    instructorRequired?: string;
    unauthorized?: string;
    notFound?: string;
    default?: string;
  }
) {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case "backend_unavailable":
        return options?.backendUnavailable ?? error.message;
      case "no_team":
        return options?.noTeam ?? error.message;
      case "instructor_required":
        return options?.instructorRequired ?? error.message;
      case "unauthorized":
        return options?.unauthorized ?? error.message;
      case "not_found":
        return options?.notFound ?? error.message;
      default:
        return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return options?.default ?? "Something went wrong.";
}
