import type { PublicRoutePath } from "@/platform/public-routes/types";
import type { Database } from "@/platform/database";

import type { NewsLocale } from "./news-rules";

function alternatesFor(
  translations: { locale: string }[],
  locale: NewsLocale,
): NewsLocale[] {
  const others = translations
    .map((t) => t.locale)
    .filter((value): value is NewsLocale => value === "ar" || value === "en");
  return others.filter((value) => value !== locale);
}

/** Live published News detail routes only (no redirects, no drafts). */
export async function listNewsPublicRoutePaths(
  database: Database,
): Promise<PublicRoutePath[]> {
  const rows = await database.prisma.news.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      liveRevisionId: { not: null },
    },
    select: {
      publishedAt: true,
      liveRevision: {
        select: {
          translations: { select: { locale: true, slug: true } },
        },
      },
    },
  });
  const paths: PublicRoutePath[] = [];
  for (const row of rows) {
    const revision = row.liveRevision;
    if (!revision || !row.publishedAt) continue;
    for (const translation of revision.translations) {
      if (translation.locale !== "ar" && translation.locale !== "en") continue;
      const locale = translation.locale as NewsLocale;
      paths.push({
        locale,
        pathname: `/${locale}/news/${translation.slug}`,
        lastModified: row.publishedAt,
        alternateLocales: alternatesFor(revision.translations, locale),
      });
    }
  }
  return paths;
}
