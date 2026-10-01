import { describe, expect, it } from "vitest";

import {
  emptyHomepageDraft,
  swapHomepageSectionPositions,
  validateHomepageDraft,
} from "@/modules/homepage";
import { validateHomepageHeroCta } from "@/modules/homepage/domain/hero-cta";

const newsId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("homepage draft", () => {
  it("accepts the default hero and news sections", () => {
    const draft = emptyHomepageDraft();
    expect(draft.sections).toHaveLength(2);
    expect(draft.sections.map((s) => s.sectionType)).toEqual(["HERO", "NEWS"]);
  });

  it("requires bilingual hero titles when strict", () => {
    const draft = emptyHomepageDraft();
    draft.sections[0]!.hero!.translations.en.title = "";
    draft.sections[0]!.hero!.translations.ar.title = "عنوان";
    expect(() => validateHomepageDraft(draft, true)).toThrow();
  });

  it("clears manual news ids in automatic mode", () => {
    const draft = emptyHomepageDraft();
    draft.sections[1]!.news!.mode = "AUTOMATIC";
    draft.sections[1]!.news!.manualNewsIds = [newsId];
    const parsed = validateHomepageDraft(draft);
    expect(parsed.sections[1]!.news!.manualNewsIds).toEqual([]);
  });

  it("limits manual news selection to three ids", () => {
    const draft = emptyHomepageDraft();
    draft.sections[1]!.news!.mode = "MANUAL";
    draft.sections[1]!.news!.manualNewsIds = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    const parsed = validateHomepageDraft(draft);
    expect(parsed.sections[1]!.news!.manualNewsIds).toHaveLength(3);
  });

  it("swaps section positions", () => {
    const draft = emptyHomepageDraft();
    const swapped = swapHomepageSectionPositions(draft, "NEWS", "up");
    const news = swapped.sections.find((s) => s.sectionType === "NEWS");
    const hero = swapped.sections.find((s) => s.sectionType === "HERO");
    expect(news?.position).toBe(0);
    expect(hero?.position).toBe(1);
  });

  it("validates hero CTA system routes to HOME and NEWS only", () => {
    expect(() =>
      validateHomepageHeroCta(
        {
          ctaEnabled: true,
          ctaTargetType: "SYSTEM_ROUTE",
          systemRouteKey: "HOME",
          contentTargetKind: "",
          contentTargetId: "",
          externalUrl: "",
        },
        true,
      ),
    ).not.toThrow();
    expect(() =>
      validateHomepageHeroCta(
        {
          ctaEnabled: true,
          ctaTargetType: "SYSTEM_ROUTE",
          systemRouteKey: "INVALID",
          contentTargetKind: "",
          contentTargetId: "",
          externalUrl: "",
        },
        true,
      ),
    ).toThrow();
  });
});
