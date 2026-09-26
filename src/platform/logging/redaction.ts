/**
 * Centralized secret redaction. Wildcard paths cover credential-shaped
 * keys at several depths so headers, bodies, env snapshots, and nested
 * config never leak into log output.
 */
const SENSITIVE_KEYS = [
  "password",
  "newPassword",
  "confirmPassword",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "secret",
  "apiKey",
  "api_key",
  "connectionString",
  "databaseUrl",
  "databaseMigrationUrl",
] as const;

const MAX_DEPTH = 4;

export const REDACT_PATHS: string[] = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "req.headers['x-forwarded-authorization']",
  "res.headers['set-cookie']",
  "env.DATABASE_URL",
  "env.DATABASE_MIGRATION_URL",
  "config.databaseUrl",
  "config.databaseMigrationUrl",
  ...SENSITIVE_KEYS,
  ...Array.from({ length: MAX_DEPTH }, (_, i) =>
    SENSITIVE_KEYS.map((key) => `${"*.".repeat(i + 1)}${key}`),
  ).flat(),
];

export const REDACT_CENSOR = "[REDACTED]";

export const REDACT_OPTIONS = {
  paths: REDACT_PATHS,
  censor: REDACT_CENSOR,
} as const;
