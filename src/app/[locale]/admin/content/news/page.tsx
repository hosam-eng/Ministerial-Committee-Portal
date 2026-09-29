import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import { listEditorialNews } from "@/modules/publishing";
import { AdminPageHeader } from "@/shared/ui/admin-page-header";
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
    <section className="admin-news-list">
      <AdminPageHeader
        eyebrow={t("section")}
        title={t("title")}
        description={t("listIntro")}
        action={
          gate.permissions.has(PERMISSIONS.NEWS_CREATE) ? (
            <a
              className="ui-button ui-button-primary"
              href={`/${locale}/admin/content/news/new`}
            >
              {t("create")}
            </a>
          ) : undefined
        }
      />
      {news.length ? (
        <div className="admin-data-table" role="list">
          <div className="admin-data-table-head" aria-hidden="true">
            <span>{t("fields.title")}</span>
            <span>{t("editorialLabel")}</span>
            <span>{t("publicationLabel")}</span>
            <span>{t("updated")}</span>
            <span>{t("open")}</span>
          </div>
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
              <article className="admin-data-row" role="listitem" key={item.id}>
                <div className="admin-data-title">
                  <h2>
                    <a href={`/${locale}/admin/content/news/${item.id}`}>
                      {localized?.title || t("untitled")}
                    </a>
                  </h2>
                </div>
                <div className="admin-data-cell">
                  <span className="ui-badge ui-badge-neutral">
                    {editorial
                      ? t(`workflow.${editorial.workflowStatus}`)
                      : t("noActive")}
                  </span>
                </div>
                <div className="admin-data-cell">
                  <span className="ui-badge ui-badge-brand">
                    {t(`publication.${item.publicationStatus}`)}
                  </span>
                </div>
                <div className="admin-data-cell admin-data-meta">
                  <time dateTime={updated.toISOString()}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(updated)}
                  </time>
                </div>
                <div className="admin-data-cell">
                  <a
                    className="ui-button ui-button-secondary ui-button-compact"
                    href={`/${locale}/admin/content/news/${item.id}`}
                  >
                    {t("open")}
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="news-empty ui-surface">{t("empty")}</p>
      )}
    </section>
  );
}
