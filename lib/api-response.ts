import { NextResponse } from "next/server";
import {
  type ApiErrorCode,
  type ApiErrorPayload,
  ApiRouteError,
  toApiRouteError,
} from "@/lib/api-error";

export function errorResponse(
  message: string,
  status: number,
  code: ApiErrorCode
) {
  return NextResponse.json<ApiErrorPayload>({ error: message, code }, { status });
}

export function routeErrorResponse(
  error: unknown,
  fallbackMessage = "Request failed."
) {
  const routeError = toApiRouteError(error, fallbackMessage);
  if (!(error instanceof ApiRouteError)) {
    console.error(error);
  }
  return errorResponse(routeError.message, routeError.status, routeError.code);
}
