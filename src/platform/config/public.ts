import type { AppEnv, PublicConfig } from "./types";

const PUBLIC_PREFIX = "NEXT_PUBLIC_";

/**
 * The only environment keys allowed to reach the browser. Anything not
 * starting with NEXT_PUBLIC_ is server-only by construction.
 */
export function collectPublicEnv(
  env: Record<string, string | undefined>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(PUBLIC_PREFIX) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Public configuration for client-safe consumption. Intentionally minimal:
 * it carries the deployment environment and nothing else until a genuine
 * public value is required.
 */
export function getPublicConfig(
  env: Record<string, string | undefined> = process.env,
): PublicConfig {
  const appEnv = (env.APP_ENV ?? "development") as AppEnv;
  return Object.freeze({ appEnv });
}
