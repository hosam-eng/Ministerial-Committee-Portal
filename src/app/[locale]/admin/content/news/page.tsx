import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import { listEditorialNews } from "@/modules/publishing";
import type { Locale } from "@/i18n/routing";

export default async function NewsListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.NEWS_READ);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;
  const [news, t] = await Promise.all([
    listEditorialNews(gate.user.id),
    getTranslations({ locale, namespace: "news" }),
  ]);
  return (
    <section className="news-workspace">
      <div className="news-heading">
        <div>
          <p className="news-eyebrow">{t("section")}</p>
          <h1>{t("title")}</h1>
          <p>{t("listIntro")}</p>
        </div>
        {gate.permissions.has(PERMISSIONS.NEWS_CREATE) && (
          <a
            className="news-button news-primary"
            href={`/${locale}/admin/content/news/new`}
          >
            {t("create")}
          </a>
        )}
      </div>
      {news.length ? (
        <div className="news-list" role="list">
          {news.map((item) => {
            const editorial = item.activeRevision;
            const live = item.liveRevision;
            const updated = editorial?.updatedAt ?? item.updatedAt;
            const localized = (
              editorial ??
              live ??
              item.revisions[0]
            )?.translations.find((row) => row.locale === locale);
            return (
              <article className="news-list-row" role="listitem" key={item.id}>
                <div className="news-list-main">
                  <h2>
                    <a href={`/${locale}/admin/content/news/${item.id}`}>
                      {localized?.title || t("untitled")}
                    </a>
                  </h2>
                  <p>
                    {t("updated")}:{" "}
                    <time dateTime={updated.toISOString()}>
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(updated)}
                    </time>
                  </p>
                </div>
                <div className="news-list-status">
                  <span>
                    {t("publicationLabel")}:{" "}
                    <strong>
                      {t(`publication.${item.publicationStatus}`)}
                    </strong>
                  </span>
                  <span>
                    {t("editorialLabel")}:{" "}
                    <strong>
                      {editorial
                        ? t(`workflow.${editorial.workflowStatus}`)
                        : t("noActive")}
                    </strong>
                  </span>
                  {item.publishedAt && (
                    <span>
                      {t("publishedAt")}:{" "}
                      <time dateTime={item.publishedAt.toISOString()}>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(item.publishedAt)}
                      </time>
                    </span>
                  )}
                </div>
                <a
                  className="news-open"
                  href={`/${locale}/admin/content/news/${item.id}`}
                >
                  {t("open")}
                </a>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="news-empty">{t("empty")}</p>
      )}
    </section>
  );
}
