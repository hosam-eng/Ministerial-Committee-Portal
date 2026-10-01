import { describe, expect, it } from "vitest";

import {
  coalesceHomepageHeroCtaDraft,
  validateHomepageHeroCta,
} from "@/modules/homepage/domain/hero-cta";
import { resolveHomepageCtaSystemRoutePath } from "@/modules/homepage/domain/system-routes";

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
