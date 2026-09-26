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
 * Better Auth base URL — required in production, optional elsewhere so the
 * local/test default can be resolved by Better Auth itself. When provided
 * it must be an absolute http(s) URL; production additionally requires
 * https so secure session cookies are guaranteed.
 */
const betterAuthUrl = z
  .string()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(
    z
      .url()
      .refine(
        (value) => /^https?:\/\//.test(value),
        "must be an absolute http(s) URL",
      )
      .optional(),
  );

/**
 * Server environment schema. Empty-string values are treated as unset for
 * optional URLs — the only supported coercion, documented and tested.
 * No numbers/booleans are coerced.
 */
export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    // Required — a deployment environment must never be silently assumed.
    APP_ENV: z.enum(APP_ENVS),
    LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
    DATABASE_URL: optionalPostgresUrl,
    DATABASE_MIGRATION_URL: optionalPostgresUrl,
    OTEL_SERVICE_NAME: z
      .string()
      .min(1)
      .default("ministerial-committee-portal"),
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
    // Better Auth signing/encryption secret — required in production so the
    // deployment can never run on a generated fallback secret. Never logged,
    // never surfaced through configuration errors (paths only).
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    BETTER_AUTH_URL: betterAuthUrl,
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === "production" && !env.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required when APP_ENV=production",
      });
    }
    if (env.APP_ENV === "production" && !env.BETTER_AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message:
          "BETTER_AUTH_SECRET (min 32 chars) is required when APP_ENV=production",
      });
    }
    if (
      env.APP_ENV === "production" &&
      env.BETTER_AUTH_URL &&
      !env.BETTER_AUTH_URL.startsWith("https://")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "BETTER_AUTH_URL must use https when APP_ENV=production",
      });
    }
  });

export type ServerEnvInput = z.input<typeof serverEnvSchema>;
export type ServerEnv = z.output<typeof serverEnvSchema>;
