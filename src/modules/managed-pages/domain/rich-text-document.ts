import { ManagedPageError } from "./errors";
import { isUuid } from "./ids";
import { validateExternalUrl } from "./links";

export const RICH_TEXT_SCHEMA_VERSION = 1 as const;
export const RICH_TEXT_ENGINE = "tiptap" as const;
export const RICH_TEXT_ENGINE_VERSION = "3.31.3" as const;

const WRAPPER_KEYS = [
  "schemaVersion",
  "engine",
  "engineVersion",
  "document",
] as const;
const NODE_KEYS = new Set(["type", "attrs", "content", "marks", "text"]);
const BLOCKS = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
]);
const MAX_DEPTH = 12;
const MAX_NODES = 400;

export type RichTextLinkAttrs = {
  linkKind: "internal" | "external";
  href: string | null;
  targetRef: string | null;
};

export type RichTextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: RichTextLinkAttrs };

export type RichTextNode = {
  type: string;
  attrs?: { level?: number; start?: number };
  text?: string;
  marks?: RichTextMark[];
  content?: RichTextNode[];
};

export type RichTextDocumentV1 = {
  schemaVersion: typeof RICH_TEXT_SCHEMA_VERSION;
  engine: typeof RICH_TEXT_ENGINE;
  engineVersion: typeof RICH_TEXT_ENGINE_VERSION;
  document: RichTextNode;
};

export type InternalRichTextReference = {
  targetPageId: string;
};

function fail(): never {
  throw new ManagedPageError("INVALID_RICH_TEXT");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function allowedKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
) {
  for (const key of Object.keys(value)) {
    if (
      !allowed.has(key) ||
      key === "__proto__" ||
      key === "constructor" ||
      key === "prototype"
    ) {
      fail();
    }
  }
}

function readLink(attrs: unknown): RichTextLinkAttrs {
  if (!isRecord(attrs)) fail();
  allowedKeys(attrs, new Set(["linkKind", "href", "targetRef"]));
  if (
    !Object.hasOwn(attrs, "linkKind") ||
    !Object.hasOwn(attrs, "href") ||
    !Object.hasOwn(attrs, "targetRef")
  ) {
    fail();
  }
  if (attrs.linkKind === "external") {
    if (typeof attrs.href !== "string" || attrs.targetRef !== null) fail();
    return {
      linkKind: "external",
      href: validateExternalUrl(attrs.href),
      targetRef: null,
    };
  }
  if (attrs.linkKind === "internal") {
    if (
      attrs.href !== null ||
      typeof attrs.targetRef !== "string" ||
      !isUuid(attrs.targetRef)
    )
      fail();
    return {
      linkKind: "internal",
      href: null,
      targetRef: attrs.targetRef.toLowerCase(),
    };
  }
  fail();
}

function readMarks(
  value: unknown,
  references: InternalRichTextReference[],
): RichTextMark[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) fail();
  const seen = new Set<string>();
  return value.map((mark) => {
    if (!isRecord(mark) || typeof mark.type !== "string") fail();
    allowedKeys(mark, new Set(["type", "attrs"]));
    if (seen.has(mark.type)) fail();
    seen.add(mark.type);
    if (mark.type === "bold" || mark.type === "italic") {
      if (
        mark.attrs != null &&
        (!isRecord(mark.attrs) || Object.keys(mark.attrs).length > 0)
      )
        fail();
      return { type: mark.type };
    }
    if (mark.type === "link") {
      const attrs = readLink(mark.attrs);
      if (attrs.linkKind === "internal" && attrs.targetRef) {
        references.push({ targetPageId: attrs.targetRef });
      }
      return { type: "link", attrs };
    }
    fail();
  });
}

