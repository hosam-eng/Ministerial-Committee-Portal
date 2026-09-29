import { describe, expect, it } from "vitest";

import {
  emptyRichTextDocument,
  readRichTextDocument,
  richTextFromText,
  RICH_TEXT_ENGINE_VERSION,
} from "@/modules/managed-pages/domain/rich-text-document";

const wrapper = (document: unknown) => ({
  schemaVersion: 1,
  engine: "tiptap",
  engineVersion: RICH_TEXT_ENGINE_VERSION,
  document,
});

describe("RichTextDocumentV1", () => {
  it("round-trips an allowed document", () => {
    const document = richTextFromText("Committee notice");
    expect(readRichTextDocument(document)).toEqual(document);
    expect(emptyRichTextDocument().document.type).toBe("doc");
  });

  it("rejects an unsupported node", () => {
    expect(() =>
      readRichTextDocument(
        wrapper({ type: "doc", content: [{ type: "iframe" }] }),
      ),
    ).toThrow("INVALID_RICH_TEXT");
  });

  it("rejects an unsupported mark", () => {
    expect(() =>
      readRichTextDocument(
        wrapper({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "x", marks: [{ type: "textStyle" }] },
              ],
            },
          ],
        }),
      ),
    ).toThrow("INVALID_RICH_TEXT");
  });

  it("rejects an unsupported attribute", () => {
    expect(() =>
      readRichTextDocument(
        wrapper({
          type: "doc",
          content: [{ type: "paragraph", attrs: { style: "color:red" } }],
        }),
      ),
    ).toThrow("INVALID_RICH_TEXT");
  });

  it("rejects heading level 1", () => {
    expect(() =>
      readRichTextDocument(
        wrapper({
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: "Title" }],
            },
          ],
        }),
      ),
    ).toThrow("INVALID_RICH_TEXT");
  });

  it("rejects javascript and data links", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,hi"]) {
      expect(() =>
        readRichTextDocument(
          wrapper({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "bad",
                    marks: [
                      {
                        type: "link",
                        attrs: { linkKind: "external", href, targetRef: null },
                      },
                    ],
                  },
                ],
              },
            ],
          }),
        ),
      ).toThrow("INVALID_LINK");
    }
  });

  it("accepts an https link and an internal page reference", () => {
    const target = "11111111-1111-4111-8111-111111111111";
    const document = readRichTextDocument(
      wrapper({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "site",
                marks: [
                  {
                    type: "link",
                    attrs: {
                      linkKind: "external",
                      href: "https://example.com/legal",
                      targetRef: null,
                    },
                  },
                ],
              },
              { type: "text", text: " " },
              {
                type: "text",
                text: "page",
                marks: [
                  {
                    type: "link",
                    attrs: {
                      linkKind: "internal",
                      href: null,
                      targetRef: target,
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    const marks =
      document.document.content?.[0]?.content?.flatMap(
        (node) => node.marks ?? [],
      ) ?? [];
    expect(marks[0]).toMatchObject({
      type: "link",
      attrs: { linkKind: "external" },
    });
    expect(marks[1]).toMatchObject({
      type: "link",
      attrs: { targetRef: target },
    });
  });
});
