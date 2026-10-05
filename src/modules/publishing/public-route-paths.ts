import type { PublicRoutePath } from "@/platform/public-routes/types";
import type { Database } from "@/platform/database";

import type { NewsLocale } from "./news-rules";

function alternatePathnamesFor(
  translations: { locale: string; slug: string }[],
  locale: NewsLocale,
): Partial<Record<NewsLocale, string>> {
  const alternates: Partial<Record<NewsLocale, string>> = {};
  for (const row of translations) {
    if (row.locale !== "ar" && row.locale !== "en") continue;
    const other = row.locale as NewsLocale;
    if (other === locale) continue;
    alternates[other] = `/${other}/news/${row.slug}`;
  }
  return alternates;
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
        alternatePathnames: alternatePathnamesFor(
          revision.translations,
          locale,
        ),
      });
    }
  }
  return paths;
}
