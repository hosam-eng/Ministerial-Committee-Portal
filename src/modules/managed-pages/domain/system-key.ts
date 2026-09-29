import { ManagedPageError } from "./errors";

const SYSTEM_KEY = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;

/** Stable non-localized key. Not a slug and not created from one. */
export function normalizeSystemKey(value: string): string {
  const key = value.trim();
  if (!key || key.length > 80 || !SYSTEM_KEY.test(key)) {
    throw new ManagedPageError("SYSTEM_KEY_INVALID");
  }
  return key;
}
