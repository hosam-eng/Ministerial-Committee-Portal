/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  readRichTextDocument,
  RICH_TEXT_ENGINE_VERSION,
} from "@/modules/managed-pages/domain/rich-text-document";
import { ManagedPagePublicContent } from "@/modules/managed-pages/presentation/managed-page-public-content";
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

function richText(content: unknown) {
  return readRichTextDocument({
    schemaVersion: 1,
    engine: "tiptap",
    engineVersion: RICH_TEXT_ENGINE_VERSION,
    document: { type: "doc", content },
  });
}

describe("public rich text renderer", () => {
  it("renders semantic elements and safe external link attributes", () => {
    const value = richText([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Duties" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Strong", marks: [{ type: "bold" }] },
          { type: "text", text: " " },
          { type: "text", text: "Emphasis", marks: [{ type: "italic" }] },
          { type: "text", text: " " },
          {
            type: "text",
            text: "Website",
            marks: [
              {
                type: "link",
                attrs: {
                  linkKind: "external",
                  href: "https://example.com",
                  targetRef: null,
                },
              },
            ],
          },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Item" }] },
            ],
          },
        ],
      },
      {
        type: "blockquote",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Quote" }] },
        ],
      },
    ]);
    render(
      <RichTextPublicView document={value} internalHrefs={{}} locale="en" />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Duties" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Strong").tagName).toBe("STRONG");
    expect(screen.getByText("Emphasis").tagName).toBe("EM");
    const link = screen.getByRole("link", { name: "Website" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(document.querySelector("blockquote")).toHaveTextContent("Quote");
    expect(
      screen.getByText("Duties").closest(".managed-rich-text"),
    ).toHaveAttribute("dir", "ltr");
  });

  it("renders Arabic sample text right to left and English sample text left to right", () => {
    const arabic = richText([
      {
        type: "paragraph",
        content: [{ type: "text", text: "اللجنة الوزارية" }],
      },
    ]);
    const english = richText([
      {
        type: "paragraph",
        content: [{ type: "text", text: "Ministerial Committee" }],
      },
    ]);
    const { rerender } = render(
      <RichTextPublicView document={arabic} internalHrefs={{}} locale="ar" />,
    );
    expect(
      screen.getByText("اللجنة الوزارية").closest(".managed-rich-text"),
    ).toHaveAttribute("dir", "rtl");
    rerender(
      <RichTextPublicView document={english} internalHrefs={{}} locale="en" />,
    );
    expect(
      screen.getByText("Ministerial Committee").closest(".managed-rich-text"),
    ).toHaveAttribute("dir", "ltr");
  });

  it("does not turn an XSS payload into a script element", () => {
    const value = richText([
      {
        type: "paragraph",
        content: [{ type: "text", text: "<script>alert(1)</script>" }],
      },
    ]);
    const { container } = render(
      <RichTextPublicView document={value} internalHrefs={{}} locale="en" />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });

  it("degrades an unpublished internal target to non-clickable text", () => {
    const target = "11111111-1111-4111-8111-111111111111";
    const value = richText([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Privacy",
            marks: [
              {
                type: "link",
                attrs: { linkKind: "internal", href: null, targetRef: target },
              },
            ],
          },
        ],
      },
    ]);
    render(
      <RichTextPublicView
        document={value}
        internalHrefs={{ [target]: null }}
        locale="en"
      />,
    );
    expect(screen.queryByRole("link", { name: "Privacy" })).toBeNull();
    expect(screen.getByText("Privacy")).toBeInTheDocument();
  });
});

describe("managed page content renderer parity", () => {
  it("produces the same markup for the same validated content", () => {
    const content = {
      title: "About the committee",
      intro: "A short introduction",
      blocks: [
        {
          id: "block",
          type: "CALLOUT" as const,
          variant: "institutional" as const,
          title: "Note",
          body: "Institutional note",
        },
        {
          id: "links",
          type: "LINK_LIST" as const,
          heading: "Related",
          items: [
            { id: "live", label: "Live", href: "/en/pages/live" },
            { id: "hidden", label: "Hidden", href: null },
          ],
        },
      ],
    };
    const first = render(
      <ManagedPagePublicContent
        content={content}
        locale="en"
        homeHref="/en"
        labels={labels}
      />,
    );
    const html = first.container.innerHTML;
    first.unmount();
    const second = render(
      <ManagedPagePublicContent
        content={content}
        locale="en"
        homeHref="/en"
        labels={labels}
      />,
    );
    expect(second.container.innerHTML).toBe(html);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Live" })).toHaveAttribute(
      "href",
      "/en/pages/live",
    );
    expect(screen.queryByRole("link", { name: "Hidden" })).toBeNull();
    expect(screen.getByText("Institutional")).toBeInTheDocument();
  });
});
