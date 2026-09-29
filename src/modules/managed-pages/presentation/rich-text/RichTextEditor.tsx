"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useState } from "react";

import type { ManagedPageLocale } from "../../domain/locales";
import {
  emptyRichTextDocument,
  type RichTextDocumentV1,
} from "../../domain/rich-text-document";
import { richTextExtensions } from "./extensions";
import { richTextFromEditor } from "./rich-text-project";

export type RichTextEditorLabels = {
  toolbar: string;
  editingRegion: string;
  paragraph: string;
  h2: string;
  h3: string;
  h4: string;
  bold: string;
  italic: string;
  bulletList: string;
  orderedList: string;
  quote: string;
  link: string;
  linkDialog: string;
  external: string;
  internal: string;
  url: string;
  page: string;
  applyLink: string;
  removeLink: string;
  close: string;
};

export function RichTextEditor({
  id,
  locale,
  value,
  pages,
  labels,
  onChange,
}: {
  id: string;
  locale: ManagedPageLocale;
  value: RichTextDocumentV1;
  pages: readonly { id: string; label: string }[];
  labels: RichTextEditorLabels;
  onChange: (document: RichTextDocumentV1) => void;
}) {
  const direction = locale === "ar" ? "rtl" : "ltr";
  const editor = useEditor({
    immediatelyRender: false,
    extensions: richTextExtensions,
    content: value.document,
    textDirection: direction,
    editorProps: {
      attributes: {
        dir: direction,
        lang: locale,
        "aria-labelledby": `${id}-toolbar`,
      },
    },
    onUpdate: ({ editor: current }) =>
      onChange(richTextFromEditor(current.getJSON())),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [kind, setKind] = useState<"external" | "internal">("external");
  const [href, setHref] = useState("https://");
  const [targetRef, setTargetRef] = useState(pages[0]?.id ?? "");
  const run = (command: () => boolean) => {
    command();
  };
  const active = (name: string, attrs?: { level: number }) =>
    Boolean(editor?.isActive(name, attrs));
  return (
    <div className="rich-text-editor">
      <div
        id={`${id}-toolbar`}
        className="rich-text-toolbar"
        role="toolbar"
        aria-label={labels.toolbar}
        dir={direction}
      >
        <ToolbarButton
          label={labels.paragraph}
          pressed={active("paragraph")}
          onClick={() =>
            run(() => Boolean(editor?.chain().focus().setParagraph().run()))
          }
        />
        <ToolbarButton
          label={labels.h2}
          pressed={active("heading", { level: 2 })}
          onClick={() =>
            run(() =>
              Boolean(
                editor?.chain().focus().toggleHeading({ level: 2 }).run(),
              ),
            )
          }
        />
        <ToolbarButton
          label={labels.h3}
          pressed={active("heading", { level: 3 })}
          onClick={() =>
            run(() =>
              Boolean(
                editor?.chain().focus().toggleHeading({ level: 3 }).run(),
              ),
            )
          }
        />
        <ToolbarButton
          label={labels.h4}
          pressed={active("heading", { level: 4 })}
          onClick={() =>
            run(() =>
              Boolean(
                editor?.chain().focus().toggleHeading({ level: 4 }).run(),
              ),
            )
          }
        />
        <ToolbarButton
          label={labels.bold}
          pressed={active("bold")}
          onClick={() =>
            run(() => Boolean(editor?.chain().focus().toggleBold().run()))
          }
        />
        <ToolbarButton
          label={labels.italic}
          pressed={active("italic")}
          onClick={() =>
            run(() => Boolean(editor?.chain().focus().toggleItalic().run()))
          }
        />
        <ToolbarButton
          label={labels.bulletList}
          pressed={active("bulletList")}
          onClick={() =>
            run(() => Boolean(editor?.chain().focus().toggleBulletList().run()))
          }
        />
        <ToolbarButton
          label={labels.orderedList}
          pressed={active("orderedList")}
          onClick={() =>
            run(() =>
              Boolean(editor?.chain().focus().toggleOrderedList().run()),
            )
          }
        />
        <ToolbarButton
          label={labels.quote}
          pressed={active("blockquote")}
          onClick={() =>
            run(() => Boolean(editor?.chain().focus().toggleBlockquote().run()))
          }
        />
        <ToolbarButton
          label={labels.link}
          pressed={active("link") || linkOpen}
          onClick={() => setLinkOpen(true)}
        />
      </div>
      {linkOpen && (
        <div
          className="rich-text-link-dialog"
          role="dialog"
          aria-label={labels.linkDialog}
        >
          <fieldset>
            <legend>{labels.linkDialog}</legend>
            <label>
              <input
                type="radio"
                name={`${id}-kind`}
                checked={kind === "external"}
                onChange={() => setKind("external")}
              />
              {labels.external}
            </label>
            <label>
              <input
                type="radio"
                name={`${id}-kind`}
                checked={kind === "internal"}
                onChange={() => setKind("internal")}
              />
              {labels.internal}
            </label>
            {kind === "external" ? (
              <label>
                {labels.url}
                <input
                  value={href}
                  onChange={(event) => setHref(event.target.value)}
                />
              </label>
            ) : (
              <label>
                {labels.page}
                <select
                  value={targetRef}
                  onChange={(event) => setTargetRef(event.target.value)}
                >
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="news-button"
              onClick={() => {
                if (kind === "external") {
                  editor
                    ?.chain()
                    .focus()
                    .setMark("link", {
                      linkKind: "external",
                      href,
                      targetRef: null,
                    })
                    .run();
                } else if (targetRef) {
                  editor
                    ?.chain()
                    .focus()
                    .setMark("link", {
                      linkKind: "internal",
                      href: null,
                      targetRef,
                    })
                    .run();
                }
                setLinkOpen(false);
              }}
            >
              {labels.applyLink}
            </button>
            <button
              type="button"
              className="news-button"
              onClick={() => {
                editor?.chain().focus().unsetMark("link").run();
                setLinkOpen(false);
              }}
            >
              {labels.removeLink}
            </button>
            <button
              type="button"
              className="news-button"
              onClick={() => setLinkOpen(false)}
            >
              {labels.close}
            </button>
          </fieldset>
        </div>
      )}
      <EditorContent
        editor={editor}
        className="rich-text-surface"
        aria-label={labels.editingRegion}
      />
    </div>
  );
}

function ToolbarButton({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="news-button"
      aria-pressed={pressed}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function emptyEditorDocument(): RichTextDocumentV1 {
  return emptyRichTextDocument();
}
