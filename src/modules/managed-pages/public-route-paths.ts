import type { Database } from "@/platform/database";
import type { PublicRoutePath } from "@/platform/public-routes/types";

type Locale = "ar" | "en";

function alternatePathnamesFor(
  translations: { locale: string; slug: string }[],
  locale: Locale,
): Partial<Record<Locale, string>> {
  const alternates: Partial<Record<Locale, string>> = {};
  for (const row of translations) {
    if (row.locale !== "ar" && row.locale !== "en") continue;
    const other = row.locale as Locale;
    if (other === locale) continue;
    alternates[other] = `/${other}/pages/${row.slug}`;
  }
  return alternates;
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
        alternatePathnames: alternatePathnamesFor(
          revision.translations,
          locale,
        ),
      });
    }
  }
  return paths;
}
