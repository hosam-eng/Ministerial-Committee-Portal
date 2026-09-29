import type { ReactNode } from "react";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";

import { EXTERNAL_LINK_REL, EXTERNAL_LINK_TARGET } from "../../domain/links";
import type { ManagedPageLocale } from "../../domain/locales";
import type { RichTextDocumentV1 } from "../../domain/rich-text-document";
import { richTextExtensions } from "./extensions";

function linkMark(
  mark: { attrs?: Record<string, unknown> },
  children: ReactNode,
  internalHrefs: Record<string, string | null>,
) {
  const kind = mark.attrs?.linkKind;
  const text = <>{children}</>;
  if (kind === "internal") {
    const target =
      typeof mark.attrs?.targetRef === "string" ? mark.attrs.targetRef : "";
    const href = internalHrefs[target];
    if (!href) return <span>{text}</span>;
    return <a href={href}>{text}</a>;
  }
  const href = mark.attrs?.href;
  if (typeof href !== "string" || !href.startsWith("https://"))
    return <span>{text}</span>;
  return (
    <a href={href} target={EXTERNAL_LINK_TARGET} rel={EXTERNAL_LINK_REL}>
      {text}
    </a>
  );
}

export function RichTextPublicView({
  document,
  internalHrefs,
  locale,
}: {
  document: RichTextDocumentV1;
  internalHrefs: Record<string, string | null>;
  locale: ManagedPageLocale;
}) {
  const rendered = renderToReactElement({
    content: document.document,
    extensions: richTextExtensions,
    staticEditorOptions: { textDirection: locale === "ar" ? "rtl" : "ltr" },
    options: {
      nodeMapping: {
        paragraph: ({ children }) => <p>{children}</p>,
        heading: ({ node, children }) => {
          const level = node.attrs?.level;
          if (level === 2) return <h2>{children}</h2>;
          if (level === 3) return <h3>{children}</h3>;
          return <h4>{children}</h4>;
        },
        bulletList: ({ children }) => <ul>{children}</ul>,
        orderedList: ({ children }) => <ol>{children}</ol>,
        listItem: ({ children }) => <li>{children}</li>,
        blockquote: ({ children }) => <blockquote>{children}</blockquote>,
      },
      markMapping: {
        bold: ({ children }) => <strong>{children}</strong>,
        italic: ({ children }) => <em>{children}</em>,
        link: ({ mark, children }) => linkMark(mark, children, internalHrefs),
      },
    },
  });
  return (
    <div
      className="managed-rich-text"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      {rendered}
    </div>
  );
}
