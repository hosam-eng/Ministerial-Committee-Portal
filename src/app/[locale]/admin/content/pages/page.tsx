import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import { listEditorialManagedPages } from "@/modules/managed-pages";

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
  const [pages, t] = await Promise.all([
    listEditorialManagedPages(gate.user.id, locale === "en" ? "en" : "ar"),
    getTranslations({ locale, namespace: "managedPages" }),
  ]);
  return (
    <section className="news-workspace">
      <div className="news-heading">
        <div>
          <p className="news-eyebrow">{t("section")}</p>
          <h1>{t("title")}</h1>
          <p>{t("listIntro")}</p>
        </div>
        {gate.permissions.has(PERMISSIONS.MANAGED_PAGES_CREATE) && (
          <a
            className="news-button news-primary"
            href={`/${locale}/admin/content/pages/new`}
          >
            {t("create")}
          </a>
        )}
      </div>
      {pages.length ? (
        <div className="news-list" role="list">
          {pages.map((item) => (
            <article className="news-list-row" role="listitem" key={item.id}>
              <div className="news-list-main">
                <h2>
                  <a href={`/${locale}/admin/content/pages/${item.id}`}>
                    {item.title || t("untitled")}
                  </a>
                </h2>
                <p>
                  {t("updated")}:{" "}
                  <time dateTime={item.updatedAt.toISOString()}>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(item.updatedAt)}
                  </time>
                </p>
              </div>
              <div className="news-list-status">
                <span>
                  {t("publicationLabel")}:{" "}
                  <strong>{t(`publication.${item.publicationStatus}`)}</strong>
                </span>
                <span>
                  {t("editorialLabel")}:{" "}
                  <strong>
                    {item.workflowStatus
                      ? t(`workflow.${item.workflowStatus}`)
                      : t("noActive")}
                  </strong>
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="news-empty">{t("empty")}</p>
      )}
    </section>
  );
}
