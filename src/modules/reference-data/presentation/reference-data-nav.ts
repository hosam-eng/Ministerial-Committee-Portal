import type { ReferenceDataSection } from "../domain/taxonomy-kind";

export type ReferenceDataNavItem = {
  section: ReferenceDataSection;
  slug: string;
  permission: string;
};

/** Slugs used in admin routes — one navigation model for all reference data. */
export const REFERENCE_DATA_NAV: readonly ReferenceDataNavItem[] = [
  {
    section: "newsCategory",
    slug: "news-categories",
    permission: "publishing.news_categories.manage",
  },
  {
    section: "eventCategory",
    slug: "event-categories",
    permission: "reference_data.taxonomies.manage",
  },
  {
    section: "awarenessTopic",
    slug: "awareness-topics",
    permission: "reference_data.taxonomies.manage",
  },
  {
    section: "targetAudience",
    slug: "target-audiences",
    permission: "reference_data.taxonomies.manage",
  },
  {
    section: "publicationType",
    slug: "publication-types",
    permission: "reference_data.taxonomies.manage",
  },
  {
    section: "openDatasetCategory",
    slug: "open-dataset-categories",
    permission: "reference_data.taxonomies.manage",
  },
  {
    section: "organization",
    slug: "organizations",
    permission: "reference_data.organizations.manage",
  },
  {
    section: "geographicArea",
    slug: "geographic-areas",
    permission: "reference_data.geographic_areas.manage",
  },
] as const;

export function referenceDataSlug(section: ReferenceDataSection): string {
  const item = REFERENCE_DATA_NAV.find((entry) => entry.section === section);
  if (!item) throw new Error(`Unknown reference data section: ${section}`);
  return item.slug;
}

export function referenceDataSectionFromSlug(
  slug: string,
): ReferenceDataSection | null {
  return (
    REFERENCE_DATA_NAV.find((entry) => entry.slug === slug)?.section ?? null
  );
}
