import { SiteSettingsError } from "./errors";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function normalizeOptionalEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith("mailto:")) {
    throw new SiteSettingsError("INVALID_EMAIL");
  }
  if (!EMAIL.test(trimmed) || trimmed.length > 320) {
    throw new SiteSettingsError("INVALID_EMAIL");
  }
  return trimmed;
}

export function normalizeOptionalPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/[<>]/u.test(trimmed) || trimmed.length > 40) {
    throw new SiteSettingsError("INVALID_PHONE");
  }
  const digits = trimmed.replace(/[\s\-().+]/gu, "");
  if (!/^\d{6,15}$/u.test(digits)) {
    throw new SiteSettingsError("INVALID_PHONE");
  }
  return trimmed;
}
