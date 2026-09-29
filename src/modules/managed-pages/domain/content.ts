import type { CalloutVariant } from "./draft";
import type { ManagedPageLocale } from "./locales";
import type { RichTextDocumentV1 } from "./rich-text-document";

export type ManagedPageContentBlock =
  | {
      id: string;
      type: "RICHTEXT";
      document: RichTextDocumentV1;
      internalHrefs: Record<string, string | null>;
    }
  | {
      id: string;
      type: "CALLOUT";
      variant: CalloutVariant;
      title: string | null;
      body: string;
    }
  | {
      id: string;
      type: "LINK_LIST";
      heading: string | null;
      items: { id: string; label: string; href: string | null }[];
    };

/** Shared by live public pages and explicit-revision Preview. */
export type ManagedPageContent = {
  title: string;
  intro: string | null;
  blocks: ManagedPageContentBlock[];
};

export type ManagedPageContentLocale = ManagedPageLocale;
