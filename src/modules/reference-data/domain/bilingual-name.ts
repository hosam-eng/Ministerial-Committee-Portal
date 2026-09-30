import { ReferenceDataError } from "./errors";

export type BilingualNameInput = {
  nameAr: string;
  nameEn: string;
};

export type BilingualName = {
  nameAr: string;
  nameEn: string;
};

/** Trim and collapse internal whitespace for stable comparisons. */
export function normalizeReferenceName(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeComparableName(value: string): string {
  return normalizeReferenceName(value).toLocaleLowerCase("en-US");
}

export function parseBilingualName(input: BilingualNameInput): BilingualName {
  const nameAr = normalizeReferenceName(input.nameAr);
  const nameEn = normalizeReferenceName(input.nameEn);
  if (!nameAr || !nameEn) throw new ReferenceDataError("REQUIRED_FIELD");
  return { nameAr, nameEn };
}

export function namesEquivalent(a: string, b: string): boolean {
  return normalizeComparableName(a) === normalizeComparableName(b);
}
