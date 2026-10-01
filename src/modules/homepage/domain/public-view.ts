/** Public homepage view model (locale-resolved, no persistence details). */

export type PublicHomepageHero = {
  title: string;
  supportingText: string;
  cta: { label: string; href: string; external?: boolean } | null;
};

export type PublicHomepageNewsItem = {
  newsId: string;
  title: string;
  summary: string;
  slug: string;
  publishedAt: Date;
  href: string;
};

export type PublicHomepageNews = {
  heading: string;
  items: PublicHomepageNewsItem[];
  viewAllHref: string;
};

export type PublicHomepageSection =
  | { type: "hero"; hero: PublicHomepageHero }
  | { type: "news"; news: PublicHomepageNews };

export type PublicHomepage = {
  sections: PublicHomepageSection[];
};
