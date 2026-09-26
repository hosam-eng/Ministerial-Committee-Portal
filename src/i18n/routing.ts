import { defineRouting } from "next-intl/routing";

/**
 * Frozen localization baseline (B1):
 * - locales ar / en, ar default
 * - explicit locale prefix on every public URL ("/ar", "/en")
 * - no browser-language detection or silent locale fallback
 */
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

const DIRECTIONS: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

/** Document direction for a supported locale ("ar" → rtl, "en" → ltr). */
export function getDirection(locale: Locale): "rtl" | "ltr" {
  return DIRECTIONS[locale];
}
