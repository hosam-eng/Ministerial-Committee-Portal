import type { MetadataRoute } from "next";

import type { PublicRoutePath } from "./types";

function toAbsoluteUrl(origin: string, pathname: string): string {
  return `${origin.replace(/\/$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function languagesFor(
  origin: string,
  entry: PublicRoutePath,
): Record<string, string> | undefined {
  const alternates = entry.alternatePathnames;
  const locales = Object.keys(alternates) as PublicRoutePath["locale"][];
  if (!locales.length) return undefined;
  const languages: Record<string, string> = {
    [entry.locale]: toAbsoluteUrl(origin, entry.pathname),
  };
  for (const locale of locales) {
    const pathname = alternates[locale];
    if (pathname) languages[locale] = toAbsoluteUrl(origin, pathname);
  }
  return languages;
}

/** Build sitemap entries; returns [] when origin is not configured (fail closed). */
export function buildPublicSitemapEntries(
  paths: PublicRoutePath[],
  publicSiteOrigin: string | undefined,
): MetadataRoute.Sitemap {
  if (!publicSiteOrigin) return [];
  return paths.map((entry) => {
    const languages = languagesFor(publicSiteOrigin, entry);
    return {
      url: toAbsoluteUrl(publicSiteOrigin, entry.pathname),
      ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
      ...(languages ? { alternates: { languages } } : {}),
    };
  });
}
