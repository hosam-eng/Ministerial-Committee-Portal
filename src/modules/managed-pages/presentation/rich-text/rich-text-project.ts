import { generateJSON } from "@tiptap/core";

import {
  emptyRichTextDocument,
  readRichTextDocument,
  RICH_TEXT_ENGINE_VERSION,
  type RichTextDocumentV1,
} from "../../domain/rich-text-document";
import { richTextExtensions } from "./extensions";

type Json = Record<string, unknown>;

function record(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function projectMarks(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const marks = [];
  const seen = new Set<string>();
  for (const mark of value) {
    const row = record(mark);
    if (!row || typeof row.type !== "string" || seen.has(row.type)) continue;
    const type = row.type;
    seen.add(type);
    if (type === "bold" || type === "italic") {
      marks.push({ type });
      continue;
    }
    if (type !== "link") continue;
    const attrs = record(row.attrs);
    if (attrs?.linkKind === "internal" && typeof attrs.targetRef === "string") {
      marks.push({
        type: "link",
        attrs: { linkKind: "internal", href: null, targetRef: attrs.targetRef },
      });
      continue;
    }
    if (typeof attrs?.href === "string" && attrs.href.startsWith("https://")) {
      marks.push({
        type: "link",
        attrs: { linkKind: "external", href: attrs.href, targetRef: null },
      });
    }
  }
  return marks.length ? marks : undefined;
}

function projectNode(value: unknown): Json | null {
  const node = record(value);
  if (!node || typeof node.type !== "string") return null;
  const children = Array.isArray(node.content)
    ? node.content
        .map(projectNode)
        .filter((child): child is Json => child !== null)
    : [];
  if (node.type === "text" && typeof node.text === "string") {
    const marks = projectMarks(node.marks);
    return marks
      ? { type: "text", text: node.text, marks }
      : { type: "text", text: node.text };
  }
  if (node.type === "paragraph" || node.type === "blockquote") {
    return children.length
      ? { type: node.type, content: children }
      : { type: node.type };
  }
  if (node.type === "heading") {
    const level = record(node.attrs)?.level;
    if (level !== 2 && level !== 3 && level !== 4) return null;
    return children.length
      ? { type: "heading", attrs: { level }, content: children }
      : { type: "heading", attrs: { level } };
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const items = children.filter((child) => child.type === "listItem");
    if (!items.length) return null;
    const start = record(node.attrs)?.start;
    if (node.type === "orderedList" && typeof start === "number") {
      return { type: node.type, attrs: { start }, content: items };
    }
    return { type: node.type, content: items };
  }
  if (node.type === "listItem") {
    const blocks = children.filter((child) => child.type !== "text");
    return blocks.length
      ? { type: "listItem", content: blocks }
      : { type: "listItem", content: [{ type: "paragraph" }] };
  }
  if (node.type === "doc") {
    const blocks = children.filter(
      (child) => child.type !== "text" && child.type !== "listItem",
    );
    return blocks.length
      ? { type: "doc", content: blocks }
      : { type: "doc", content: [{ type: "paragraph" }] };
  }
  return null;
}

export function projectTipTapJson(value: unknown): unknown {
  const document = projectNode(value) ?? {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
  return {
    schemaVersion: 1,
    engine: "tiptap",
    engineVersion: RICH_TEXT_ENGINE_VERSION,
    document,
  };
}

export function richTextFromEditor(value: unknown): RichTextDocumentV1 {
  try {
    return readRichTextDocument(projectTipTapJson(value));
  } catch {
    return emptyRichTextDocument();
  }
}

export function normalizePastedHtml(html: string): RichTextDocumentV1 {
  return richTextFromEditor(generateJSON(html, richTextExtensions));
}
