import { describe, expect, it } from "vitest";

import { HomepageError } from "@/modules/homepage/domain/errors";
import {
  coalesceHomepageHeroCtaDraft,
  patchHomepageHeroCtaForTargetTypeChange,
  validateHomepageHeroCta,
} from "@/modules/homepage/domain/hero-cta";
import { resolveHomepageCtaSystemRoutePath } from "@/modules/homepage/domain/system-routes";

const MP01 = "01a10210-dfe3-750b-a6a5-b318f5651ee0";

describe("homepage hero CTA", () => {
  it("coalesces enabled CTA with empty target type to SYSTEM_ROUTE NEWS", () => {
    const raw = {
      ctaEnabled: true,
      ctaTargetType: "" as const,
      systemRouteKey: "NEWS",
      contentTargetKind: "" as const,
      contentTargetId: "",
      externalUrl: "",
    };
    const coalesced = coalesceHomepageHeroCtaDraft(raw);
    expect(coalesced.ctaTargetType).toBe("SYSTEM_ROUTE");
    expect(coalesced.systemRouteKey).toBe("NEWS");
    expect(resolveHomepageCtaSystemRoutePath("NEWS", "ar")).toBe("/ar/news");
    expect(resolveHomepageCtaSystemRoutePath("NEWS", "en")).toBe("/en/news");
  });

  it("resolves SYSTEM_ROUTE HOME per locale", () => {
    const cta = validateHomepageHeroCta(
      {
        ctaEnabled: true,
        ctaTargetType: "SYSTEM_ROUTE",
        systemRouteKey: "HOME",
        contentTargetKind: "",
        contentTargetId: "",
        externalUrl: "",
      },
      true,
    );
    expect(resolveHomepageCtaSystemRoutePath("HOME", "ar")).toBe("/ar");
    expect(resolveHomepageCtaSystemRoutePath("HOME", "en")).toBe("/en");
    expect(cta.ctaEnabled).toBe(true);
  });

  it("rejects CONTENT_ROUTE with stale systemRouteKey (pre-fix editor bug)", () => {
    expect(() =>
      validateHomepageHeroCta(
        {
          ctaEnabled: true,
          ctaTargetType: "CONTENT_ROUTE",
          systemRouteKey: "NEWS",
          contentTargetKind: "MANAGED_PAGE",
          contentTargetId: MP01,
          externalUrl: "",
        },
        true,
      ),
    ).toThrow(HomepageError);
    try {
      validateHomepageHeroCta(
        {
          ctaEnabled: true,
          ctaTargetType: "CONTENT_ROUTE",
          systemRouteKey: "NEWS",
          contentTargetKind: "MANAGED_PAGE",
          contentTargetId: MP01,
          externalUrl: "",
        },
        true,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(HomepageError);
      expect((error as HomepageError).code).toBe("INVALID_CTA");
    }
  });

  it("accepts SYSTEM_ROUTE → CONTENT_ROUTE → MANAGED_PAGE after target-type patch", () => {
    const systemRouteCta = {
      ctaEnabled: true,
      ctaTargetType: "SYSTEM_ROUTE" as const,
      systemRouteKey: "NEWS",
      contentTargetKind: "" as const,
      contentTargetId: "",
      externalUrl: "",
    };
    const afterTypeChange = {
      ...systemRouteCta,
      ...patchHomepageHeroCtaForTargetTypeChange(
        systemRouteCta,
        "CONTENT_ROUTE",
      ),
    };
    expect(afterTypeChange.systemRouteKey).toBe("");
    const withPage = {
      ...afterTypeChange,
      contentTargetKind: "MANAGED_PAGE" as const,
      contentTargetId: MP01,
    };
    const validated = validateHomepageHeroCta(withPage, true);
    expect(validated.ctaTargetType).toBe("CONTENT_ROUTE");
    expect(validated.systemRouteKey).toBe("");
    expect(validated.contentTargetKind).toBe("MANAGED_PAGE");
    expect(validated.contentTargetId).toBe(MP01);
  });

  it("clears content targets when switching CONTENT_ROUTE → SYSTEM_ROUTE", () => {
    const contentCta = {
      ctaEnabled: true,
      ctaTargetType: "CONTENT_ROUTE" as const,
      systemRouteKey: "",
      contentTargetKind: "MANAGED_PAGE" as const,
      contentTargetId: MP01,
      externalUrl: "",
    };
    const patched = {
      ...contentCta,
      ...patchHomepageHeroCtaForTargetTypeChange(contentCta, "SYSTEM_ROUTE"),
    };
    const validated = validateHomepageHeroCta(
      { ...patched, systemRouteKey: "HOME" },
      true,
    );
    expect(validated.ctaTargetType).toBe("SYSTEM_ROUTE");
    expect(validated.systemRouteKey).toBe("HOME");
    expect(validated.contentTargetId).toBe("");
  });

  it("clears SYSTEM_ROUTE and content fields for EXTERNAL_LINK transition", () => {
    const fromSystem = {
      ctaEnabled: true,
      ctaTargetType: "SYSTEM_ROUTE" as const,
      systemRouteKey: "NEWS",
      contentTargetKind: "" as const,
      contentTargetId: "",
      externalUrl: "",
    };
    const patched = {
      ...fromSystem,
      ...patchHomepageHeroCtaForTargetTypeChange(fromSystem, "EXTERNAL_LINK"),
      externalUrl: "https://example.com/path",
    };
    expect(patched.systemRouteKey).toBe("");
    expect(patched.contentTargetId).toBe("");
  });

  it("clears CTA fields when disabled", () => {
    const cta = validateHomepageHeroCta(
      {
        ctaEnabled: false,
        ctaTargetType: "SYSTEM_ROUTE",
        systemRouteKey: "NEWS",
        contentTargetKind: "",
        contentTargetId: "",
        externalUrl: "",
      },
      false,
    );
    expect(cta.ctaEnabled).toBe(false);
    expect(cta.ctaTargetType).toBe("");
  });
});
