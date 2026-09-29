import { ManagedPageError } from "./errors";

const RESERVED = new Set(["pages"]);

export function normalizeSlug(value: string): string {
  const slug = value.trim().toLowerCase().replace(/\s+/gu, "-");
  if (
    !slug ||
    slug.length > 120 ||
    RESERVED.has(slug) ||
    !/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug)
  ) {
    throw new ManagedPageError("INVALID_SLUG");
  }
  return slug;
}
