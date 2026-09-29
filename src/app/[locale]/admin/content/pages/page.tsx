import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import { listEditorialManagedPages } from "@/modules/managed-pages";
import { AdminPageHeader } from "@/shared/ui/admin-page-header";

export default async function ManagedPagesListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.MANAGED_PAGES_READ);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;
  const [pages, t, tCommon] = await Promise.all([
    listEditorialManagedPages(gate.user.id, locale === "en" ? "en" : "ar"),
    getTranslations({ locale, namespace: "managedPages" }),
    getTranslations({ locale, namespace: "news" }),
  ]);
  const openLabel = tCommon("open");
  return (
    <section className="admin-pages-list">
      <AdminPageHeader
        eyebrow={t("section")}
        title={t("title")}
        description={t("listIntro")}
        action={
          gate.permissions.has(PERMISSIONS.MANAGED_PAGES_CREATE) ? (
            <a
              className="ui-button ui-button-primary"
              href={`/${locale}/admin/content/pages/new`}
            >
              {t("create")}
            </a>
          ) : undefined
        }
      />
      {pages.length ? (
        <div className="admin-data-table" role="list">
          <div className="admin-data-table-head" aria-hidden="true">
            <span>{t("fields.title")}</span>
            <span>{t("editorialLabel")}</span>
            <span>{t("publicationLabel")}</span>
            <span>{t("updated")}</span>
            <span>{openLabel}</span>
          </div>
          {pages.map((item) => (
            <article className="admin-data-row" role="listitem" key={item.id}>
              <div className="admin-data-title">
                <h2>
                  <a href={`/${locale}/admin/content/pages/${item.id}`}>
                    {item.title || t("untitled")}
                  </a>
                </h2>
              </div>
              <div className="admin-data-cell">
                <span className="ui-badge ui-badge-neutral">
                  {item.workflowStatus
                    ? t(`workflow.${item.workflowStatus}`)
                    : t("noActive")}
                </span>
              </div>
              <div className="admin-data-cell">
                <span className="ui-badge ui-badge-brand">
                  {t(`publication.${item.publicationStatus}`)}
                </span>
              </div>
              <div className="admin-data-cell admin-data-meta">
                <time dateTime={item.updatedAt.toISOString()}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(item.updatedAt)}
                </time>
              </div>
              <div className="admin-data-cell">
                <a
                  className="ui-button ui-button-secondary ui-button-compact"
                  href={`/${locale}/admin/content/pages/${item.id}`}
                >
                  {openLabel}
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="news-empty ui-surface">{t("empty")}</p>
      )}
    </section>
  );
}
