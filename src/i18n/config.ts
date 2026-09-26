import { hasLocale } from "next-intl";

import { routing } from "./routing";

/**
 * Resolves the per-request next-intl configuration.
 *
 * The locale arrives from the explicit URL prefix; unsupported values fall
 * back to the default locale at the config level (layout-level validation
 * rejects them with not-found before rendering).
 *
 * Formatting baseline: application timezone Asia/Riyadh, Gregorian calendar.
 * URL locale codes "ar"/"en" carry ar-SA / en-SA formatting semantics.
 */
export async function resolveRequestConfig(requested: string | undefined) {
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    timeZone: "Asia/Riyadh",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
}
