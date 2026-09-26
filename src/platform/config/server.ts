import { serverEnvSchema, type ServerEnv } from "./schema";
import type { AppEnv, ServerConfig } from "./types";

/**
 * Format a Zod failure into operator-facing lines. Only the setting path
 * and the validation message are reported — never the offending value, so
 * secrets cannot leak through configuration errors.
 */
export function formatConfigIssues(
  issues: { path: PropertyKey[]; message: string }[],
): string[] {
  return issues.map(
    (issue) => `${issue.path.map(String).join(".") || "env"}: ${issue.message}`,
  );
}

export class ConfigurationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid server configuration:\n  - ${issues.join("\n  - ")}`);
    this.name = "ConfigurationError";
    this.issues = issues;
  }
}

/**
 * Validate a raw environment map into typed ServerConfig. Pure and
 * deterministic — directly testable without touching process.env.
 */
export function validateServerConfig(
  env: Record<string, string | undefined>,
): ServerConfig {
  const parsed = serverEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigurationError(formatConfigIssues(parsed.error.issues));
  }
  return freezeConfig(parsed.data);
}

function freezeConfig(env: ServerEnv): ServerConfig {
  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    appEnv: env.APP_ENV as AppEnv,
    isProduction: env.APP_ENV === "production",
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    databaseMigrationUrl: env.DATABASE_MIGRATION_URL,
    otel: Object.freeze({
      serviceName: env.OTEL_SERVICE_NAME,
      exporterEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
  });
}

let cached: ServerConfig | undefined;

/**
 * Process-wide typed config — resolved once. Throws ConfigurationError on
 * invalid env, which must surface before production traffic is served.
 */
export function getServerConfig(): ServerConfig {
  if (!cached) {
    cached = validateServerConfig(process.env);
  }
  return cached;
}

/** Test hook: reset the memoized config. Never used in app code. */
export function resetServerConfigForTest(): void {
  cached = undefined;
}
