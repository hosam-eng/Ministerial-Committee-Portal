import type { Database } from "@/platform/database";
import type { PublicRoutePath } from "@/platform/public-routes/types";

type Locale = "ar" | "en";

function alternatesFor(
  translations: { locale: string }[],
  locale: Locale,
): Locale[] {
  const others = translations
    .map((t) => t.locale)
    .filter((value): value is Locale => value === "ar" || value === "en");
  return others.filter((value) => value !== locale);
}

/** Live published Managed Page routes only. */
export async function listManagedPagePublicRoutePaths(
  database: Database,
): Promise<PublicRoutePath[]> {
  const rows = await database.prisma.managedPage.findMany({
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
      const locale = translation.locale as Locale;
      paths.push({
        locale,
        pathname: `/${locale}/pages/${translation.slug}`,
        lastModified: row.publishedAt,
        alternateLocales: alternatesFor(revision.translations, locale),
      });
    }
  }
  return paths;
}
