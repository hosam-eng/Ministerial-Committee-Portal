import type { HomepageDraft } from "./draft";
import { validateHomepageHeroCta } from "./hero-cta";

export type HomepageCompletenessIssueKey =
  | "hero.title.bilingual"
  | "hero.cta.labels.bilingual"
  | "hero.cta.target"
  | "news.heading.bilingual"
  | "news.manual.required"
  | "news.targets.unavailable";

export function collectHomepageCompletenessIssues(
  draft: HomepageDraft,
): HomepageCompletenessIssueKey[] {
  const issues = new Set<HomepageCompletenessIssueKey>();
  for (const section of draft.sections) {
    if (!section.enabled) continue;
    if (section.sectionType === "HERO" && section.hero) {
      const hero = section.hero;
      if (
        !hero.translations.ar.title.trim() ||
        !hero.translations.en.title.trim()
      ) {
        issues.add("hero.title.bilingual");
      }
      if (hero.ctaEnabled) {
        if (
          !hero.translations.ar.ctaLabel.trim() ||
          !hero.translations.en.ctaLabel.trim()
        ) {
          issues.add("hero.cta.labels.bilingual");
        }
        try {
          validateHomepageHeroCta(hero, true);
        } catch {
          issues.add("hero.cta.target");
        }
      }
    }
    if (section.sectionType === "NEWS" && section.news) {
      if (
        !section.news.translations.ar.sectionHeading.trim() ||
        !section.news.translations.en.sectionHeading.trim()
      ) {
        issues.add("news.heading.bilingual");
      }
      if (
        section.news.mode === "MANUAL" &&
        !section.news.manualNewsIds.length
      ) {
        issues.add("news.manual.required");
      }
    }
  }
  return [...issues];
}
