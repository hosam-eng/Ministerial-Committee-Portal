import type { Database } from "@/platform/database";
import {
  resolvePublishedNewsByIds,
  type NewsLocale,
} from "@/modules/publishing";

import type { HomepageDraft } from "../domain/draft";
import { HomepageError } from "../domain/errors";
import { validateHomepageHeroCta } from "../domain/hero-cta";
import type { ContentTargetPort } from "./content-target-port";
import { resolveHomepageHeroCta } from "./hero-cta-resolver";
import { managedPageContentTargetPort } from "./managed-page-content-target-port";

export async function assertPublishableHomepageDraft(
  draft: HomepageDraft,
  database: Database,
  contentPort: ContentTargetPort = managedPageContentTargetPort,
): Promise<void> {
  for (const locale of ["ar", "en"] as const) {
    for (const section of draft.sections) {
      if (!section.enabled) continue;
      if (section.sectionType === "HERO" && section.hero) {
        const hero = section.hero;
        validateHomepageHeroCta(hero, true);
        if (hero.ctaEnabled) {
          const label =
            locale === "en"
              ? hero.translations.en.ctaLabel
              : hero.translations.ar.ctaLabel;
          await resolveHomepageHeroCta(hero, {
            locale,
            label,
            strictPublish: true,
            contentPort,
          });
        }
      }
      if (section.sectionType === "NEWS" && section.news) {
        if (section.news.mode === "MANUAL") {
          const resolved = await resolvePublishedNewsByIds(
            locale as NewsLocale,
            section.news.manualNewsIds,
            database,
          );
          if (resolved.length !== section.news.manualNewsIds.length) {
            throw new HomepageError("UNAVAILABLE_TARGET");
          }
        }
      }
    }
  }
}
