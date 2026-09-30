/** Domain-specific taxonomy kinds — not a generic lookup catalog. */
export const TAXONOMY_KINDS = [
  "eventCategory",
  "awarenessTopic",
  "targetAudience",
  "publicationType",
  "openDatasetCategory",
] as const;

export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

export function isTaxonomyKind(value: string): value is TaxonomyKind {
  return (TAXONOMY_KINDS as readonly string[]).includes(value);
}

export type ReferenceDataSection =
  TaxonomyKind | "newsCategory" | "organization" | "geographicArea";

export const REFERENCE_DATA_SECTIONS: readonly ReferenceDataSection[] = [
  "newsCategory",
  ...TAXONOMY_KINDS,
  "organization",
  "geographicArea",
];

export function isReferenceDataSection(
  value: string,
): value is ReferenceDataSection {
  return (REFERENCE_DATA_SECTIONS as readonly string[]).includes(value);
}
