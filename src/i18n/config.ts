import { hasLocale } from "next-intl";

import { routing, type Locale } from "./routing";

/**
 * Formatting locale semantics (B1): public route locales "ar"/"en" map to
 * the regional Saudi formatting locales. These are intentionally separate
 * concepts — only "ar"/"en" ever appear in URLs.
 */
const FORMATTING_LOCALES: Record<Locale, "ar-SA" | "en-SA"> = {
  ar: "ar-SA",
  en: "en-SA",
};

/** Regional formatting locale for a supported route locale. */
export function getFormattingLocale(locale: Locale): "ar-SA" | "en-SA" {
  return FORMATTING_LOCALES[locale];
}

/**
 * Resolves the per-request next-intl configuration.
 *
 * The locale arrives from the explicit URL prefix; unsupported values fall
 * back to the default route locale at the config level (layout-level
 * validation rejects them with not-found before rendering).
 *
 * Returned `locale` is the formatting locale ("ar-SA"/"en-SA") — this is
 * what `useLocale()` and all Intl-based formatting see. Messages are
 * loaded per route locale ("ar"/"en").
 *
 * Formatting baseline: application timezone Asia/Riyadh, Gregorian calendar.
 */
export async function resolveRequestConfig(requested: string | undefined) {
  const routeLocale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale: getFormattingLocale(routeLocale),
    timeZone: "Asia/Riyadh",
    messages: (await import(`../../messages/${routeLocale}.json`)).default,
  };
}
