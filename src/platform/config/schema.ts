import { z } from "zod";

import { APP_ENVS, LOG_LEVELS } from "./types";

const postgresUrl = z.url().refine((value) => {
  try {
    return new URL(value).protocol.startsWith("postgres");
  } catch {
    return false;
  }
}, "must be a postgres:// or postgresql:// URL");

const optionalPostgresUrl = z
  .string()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(postgresUrl.optional());

const optionalUrl = z
  .string()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(z.url().optional());

/**
 * Server environment schema. Empty-string values are treated as unset for
 * optional URLs — the only supported coercion, documented and tested.
 * No numbers/booleans are coerced.
 */
export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    APP_ENV: z.enum(APP_ENVS).default("development"),
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    DATABASE_URL: optionalPostgresUrl,
    DATABASE_MIGRATION_URL: optionalPostgresUrl,
    OTEL_SERVICE_NAME: z
      .string()
      .min(1)
      .default("ministerial-committee-portal"),
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === "production" && !env.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required when APP_ENV=production",
      });
    }
  });

export type ServerEnvInput = z.input<typeof serverEnvSchema>;
export type ServerEnv = z.output<typeof serverEnvSchema>;
