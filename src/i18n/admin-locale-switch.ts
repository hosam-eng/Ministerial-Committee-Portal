import { routing, type Locale } from "./routing";

const LOCALE_PREFIX = /^\/(ar|en)(?=\/|$)/;

/**
 * Replaces the locale segment on a backoffice path while preserving the
 * remainder of the pathname, optional query string, and hash.
 */
export function replaceAdminLocalePrefix(
  pathname: string,
  targetLocale: Locale,
  options?: { search?: string; hash?: string },
): string {
  if (!routing.locales.includes(targetLocale)) {
    return `/${routing.defaultLocale}/admin`;
  }

  let path = pathname.trim();
  if (!path.startsWith("/")) path = `/${path}`;

  const withoutLocale = path.replace(LOCALE_PREFIX, "") || "";
  const normalized = withoutLocale.startsWith("/")
    ? withoutLocale
    : `/${withoutLocale}`;

  const search =
    options?.search && options.search.length > 0
      ? options.search.startsWith("?")
        ? options.search
        : `?${options.search}`
      : "";
  const hash = options?.hash ?? "";

  return `/${targetLocale}${normalized === "/" ? "" : normalized}${search}${hash}`;
}
