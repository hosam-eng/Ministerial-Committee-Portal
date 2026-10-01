import { describe, expect, it } from "vitest";

import {
  collectHomepageCompletenessIssues,
  emptyHomepageDraft,
} from "@/modules/homepage";

describe("homepage completeness", () => {
  it("flags missing bilingual news section headings", () => {
    const draft = emptyHomepageDraft();
    draft.sections[0]!.hero!.translations.ar.title = "ع";
    draft.sections[0]!.hero!.translations.en.title = "E";
    draft.sections[0]!.hero!.translations.ar.ctaLabel = "زر";
    draft.sections[0]!.hero!.translations.en.ctaLabel = "Go";
    draft.sections[0]!.hero!.ctaEnabled = true;
    draft.sections[0]!.hero!.ctaTargetType = "SYSTEM_ROUTE";
    draft.sections[0]!.hero!.systemRouteKey = "NEWS";

    const issues = collectHomepageCompletenessIssues(draft);
    expect(issues).toContain("news.heading.bilingual");
    expect(issues).not.toContain("hero.title.bilingual");
    expect(issues).not.toContain("hero.cta.target");
  });

  it("reports no issues when hero and news headings are complete", () => {
    const draft = emptyHomepageDraft();
    draft.sections[0]!.hero!.translations.ar.title = "ع";
    draft.sections[0]!.hero!.translations.en.title = "E";
    draft.sections[1]!.news!.translations.ar.sectionHeading = "أخبار";
    draft.sections[1]!.news!.translations.en.sectionHeading = "News";

    expect(collectHomepageCompletenessIssues(draft)).toEqual([]);
  });
});
