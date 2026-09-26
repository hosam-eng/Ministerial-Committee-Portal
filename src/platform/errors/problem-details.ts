import { ERROR_HTTP_STATUS, type ErrorCode } from "./codes";
import { isAppError } from "./app-error";

/** RFC 9457 problem-details body. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: ErrorCode;
  requestId?: string;
}

const STATUS_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

const GENERIC_INTERNAL_DETAIL = "An unexpected error occurred.";

export function titleForStatus(status: number): string {
  return STATUS_TITLES[status] ?? "Error";
}

export interface ProblemContext {
  requestId?: string;
  /** Safe public route/path, e.g. request pathname — never a full URL. */
  instance?: string;
}

/**
 * Map any thrown value to a safe RFC 9457 body. Unexpected errors become
 * INTERNAL_ERROR with a generic detail — stack traces, SQL errors, and
 * internal paths never leave this boundary.
 */
export function toProblemDetails(
  error: unknown,
  context: ProblemContext = {},
): ProblemDetails {
  const base = {
    type: "about:blank",
    requestId: context.requestId,
    instance: context.instance,
  };

  if (isAppError(error)) {
    return {
      ...base,
      title: titleForStatus(error.httpStatus),
      status: error.httpStatus,
      detail: error.publicMessage ?? GENERIC_INTERNAL_DETAIL,
      code: error.code,
    };
  }

  return {
    ...base,
    title: titleForStatus(500),
    status: 500,
    detail: GENERIC_INTERNAL_DETAIL,
    code: "INTERNAL_ERROR",
  };
}

/** Serialize problem details as an `application/problem+json` Response. */
export function problemResponse(
  error: unknown,
  context: ProblemContext = {},
): Response {
  const body = toProblemDetails(error, context);
  const headers = new Headers({
    "content-type": "application/problem+json",
    "cache-control": "no-store",
  });
  if (context.requestId) {
    headers.set("x-request-id", context.requestId);
  }
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers,
  });
}

export { ERROR_HTTP_STATUS };
