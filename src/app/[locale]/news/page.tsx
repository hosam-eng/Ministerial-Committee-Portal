import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import {
  calendarDateTimeAttribute,
  formatPublicCalendarDate,
  listPublishedNews,
} from "@/modules/publishing";
import { PublicShell } from "@/shared/ui/public-shell";

import { resolvePublicChrome } from "../public-chrome";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "publicNews" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/news`,
      languages: { ar: "/ar/news", en: "/en/news" },
    },
  };
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [items, t] = await Promise.all([
    listPublishedNews(locale),
    getTranslations({ locale }),
  ]);
  const otherLocale = routing.locales.find(
    (candidate) => candidate !== locale,
  ) as Locale;
  const chrome = await resolvePublicChrome(t, locale, {
    switchHref: `/${otherLocale}/news`,
    currentPath: `/${locale}/news`,
  });

  return (
    <PublicShell locale={locale} {...chrome}>
      <section
        className="public-news public-news-listing"
        aria-labelledby="public-news-title"
      >
        <header className="public-news-header">
          <h1 id="public-news-title">{t("publicNews.title")}</h1>
          <p>{t("publicNews.description")}</p>
        </header>
        {items.length ? (
          <ol className="public-news-list">
            {items.map((item) => (
              <li key={item.newsId}>
                <article className="public-news-entry">
                  <p className="public-news-date">
                    {t("publicNews.publishedOn")}:{" "}
                    <time
                      dateTime={calendarDateTimeAttribute(item.displayDate)}
                    >
                      {formatPublicCalendarDate(item.displayDate, locale)}
                    </time>
                  </p>
                  <h2>
                    <a
                      href={`/${locale}/news/${encodeURIComponent(item.slug)}`}
                    >
                      {item.title}
                    </a>
                  </h2>
                  <p>{item.summary}</p>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <p className="public-news-empty">{t("publicNews.empty")}</p>
        )}
      </section>
    </PublicShell>
  );
}
