import type { MetadataRoute } from "next";

import type { PublicRoutePath } from "./types";

function toAbsoluteUrl(origin: string, pathname: string): string {
  return `${origin.replace(/\/$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function languagesFor(
  origin: string,
  entry: PublicRoutePath,
  all: PublicRoutePath[],
): Record<string, string> | undefined {
  const suffix = entry.pathname.replace(/^\/(ar|en)/, "");
  const related = all.filter(
    (row) =>
      row.pathname.replace(/^\/(ar|en)/, "") === suffix &&
      row.locale !== entry.locale &&
      entry.alternateLocales.includes(row.locale),
  );
  if (!related.length) return undefined;
  const languages: Record<string, string> = {
    [entry.locale]: toAbsoluteUrl(origin, entry.pathname),
  };
  for (const row of related) {
    languages[row.locale] = toAbsoluteUrl(origin, row.pathname);
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
    const languages = languagesFor(publicSiteOrigin, entry, paths);
    return {
      url: toAbsoluteUrl(publicSiteOrigin, entry.pathname),
      ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
      ...(languages ? { alternates: { languages } } : {}),
    };
  });
}
