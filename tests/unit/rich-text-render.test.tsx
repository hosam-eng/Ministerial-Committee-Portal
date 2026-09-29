/** @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { readRichTextDocument } from "@/modules/managed-pages/domain/rich-text-document";
import { ManagedPagePublicContent } from "@/modules/managed-pages/presentation/managed-page-public-content";
import { normalizePastedHtml } from "@/modules/managed-pages/presentation/rich-text/rich-text-project";
import { RichTextPublicView } from "@/modules/managed-pages/presentation/rich-text/rich-text-render-public";

const labels = {
  breadcrumb: "Breadcrumb",
  home: "Home",
  untitled: "Untitled",
  callout: {
    institutional: "Institutional",
    info: "Information",
    success: "Success",
    warning: "Warning",
    error: "Error",
  },
};

function documentFrom(text: string, localeMarks = false) {
  return readRichTextDocument({
    schemaVersion: 1,
    engine: "tiptap",
    engineVersion: "3.31.3",
    document: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text }],
        },
        localeMarks
          ? {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "https",
                  marks: [
                    {
                      type: "link",
                      attrs: {
                        linkKind: "external",
                        href: "https://example.com/policy",
                        targetRef: null,
                      },
                    },
                  ],
                },
              ],
            }
          : { type: "paragraph", content: [{ type: "text", text: "body" }] },
      ],
    },
  });
}

describe("RichText public rendering and paste", () => {
  it("normalizes Word-like HTML into the persisted document", () => {
    const document = normalizePastedHtml(
      '<p class="MsoNormal"><b>Hello</b> <script>alert(1)</script></p>',
    );
    const serialized = JSON.stringify(document);
    expect(document.schemaVersion).toBe(1);
    expect(serialized).toContain("Hello");
    expect(serialized).not.toContain("script");
    expect(serialized).not.toContain("MsoNormal");
    expect(serialized).not.toContain("alert");
  });

  it("normalizes plain text without storing HTML", () => {
    const document = normalizePastedHtml("Plain announcement");
    expect(JSON.stringify(document)).toContain("Plain announcement");
    expect(JSON.stringify(document)).not.toContain("<");
  });

  it("drops an XSS payload instead of persisting it", () => {
    const document = normalizePastedHtml(
      '<img src=x onerror="alert(1)"><iframe src="javascript:alert(1)"></iframe><p>Safe</p>',
    );
    const serialized = JSON.stringify(document);
    expect(serialized).toContain("Safe");
    expect(serialized).not.toContain("onerror");
    expect(serialized).not.toContain("iframe");
    expect(serialized).not.toContain("javascript:");
  });

  it("renders semantic elements for Arabic and English", () => {
    const arabic = renderToStaticMarkup(
      <RichTextPublicView
        document={documentFrom("عنوان السياسة")}
        internalHrefs={{}}
        locale="ar"
      />,
    );
    const english = renderToStaticMarkup(
      <RichTextPublicView
        document={documentFrom("Policy heading", true)}
        internalHrefs={{}}
        locale="en"
      />,
    );
    expect(arabic).toContain('lang="ar"');
    expect(arabic).toContain('dir="rtl"');
    expect(arabic).toContain("<h2>عنوان السياسة</h2>");
    expect(arabic).not.toContain("dangerouslySetInnerHTML");
    expect(english).toContain('lang="en"');
    expect(english).toContain('dir="ltr"');
    expect(english).toContain("<h2>Policy heading</h2>");
    expect(english).toContain('href="https://example.com/policy"');
    expect(english).toContain('rel="noopener noreferrer"');
    expect(english).toContain('target="_blank"');
  });

  it("uses the same markup for preview and live content", () => {
    const content = {
      title: "About",
      intro: "Introduction",
      blocks: [
        {
          id: "block-1",
          type: "RICHTEXT" as const,
          document: documentFrom("Shared"),
          internalHrefs: {},
        },
        {
          id: "block-2",
          type: "CALLOUT" as const,
          variant: "institutional" as const,
          title: "Note",
          body: "Callout body",
        },
        {
          id: "block-3",
          type: "LINK_LIST" as const,
          heading: "Related",
          items: [
            { id: "item-1", label: "Live", href: "/en/pages/live" },
            { id: "item-2", label: "Hidden", href: null },
          ],
        },
      ],
    };
    const live = renderToStaticMarkup(
      <ManagedPagePublicContent
        content={content}
        locale="en"
        homeHref="/en"
        labels={labels}
      />,
    );
    const preview = renderToStaticMarkup(
      <ManagedPagePublicContent
        content={content}
        locale="en"
        homeHref="/en"
        labels={labels}
      />,
    );
    expect(preview).toBe(live);
    expect(live).toContain("<h1>About</h1>");
    expect(live).toContain("Hidden");
    expect(live).not.toContain('href=""');
    expect(live.match(/<h1>/gu)).toHaveLength(1);
  });
});
