import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import {
  calendarDateTimeAttribute,
  formatPublicCalendarDate,
  resolvePublishedNewsBySlug,
} from "@/modules/publishing";
import {
  composePublicSeoDescription,
  composePublicSeoTitle,
  resolveLiveDefaultSeo,
} from "@/modules/site-settings";
import { resolvePublicChrome } from "../../public-chrome";
import { PublicShell } from "@/shared/ui/public-shell";

export const dynamic = "force-dynamic";

type DetailParams = { params: Promise<{ locale: Locale; slug: string }> };

function decodeSlugParam(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    notFound();
  }
}

export async function generateMetadata({
  params,
}: DetailParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolved = await resolvePublishedNewsBySlug(
    locale,
    decodeSlugParam(slug),
  );
  if (resolved?.kind !== "news") return { robots: { index: false } };
  const news = resolved.news;
  const liveSeo = await resolveLiveDefaultSeo(locale);
  const t = await getTranslations({ locale, namespace: "app" });
  const otherLocale = locale === "ar" ? "en" : "ar";
  const current = `/${locale}/news/${encodeURIComponent(news.slug)}`;
  const languages: Record<string, string> = { [locale]: current };
  if (news.counterpartSlug)
    languages[otherLocale] =
      `/${otherLocale}/news/${encodeURIComponent(news.counterpartSlug)}`;
  return {
    title: composePublicSeoTitle({
      explicitTitle: news.seoTitle,
      pageTitle: news.title,
      liveDefaultTitle: liveSeo?.title,
      staticFallback: t("name"),
    }),
    description: composePublicSeoDescription({
      explicitDescription: news.seoDescription,
      pageDescription: news.summary,
      liveDefaultDescription: liveSeo?.description,
    }),
    alternates: { canonical: current, languages },
  };
}

export default async function NewsDetailPage({ params }: DetailParams) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const resolved = await resolvePublishedNewsBySlug(
    locale,
    decodeSlugParam(slug),
  );
  if (!resolved) notFound();
  if (resolved.kind === "redirect")
    permanentRedirect(`/${locale}/news/${encodeURIComponent(resolved.slug)}`);

  const news = resolved.news;
  const t = await getTranslations({ locale });
  const otherLocale = routing.locales.find(
    (candidate) => candidate !== locale,
  ) as Locale;
  const chrome = await resolvePublicChrome(t, locale, {
    switchHref: news.counterpartSlug
      ? `/${otherLocale}/news/${encodeURIComponent(news.counterpartSlug)}`
      : null,
    currentPath: `/${locale}/news/${encodeURIComponent(news.slug)}`,
  });

  return (
    <PublicShell locale={locale} {...chrome}>
      <div className="public-news public-news-detail">
        <nav
          aria-label={t("publicNews.breadcrumb")}
          className="public-news-breadcrumb"
        >
          <a href={`/${locale}/news`}>{t("publicNews.title")}</a>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{news.title}</span>
        </nav>
        <article>
          <header className="public-news-header">
            <h1>{news.title}</h1>
            <p className="public-news-date">
              {t("publicNews.publishedOn")}:{" "}
              <time dateTime={calendarDateTimeAttribute(news.displayDate)}>
                {formatPublicCalendarDate(news.displayDate, locale)}
              </time>
            </p>
            <p className="public-news-summary">{news.summary}</p>
          </header>
          <p className="public-news-body">{news.bodyText}</p>
        </article>
        <a className="public-news-back" href={`/${locale}/news`}>
          {t("publicNews.back")}
        </a>
      </div>
    </PublicShell>
  );
}
