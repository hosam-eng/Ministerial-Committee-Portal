import type { PublicRouteLocale, PublicRoutePath } from "./types";

const LOCALES: PublicRouteLocale[] = ["ar", "en"];

/** Application static public routes (no CMS content). */
export function staticPublicRoutePaths(): PublicRoutePath[] {
  return LOCALES.flatMap((locale) => [
    { locale, pathname: `/${locale}`, alternateLocales: [] },
    { locale, pathname: `/${locale}/news`, alternateLocales: [] },
  ]);
}
