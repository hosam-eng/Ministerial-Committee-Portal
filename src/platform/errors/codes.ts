/**
 * Stable application/platform error codes — the public machine-readable
 * contract. Business-specific codes must not be invented here.
 */
export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "RESOURCE_NOT_FOUND",
  "CONFLICT",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "DEPENDENCY_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Default HTTP status per error code. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  RESOURCE_NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  DEPENDENCY_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};
