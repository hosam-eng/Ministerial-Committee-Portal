export type NewsLocale = "ar" | "en";

export type NewsBodyV1 = {
  version: 1;
  type: "plainText";
  text: string;
};

export type NewsTranslationInput = {
  title: string;
  slug: string;
  summary?: string | null;
  body?: NewsBodyV1 | null;
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

export function readNewsBody(value: unknown): NewsBodyV1 | null {
  if (value == null) return null;
  if (
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 3 ||
    !Object.hasOwn(value, "version") ||
    !Object.hasOwn(value, "type") ||
    !Object.hasOwn(value, "text")
  )
    throw new NewsError("INVALID_BODY");
  const body = value as Record<string, unknown>;
  if (
    body.version !== 1 ||
    body.type !== "plainText" ||
    typeof body.text !== "string" ||
    /<\/?[a-z][^>]*>/iu.test(body.text)
  ) {
    throw new NewsError("INVALID_BODY");
  }
  return { version: 1, type: "plainText", text: body.text };
}

export function newsBodyFromText(text: string): NewsBodyV1 | null {
  return text.trim()
    ? readNewsBody({ version: 1, type: "plainText", text })
    : null;
}

export function newsBodyText(value: unknown): string {
  return readNewsBody(value)?.text ?? "";
}

export function normalizeSlug(value: string): string {
  const slug = value.trim().toLowerCase().replace(/\s+/gu, "-");
  if (!slug || !/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug)) {
    throw new NewsError("INVALID_SLUG");
  }
  return slug;
}

export function validateDraft(
  input: NewsDraftInput,
  complete = false,
): NewsDraftInput {
  if (
    !Array.isArray(input.categoryIds) ||
    input.categoryIds.some((id) => typeof id !== "string")
  ) {
    throw new NewsError("INVALID_REFERENCE");
  }
  const translations: NewsDraftInput["translations"] = {};
  for (const locale of ["ar", "en"] as const) {
    const row = input.translations[locale];
    if (!row) {
      if (complete) throw new NewsError("TRANSLATION_INCOMPLETE");
      continue;
    }
    if (
      typeof row.title !== "string" ||
      typeof row.slug !== "string" ||
      (row.summary != null && typeof row.summary !== "string") ||
      (row.seoTitle != null && typeof row.seoTitle !== "string") ||
      (row.seoDescription != null && typeof row.seoDescription !== "string")
    ) {
      throw new NewsError("TRANSLATION_INCOMPLETE");
    }
    const body = readNewsBody(row.body);
    if (
      complete &&
      (!row.title.trim() || !row.summary?.trim() || !body?.text.trim())
    ) {
      throw new NewsError("TRANSLATION_INCOMPLETE");
    }
    translations[locale] = {
      ...row,
      body,
      title: row.title.trim(),
      slug: row.slug ? normalizeSlug(row.slug) : "",
    };
    if (complete && !translations[locale]?.slug)
      throw new NewsError("TRANSLATION_INCOMPLETE");
  }
  return { translations, categoryIds: [...new Set(input.categoryIds)] };
}
