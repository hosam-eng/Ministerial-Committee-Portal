import { ManagedPageError } from "./errors";
import { isUuid } from "./ids";
import { validateExternalUrl } from "./links";
import {
  collectRichTextReferences,
  readRichTextDocument,
  richTextPlainText,
  type RichTextDocumentV1,
} from "./rich-text-document";
import { isManagedPageLocale, type ManagedPageLocale } from "./locales";
import { normalizeSlug } from "./slug";

export const CALLOUT_VARIANTS = [
  "institutional",
  "info",
  "success",
  "warning",
  "error",
] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];
export const BLOCK_TYPES = ["RICHTEXT", "CALLOUT", "LINK_LIST"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export type LinkItemDraft = {
  id: string;
  kind: "internal" | "external";
  targetRef: string | null;
  href: string | null;
};

export type BlockLocaleContent = {
  document: RichTextDocumentV1 | null;
  title: string | null;
  body: string | null;
  heading: string | null;
  labels: Record<string, string>;
};

export type BlockDraft = {
  id: string;
  type: BlockType;
  calloutVariant: CalloutVariant | null;
  linkItems: LinkItemDraft[];
  content: Partial<Record<ManagedPageLocale, BlockLocaleContent>>;
};

export type TranslationDraft = {
  title: string;
  slug: string;
  intro: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ManagedPageDraft = {
  translations: Partial<Record<ManagedPageLocale, TranslationDraft>>;
  blocks: BlockDraft[];
};

export type ManagedPageReferenceDraft = {
  blockId: string;
  targetPageId: string;
  locale: ManagedPageLocale | null;
  origin: "RICHTEXT" | "LINK_LIST";
  itemKey: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function plain(value: unknown, max: number, required = false): string | null {
  if (value == null || value === "") return required ? failIncomplete() : null;
  if (typeof value !== "string" || value.length > max || /[<>]/u.test(value)) {
    throw new ManagedPageError("INVALID_BLOCK");
  }
  const trimmed = value.trim();
  if (!trimmed) return required ? failIncomplete() : null;
  return trimmed;
}

function failIncomplete(): never {
  throw new ManagedPageError("TRANSLATION_INCOMPLETE");
}

function readLinkItem(value: unknown, complete: boolean): LinkItemDraft {
  if (!isRecord(value) || typeof value.id !== "string" || !isUuid(value.id)) {
    throw new ManagedPageError("INVALID_BLOCK");
  }
  if (value.kind === "external") {
    if (value.targetRef != null) throw new ManagedPageError("INVALID_BLOCK");
    if (typeof value.href !== "string" || !value.href.trim()) {
      if (complete) throw new ManagedPageError("INVALID_LINK");
      return {
        id: value.id.toLowerCase(),
        kind: "external",
        targetRef: null,
        href: null,
      };
    }
    return {
      id: value.id.toLowerCase(),
      kind: "external",
      targetRef: null,
      href: validateExternalUrl(value.href),
    };
  }
  if (value.kind === "internal") {
    if (value.href != null) throw new ManagedPageError("INVALID_BLOCK");
    if (typeof value.targetRef !== "string" || !value.targetRef.trim()) {
      if (complete) throw new ManagedPageError("INVALID_REFERENCE");
      return {
        id: value.id.toLowerCase(),
        kind: "internal",
        targetRef: null,
        href: null,
      };
    }
    if (!isUuid(value.targetRef))
      throw new ManagedPageError("INVALID_REFERENCE");
    return {
      id: value.id.toLowerCase(),
      kind: "internal",
      targetRef: value.targetRef.toLowerCase(),
      href: null,
    };
  }
  throw new ManagedPageError("INVALID_BLOCK");
}

function readLocaleContent(
  type: BlockType,
  value: unknown,
  items: LinkItemDraft[],
  complete: boolean,
): BlockLocaleContent {
  if (!isRecord(value)) throw new ManagedPageError("INVALID_BLOCK");
  if (type === "RICHTEXT") {
    const document =
      value.document == null ? null : readRichTextDocument(value.document);
    if (complete && (!document || !richTextPlainText(document)))
      failIncomplete();
    return { document, title: null, body: null, heading: null, labels: {} };
  }
  if (type === "CALLOUT") {
    const title = plain(value.title, 200);
    const body = plain(value.body, 4000, complete);
    if (complete && !body) failIncomplete();
    return { document: null, title, body, heading: null, labels: {} };
  }
  const heading = plain(value.heading, 200);
  if (!isRecord(value.labels)) throw new ManagedPageError("INVALID_BLOCK");
  const labels: Record<string, string> = {};
  const itemIds = new Set(items.map((item) => item.id));
  for (const [id, label] of Object.entries(value.labels)) {
    if (!itemIds.has(id.toLowerCase()))
      throw new ManagedPageError("INVALID_BLOCK");
    const text = plain(label, 200, complete);
    if (complete && !text) failIncomplete();
    if (text) labels[id.toLowerCase()] = text;
  }
  if (complete) {
    if (!items.length) throw new ManagedPageError("INVALID_BLOCK");
    for (const item of items) if (!labels[item.id]) failIncomplete();
  }
  return { document: null, title: null, body: null, heading, labels };
}

function readTranslation(value: unknown, complete: boolean): TranslationDraft {
  if (!isRecord(value)) failIncomplete();
  const title =
    typeof value.title === "string" ? value.title.trim() : failIncomplete();
  const slugRaw =
    typeof value.slug === "string" ? value.slug.trim() : failIncomplete();
  if (title.length > 200 || /[<>]/u.test(title))
    throw new ManagedPageError("INVALID_BLOCK");
  const intro = plain(value.intro, 600);
  const seoTitle = plain(value.seoTitle, 200);
  const seoDescription = plain(value.seoDescription, 400);
  if (complete && !title) failIncomplete();
  const slug = slugRaw ? normalizeSlug(slugRaw) : "";
  if (complete && !slug) failIncomplete();
  return { title, slug, intro, seoTitle, seoDescription };
}

export function validateManagedPageDraft(
  value: unknown,
  complete = false,
): ManagedPageDraft {
  if (
    !isRecord(value) ||
    !Array.isArray(value.blocks) ||
    !isRecord(value.translations)
  ) {
    throw new ManagedPageError("INVALID_DRAFT");
  }
  if (value.blocks.length > 40) throw new ManagedPageError("INVALID_BLOCK");
  const translations: ManagedPageDraft["translations"] = {};
  for (const locale of ["ar", "en"] as const) {
    const row = value.translations[locale];
    if (row == null) {
      if (complete) failIncomplete();
      continue;
    }
    translations[locale] = readTranslation(row, complete);
  }
  const blocks: BlockDraft[] = [];
  const ids = new Set<string>();
  for (const raw of value.blocks) {
    if (!isRecord(raw) || typeof raw.id !== "string" || !isUuid(raw.id)) {
      throw new ManagedPageError("INVALID_BLOCK");
    }
    const id = raw.id.toLowerCase();
    if (ids.has(id)) throw new ManagedPageError("INVALID_BLOCK");
    ids.add(id);
    if (
      raw.type !== "RICHTEXT" &&
      raw.type !== "CALLOUT" &&
      raw.type !== "LINK_LIST"
    ) {
      throw new ManagedPageError("INVALID_BLOCK");
    }
    const type = raw.type;
    let calloutVariant: CalloutVariant | null = null;
    let linkItems: LinkItemDraft[] = [];
    if (type === "CALLOUT") {
      if (!CALLOUT_VARIANTS.includes(raw.calloutVariant as CalloutVariant)) {
        throw new ManagedPageError("INVALID_BLOCK");
      }
      calloutVariant = raw.calloutVariant as CalloutVariant;
      if (
        raw.linkItems != null &&
        (!Array.isArray(raw.linkItems) || raw.linkItems.length > 0)
      ) {
        throw new ManagedPageError("INVALID_BLOCK");
      }
    } else if (type === "LINK_LIST") {
      if (raw.calloutVariant != null)
        throw new ManagedPageError("INVALID_BLOCK");
      if (!Array.isArray(raw.linkItems) || raw.linkItems.length > 30) {
        throw new ManagedPageError("INVALID_BLOCK");
      }
      const itemIds = new Set<string>();
      linkItems = raw.linkItems.map((item) => {
        const read = readLinkItem(item, complete);
        if (itemIds.has(read.id)) throw new ManagedPageError("INVALID_BLOCK");
        itemIds.add(read.id);
        return read;
      });
    } else if (
      raw.calloutVariant != null ||
      (Array.isArray(raw.linkItems) && raw.linkItems.length > 0)
    ) {
      throw new ManagedPageError("INVALID_BLOCK");
    }
    if (!isRecord(raw.content)) throw new ManagedPageError("INVALID_BLOCK");
    const content: BlockDraft["content"] = {};
    for (const locale of ["ar", "en"] as const) {
      const localized = raw.content[locale];
      if (localized == null) {
        if (complete) failIncomplete();
        continue;
      }
      content[locale] = readLocaleContent(type, localized, linkItems, complete);
    }
    blocks.push({ id, type, calloutVariant, linkItems, content });
  }
  return { translations, blocks };
}

export function collectDraftReferences(
  draft: ManagedPageDraft,
): ManagedPageReferenceDraft[] {
  const references: ManagedPageReferenceDraft[] = [];
  for (const block of draft.blocks) {
    if (block.type === "LINK_LIST") {
      for (const item of block.linkItems) {
        if (item.kind === "internal" && item.targetRef) {
          references.push({
            blockId: block.id,
            targetPageId: item.targetRef,
            locale: null,
            origin: "LINK_LIST",
            itemKey: item.id,
          });
        }
      }
    }
    for (const locale of ["ar", "en"] as const) {
      const content = block.content[locale];
      if (!content?.document) continue;
      for (const reference of collectRichTextReferences(content.document)) {
        references.push({
          blockId: block.id,
          targetPageId: reference.targetPageId,
          locale,
          origin: "RICHTEXT",
          itemKey: null,
        });
      }
    }
  }
  return references;
}

export function isCalloutVariant(value: string): value is CalloutVariant {
  return CALLOUT_VARIANTS.includes(value as CalloutVariant);
}

export function assertLocale(value: string): ManagedPageLocale {
  if (!isManagedPageLocale(value))
    throw new ManagedPageError("TRANSLATION_INCOMPLETE");
  return value;
}
