import { PublicNavigationError } from "./errors";

/** Code-defined public system routes (stable keys only). */
export const PUBLIC_SYSTEM_ROUTE_KEYS = ["HOME", "NEWS"] as const;

export type PublicSystemRouteKey = (typeof PUBLIC_SYSTEM_ROUTE_KEYS)[number];

const KEY_SET = new Set<string>(PUBLIC_SYSTEM_ROUTE_KEYS);

export function isPublicSystemRouteKey(
  value: string,
): value is PublicSystemRouteKey {
  return KEY_SET.has(value);
}

export function resolveSystemRoutePath(
  key: PublicSystemRouteKey,
  locale: "ar" | "en",
): string {
  switch (key) {
    case "HOME":
      return `/${locale}`;
    case "NEWS":
      return `/${locale}/news`;
    default:
      throw new PublicNavigationError("INVALID_SYSTEM_ROUTE");
  }
}

export function defaultSystemRouteLabels(key: PublicSystemRouteKey): {
  ar: string;
  en: string;
} {
  switch (key) {
    case "HOME":
      return { ar: "الرئيسية", en: "Home" };
    case "NEWS":
      return { ar: "الأخبار", en: "News" };
    default:
      return { ar: "", en: "" };
  }
}

export function parseSystemRouteKey(value: string): PublicSystemRouteKey {
  const key = value.trim();
  if (!isPublicSystemRouteKey(key)) {
    throw new PublicNavigationError("INVALID_SYSTEM_ROUTE");
  }
  return key;
}
