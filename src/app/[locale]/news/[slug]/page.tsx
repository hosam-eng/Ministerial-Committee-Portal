import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import { resolvePublishedNewsBySlug } from "@/modules/publishing";
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
  const otherLocale = locale === "ar" ? "en" : "ar";
  const current = `/${locale}/news/${encodeURIComponent(news.slug)}`;
  const languages: Record<string, string> = { [locale]: current };
  if (news.counterpartSlug)
    languages[otherLocale] =
      `/${otherLocale}/news/${encodeURIComponent(news.counterpartSlug)}`;
  return {
    title: news.seoTitle?.trim() || news.title,
    description: news.seoDescription?.trim() || news.summary,
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
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    dateStyle: "long",
    timeZone: "Asia/Riyadh",
  });
  return (
    <PublicShell
      locale={locale}
      identity={t("app.name")}
      switchTo={
        news.counterpartSlug
          ? {
              href: `/${otherLocale}/news/${encodeURIComponent(news.counterpartSlug)}`,
              lang: otherLocale,
              label: t("shell.language"),
              ariaLabel: t("shell.languageSwitch"),
            }
          : null
      }
      skipLabel={t("shell.skipToContent")}
      footerText={t("shell.copyright", { year: new Date().getFullYear() })}
    >
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
              <time dateTime={news.publishedAt.toISOString()}>
                {date.format(news.publishedAt)}
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
