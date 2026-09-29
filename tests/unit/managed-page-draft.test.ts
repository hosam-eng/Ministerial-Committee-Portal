import { describe, expect, it } from "vitest";

import { validateManagedPageDraft } from "@/modules/managed-pages";
import { richTextFromText } from "@/modules/managed-pages/domain/rich-text-document";

const itemId = "55555555-5555-4555-8555-555555555555";

function draft(overrides?: {
  labels?: Record<string, string>;
  href?: string;
  omitEnglish?: boolean;
}) {
  return {
    translations: {
      ar: {
        title: "عنوان",
        slug: "about",
        intro: null,
        seoTitle: null,
        seoDescription: null,
      },
      en: {
        title: "About",
        slug: "about-en",
        intro: null,
        seoTitle: null,
        seoDescription: null,
      },
    },
    blocks: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        type: "LINK_LIST",
        calloutVariant: null,
        linkItems: [
          {
            id: itemId,
            kind: "external",
            targetRef: null,
            href: overrides?.href ?? "https://example.com",
          },
        ],
        content: {
          ar: {
            heading: "روابط",
            labels: overrides?.labels ?? { [itemId]: "موقع" },
          },
          ...(overrides?.omitEnglish
            ? {}
            : {
                en: {
                  heading: "Links",
                  labels: overrides?.labels ?? { [itemId]: "موقع" },
                },
              }),
        },
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        type: "RICHTEXT",
        calloutVariant: null,
        linkItems: [],
        content: {
          ar: { document: richTextFromText("نص") },
          en: { document: richTextFromText("Text") },
        },
      },
    ],
  };
}

describe("managed page draft structure", () => {
  it("keeps Arabic and English on one shared block list", () => {
    const value = validateManagedPageDraft(draft(), true);
    expect(value.blocks).toHaveLength(2);
    expect(value.blocks.map((block) => block.type)).toEqual([
      "LINK_LIST",
      "RICHTEXT",
    ]);
    expect(Object.keys(value.blocks[0]!.content).sort()).toEqual(["ar", "en"]);
  });

  it("rejects a label that does not belong to the shared link item", () => {
    expect(() =>
      validateManagedPageDraft(
        draft({ labels: { "66666666-6666-4666-8666-666666666666": "Wrong" } }),
        true,
      ),
    ).toThrow("INVALID_BLOCK");
  });

  it("rejects an incomplete locale and an unsafe external address", () => {
    expect(() =>
      validateManagedPageDraft(draft({ omitEnglish: true }), true),
    ).toThrow("TRANSLATION_INCOMPLETE");
    expect(() =>
      validateManagedPageDraft(draft({ href: "http://example.com" }), true),
    ).toThrow("INVALID_LINK");
  });
});
