export type NewsLocale = "ar" | "en";

export type NewsTranslationInput = {
  title: string;
  slug: string;
  summary?: string | null;
  body?: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type NewsDraftInput = {
  translations: Partial<Record<NewsLocale, NewsTranslationInput>>;
  categoryIds: string[];
};

export class NewsError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "NewsError";
  }
}

export function normalizeSlug(value: string): string {
  const slug = value.trim().toLowerCase().replace(/\s+/gu, "-");
  if (!slug || !/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug)) {
    throw new NewsError("INVALID_SLUG");
  }
  return slug;
}

export function validateDraft(input: NewsDraftInput, complete = false): NewsDraftInput {
  if (!Array.isArray(input.categoryIds) || input.categoryIds.some((id) => typeof id !== "string")) {
    throw new NewsError("INVALID_REFERENCE");
  }
  const translations: NewsDraftInput["translations"] = {};
  for (const locale of ["ar", "en"] as const) {
    const row = input.translations[locale];
    if (!row) {
      if (complete) throw new NewsError("TRANSLATION_INCOMPLETE");
      continue;
    }
    if (typeof row.title !== "string" || typeof row.slug !== "string" ||
        (row.summary != null && typeof row.summary !== "string") ||
        (row.seoTitle != null && typeof row.seoTitle !== "string") ||
        (row.seoDescription != null && typeof row.seoDescription !== "string")) {
      throw new NewsError("TRANSLATION_INCOMPLETE");
    }
    if (row.body != null && (typeof row.body !== "object" || Array.isArray(row.body) ||
        /<\/?[a-z][^>]*>|(?:"(?:html|css|script|iframe)"\s*:)/iu.test(JSON.stringify(row.body)))) {
      throw new NewsError("INVALID_BODY");
    }
    if (complete && (!row.title.trim() || !row.summary?.trim() || !row.body)) {
      throw new NewsError("TRANSLATION_INCOMPLETE");
    }
    translations[locale] = { ...row, title: row.title.trim(), slug: row.slug ? normalizeSlug(row.slug) : "" };
    if (complete && !translations[locale]?.slug) throw new NewsError("TRANSLATION_INCOMPLETE");
  }
  return { translations, categoryIds: [...new Set(input.categoryIds)] };
}
