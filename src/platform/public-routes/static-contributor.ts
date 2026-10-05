import type { PublicRouteLocale, PublicRoutePath } from "./types";

const LOCALES: PublicRouteLocale[] = ["ar", "en"];

/** Application static public routes (no CMS content). */
export function staticPublicRoutePaths(): PublicRoutePath[] {
  return LOCALES.flatMap((locale) => {
    const other: PublicRouteLocale = locale === "ar" ? "en" : "ar";
    return [
      {
        locale,
        pathname: `/${locale}`,
        alternatePathnames: { [other]: `/${other}` },
      },
      {
        locale,
        pathname: `/${locale}/news`,
        alternatePathnames: { [other]: `/${other}/news` },
      },
    ];
  });
}
