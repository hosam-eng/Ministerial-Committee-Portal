export const HOMEPAGE_SECTION_TYPES = ["HERO", "NEWS"] as const;

export type HomepageSectionType = (typeof HOMEPAGE_SECTION_TYPES)[number];

export const HOMEPAGE_NEWS_MODES = ["AUTOMATIC", "MANUAL"] as const;

export type HomepageNewsMode = (typeof HOMEPAGE_NEWS_MODES)[number];

export const HOMEPAGE_CTA_TARGET_TYPES = [
  "SYSTEM_ROUTE",
  "CONTENT_ROUTE",
  "EXTERNAL_LINK",
] as const;

export type HomepageCtaTargetType = (typeof HOMEPAGE_CTA_TARGET_TYPES)[number];

export const HOMEPAGE_CONTENT_TARGET_KINDS = ["MANAGED_PAGE"] as const;

export type HomepageContentTargetKind =
  (typeof HOMEPAGE_CONTENT_TARGET_KINDS)[number];

export const MAX_MANUAL_NEWS_ITEMS = 3;
