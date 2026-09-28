import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import { listPublishedNews } from "@/modules/publishing";
import { PublicShell } from "@/shared/ui/public-shell";

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
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    dateStyle: "long",
    timeZone: "Asia/Riyadh",
  });

  return (
    <PublicShell
      locale={locale}
      identity={t("app.name")}
      switchTo={{
        href: `/${otherLocale}/news`,
        lang: otherLocale,
        label: t("shell.language"),
        ariaLabel: t("shell.languageSwitch"),
      }}
      skipLabel={t("shell.skipToContent")}
      footerText={t("shell.copyright", { year: new Date().getFullYear() })}
    >
      <section className="public-news" aria-labelledby="public-news-title">
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
                    <time dateTime={item.publishedAt.toISOString()}>
                      {date.format(item.publishedAt)}
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
