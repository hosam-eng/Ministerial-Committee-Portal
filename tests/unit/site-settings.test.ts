import { describe, expect, it } from "vitest";

import {
  composePublicSeoDescription,
  composePublicSeoTitle,
  validateSiteSettingsDraft,
} from "@/modules/site-settings";
import { validateSocialUrl } from "@/modules/site-settings/domain/social-url";

describe("site settings draft", () => {
  it("requires bilingual official names when strict", () => {
    expect(() =>
      validateSiteSettingsDraft(
        {
          contactEmail: "",
          contactPhone: "",
          translations: {
            ar: {
              officialName: "اسم",
              address: "",
              defaultSeoTitle: "",
              defaultSeoDescription: "",
            },
            en: {
              officialName: "",
              address: "",
              defaultSeoTitle: "",
              defaultSeoDescription: "",
            },
          },
          socialLinks: [],
        },
        true,
      ),
    ).toThrow();
  });

  it("rejects duplicate social URLs when strict", () => {
    expect(() =>
      validateSiteSettingsDraft(
        {
          contactEmail: "",
          contactPhone: "",
          translations: {
            ar: {
              officialName: "أ",
              address: "",
              defaultSeoTitle: "",
              defaultSeoDescription: "",
            },
            en: {
              officialName: "B",
              address: "",
              defaultSeoTitle: "",
              defaultSeoDescription: "",
            },
          },
          socialLinks: [
            {
              itemKey: "11111111-1111-4111-8111-111111111111",
              labelAr: "١",
              labelEn: "1",
              url: "https://example.com/a",
              position: 0,
            },
            {
              itemKey: "22222222-2222-4222-8222-222222222222",
              labelAr: "٢",
              labelEn: "2",
              url: "https://example.com/a",
              position: 1,
            },
          ],
        },
        true,
      ),
    ).toThrow();
  });
});

describe("social URL policy", () => {
  it("accepts https and rejects javascript", () => {
    expect(validateSocialUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
    expect(() => validateSocialUrl("javascript:alert(1)")).toThrow();
  });
});

describe("public SEO composition", () => {
  it("prefers explicit entity SEO over site defaults", () => {
    expect(
      composePublicSeoTitle({
        explicitTitle: " News SEO ",
        pageTitle: "Page",
        liveDefaultTitle: "Site",
        staticFallback: "Static",
      }),
    ).toBe("News SEO");
    expect(
      composePublicSeoDescription({
        explicitDescription: " Entity ",
        pageDescription: "Page",
        liveDefaultDescription: "Site",
      }),
    ).toBe("Entity");
  });
});
