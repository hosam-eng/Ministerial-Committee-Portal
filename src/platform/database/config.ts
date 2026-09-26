import type { ServerConfig } from "../config";

/**
 * Database configuration seam.
 *
 * The runtime connection URL enters the application exclusively through
 * the centralized typed server configuration (src/platform/config).
 * Business code must never read `process.env` directly.
 */
export interface DatabaseConfig {
  /** PostgreSQL connection URL for the application runtime role. */
  readonly connectionString: string;
  /** Maximum connections in the pg pool. Defaults to 10. */
  readonly maxPoolSize?: number;
}

/**
 * Resolve runtime database configuration from typed server config —
 * the sanctioned runtime path since IMP-03.
 */
export function databaseConfigFromServerConfig(
  config: ServerConfig,
): DatabaseConfig {
  if (!config.databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set — the runtime database connection cannot be established.",
    );
  }
  return { connectionString: config.databaseUrl };
}
