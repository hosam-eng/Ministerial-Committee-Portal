export const APP_ENVS = ["development", "test", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Server-only configuration. Must never reach a client bundle. */
export interface ServerConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly appEnv: AppEnv;
  readonly isProduction: boolean;
  readonly logLevel: LogLevel;
  /** Runtime-role connection URL; required when appEnv is production. */
  readonly databaseUrl?: string;
  /** Migration-role URL — tooling seam, not used by the app runtime. */
  readonly databaseMigrationUrl?: string;
  readonly otel: {
    readonly serviceName: string;
    /** OTLP HTTP endpoint; absent = no exporter (local dev default). */
    readonly exporterEndpoint?: string;
  };
  readonly auth: {
    /**
     * Better Auth signing/encryption secret (min 32 chars). Server-only
     * — must never reach client output, logs, or error messages.
     * Required in every environment; no implicit fallback exists.
     */
    readonly secret: string;
    /**
     * Absolute base URL for the auth server — always explicit so Better
     * Auth never infers its origin from request headers. https required
     * in production; http allowed in development/test.
     */
    readonly baseUrl: string;
  };
}

/**
 * Public configuration safe for browser exposure. Empty by design until
 * a genuine NEXT_PUBLIC_* value is required — server-only settings must
 * never leak onto this contract.
 */
export type PublicConfig = Record<string, never>;
