/**
 * Database configuration seam.
 *
 * This is the *single* place where the runtime connection URL enters the
 * application. Business code must never read `process.env` directly;
 * IMP-03 will replace this with the centralized typed app configuration.
 */
export interface DatabaseConfig {
  /** PostgreSQL connection URL for the application runtime role. */
  readonly connectionString: string;
  /** Maximum connections in the pg pool. Defaults to 10. */
  readonly maxPoolSize?: number;
}

/**
 * Resolve the runtime database configuration from the environment.
 * Fails fast rather than connecting with a wrong/empty URL.
 */
export function databaseConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — the runtime database connection cannot be established.",
    );
  }
  return { connectionString };
}
