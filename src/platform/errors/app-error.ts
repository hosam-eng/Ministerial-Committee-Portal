import { ERROR_HTTP_STATUS, type ErrorCode } from "./codes";

/**
 * Application/platform error with a stable code and an optional
 * operator-safe public message. `cause` keeps the original failure for
 * internal logs — it is never serialized to clients.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  /** Safe message suitable for problem details; defaults to generic. */
  readonly publicMessage?: string;

  constructor(
    code: ErrorCode,
    options?: {
      message?: string;
      publicMessage?: string;
      httpStatus?: number;
      cause?: unknown;
    },
  ) {
    super(options?.message ?? code, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.httpStatus = options?.httpStatus ?? ERROR_HTTP_STATUS[code];
    this.publicMessage = options?.publicMessage;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
