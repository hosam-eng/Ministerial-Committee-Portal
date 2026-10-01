import { HomepageError } from "./errors";

/** Homepage Hero CTA may target these stable public system routes only. */
export const HOMEPAGE_CTA_SYSTEM_ROUTE_KEYS = ["HOME", "NEWS"] as const;

export type HomepageCtaSystemRouteKey =
  (typeof HOMEPAGE_CTA_SYSTEM_ROUTE_KEYS)[number];

const KEY_SET = new Set<string>(HOMEPAGE_CTA_SYSTEM_ROUTE_KEYS);

export function isHomepageCtaSystemRouteKey(
  value: string,
): value is HomepageCtaSystemRouteKey {
  return KEY_SET.has(value);
}

export function parseHomepageCtaSystemRouteKey(
  value: string,
): HomepageCtaSystemRouteKey {
  const key = value.trim();
  if (!isHomepageCtaSystemRouteKey(key)) {
    throw new HomepageError("INVALID_SYSTEM_ROUTE");
  }
  return key;
}

export function resolveHomepageCtaSystemRoutePath(
  key: HomepageCtaSystemRouteKey,
  locale: "ar" | "en",
): string {
  switch (key) {
    case "HOME":
      return `/${locale}`;
    case "NEWS":
      return `/${locale}/news`;
    default:
      throw new HomepageError("INVALID_SYSTEM_ROUTE");
  }
}