function readNode(
  value: unknown,
  depth: number,
  references: InternalRichTextReference[],
  counter: { nodes: number },
): RichTextNode {
  if (!isRecord(value) || typeof value.type !== "string" || depth > MAX_DEPTH)
    fail();
  counter.nodes += 1;
  if (counter.nodes > MAX_NODES) fail();
  allowedKeys(value, NODE_KEYS);
  const type = value.type;
  if (type === "text") {
    if (
      typeof value.text !== "string" ||
      value.content != null ||
      value.attrs != null
    )
      fail();
    if (value.text.length > 20_000) fail();
    const marks = readMarks(value.marks, references);
    return marks
      ? { type, text: value.text, marks }
      : { type, text: value.text };
  }
  if (value.text != null || value.marks != null) fail();
  const content = Array.isArray(value.content)
    ? value.content.map((child) =>
        readNode(child, depth + 1, references, counter),
      )
    : value.content == null
      ? undefined
      : fail();
  if (type === "doc") {
    if (value.attrs != null) fail();
    for (const child of content ?? []) {
      if (!BLOCKS.has(child.type)) fail();
    }
    return content ? { type, content } : { type };
  }
  if (type === "paragraph" || type === "blockquote") {
    if (value.attrs != null) fail();
    for (const child of content ?? []) {
      if (type === "paragraph" && child.type !== "text") fail();
      if (type === "blockquote" && !BLOCKS.has(child.type)) fail();
    }
    return content ? { type, content } : { type };
  }
  if (type === "heading") {
    if (!isRecord(value.attrs)) fail();
    allowedKeys(value.attrs, new Set(["level"]));
    const level = value.attrs.level;
    if (level !== 2 && level !== 3 && level !== 4) fail();
    for (const child of content ?? []) if (child.type !== "text") fail();
    return content
      ? { type, attrs: { level }, content }
      : { type, attrs: { level } };
  }
  if (type === "bulletList" || type === "orderedList") {
    let attrs: { start?: number } | undefined;
    if (type === "orderedList" && value.attrs != null) {
      if (!isRecord(value.attrs)) fail();
      allowedKeys(value.attrs, new Set(["start"]));
      if (value.attrs.start != null) {
        if (
          typeof value.attrs.start !== "number" ||
          !Number.isInteger(value.attrs.start) ||
          value.attrs.start < 1 ||
          value.attrs.start > 999
        ) {
          fail();
        }
        attrs = { start: value.attrs.start };
      }
    } else if (value.attrs != null) fail();
    if (!content?.length) fail();
    for (const child of content) if (child.type !== "listItem") fail();
    return attrs ? { type, attrs, content } : { type, content };
  }
  if (type === "listItem") {
    if (value.attrs != null || !content?.length) fail();
    for (const child of content) if (!BLOCKS.has(child.type)) fail();
    return { type, content };
  }
  fail();
}

export function readRichTextDocument(value: unknown): RichTextDocumentV1 {
  if (!isRecord(value)) fail();
  const keys = Object.keys(value);
  if (
    keys.length !== WRAPPER_KEYS.length ||
    WRAPPER_KEYS.some((key) => !Object.hasOwn(value, key))
  )
    fail();
  if (
    value.schemaVersion !== RICH_TEXT_SCHEMA_VERSION ||
    value.engine !== RICH_TEXT_ENGINE ||
    value.engineVersion !== RICH_TEXT_ENGINE_VERSION
  ) {
    fail();
  }
  const references: InternalRichTextReference[] = [];
  const document = readNode(value.document, 0, references, { nodes: 0 });
  if (document.type !== "doc") fail();
  return {
    schemaVersion: 1,
    engine: "tiptap",
    engineVersion: RICH_TEXT_ENGINE_VERSION,
    document,
  };
}

export function richTextPlainText(document: RichTextDocumentV1): string {
  const chunks: string[] = [];
  const visit = (node: RichTextNode) => {
    if (node.type === "text" && node.text) chunks.push(node.text);
    node.content?.forEach(visit);
  };
  visit(document.document);
  return chunks.join(" ").replace(/\s+/gu, " ").trim();
}

export function collectRichTextReferences(
  document: RichTextDocumentV1,
): InternalRichTextReference[] {
  const references: InternalRichTextReference[] = [];
  const visit = (node: RichTextNode) => {
    for (const mark of node.marks ?? []) {
      if (
        mark.type === "link" &&
        mark.attrs.linkKind === "internal" &&
        mark.attrs.targetRef
      ) {
        references.push({ targetPageId: mark.attrs.targetRef });
      }
    }
    node.content?.forEach(visit);
  };
  visit(document.document);
  return references;
}

export function emptyRichTextDocument(): RichTextDocumentV1 {
  return readRichTextDocument({
    schemaVersion: 1,
    engine: "tiptap",
    engineVersion: RICH_TEXT_ENGINE_VERSION,
    document: { type: "doc", content: [{ type: "paragraph" }] },
  });
}

export function richTextFromText(text: string): RichTextDocumentV1 {
  return readRichTextDocument({
    schemaVersion: 1,
    engine: "tiptap",
    engineVersion: RICH_TEXT_ENGINE_VERSION,
    document: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    },
  });
}
