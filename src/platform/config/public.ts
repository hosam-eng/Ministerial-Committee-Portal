import type { PublicConfig } from "./types";

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
 * Public configuration for client-safe consumption. No browser-visible
 * configuration is currently required, so the contract is empty — a
 * public value may only ever come from an explicit NEXT_PUBLIC_* key,
 * never from a server-only setting.
 */
export function getPublicConfig(): PublicConfig {
  return Object.freeze({});
}
