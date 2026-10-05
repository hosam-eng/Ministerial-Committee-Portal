import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import {
  formatCalendarDateInput,
  getEditorialNews,
  listNewsCategoryOptions,
  newsBodyText,
  NewsEditor,
} from "@/modules/publishing";
import { AdminPageHeader } from "@/shared/ui/admin-page-header";
import {
  AdminEventItem,
  AdminEventList,
  AdminHistory,
  AdminHistorySubsection,
  AdminRevisionItem,
  AdminRevisionList,
} from "@/shared/ui/admin-history";
import { AdminWorkflowStack } from "@/shared/ui/admin-workflow-stack";

import {
  newsWorkflowAction,
  saveNewsAction,
  submitNewsAction,
} from "../actions";

function stringMessages(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export default async function NewsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.NEWS_READ);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  const [news, t, query, categoryOptions] = await Promise.all([
    getEditorialNews(gate.user.id, id),
    getTranslations({ locale, namespace: "news" }),
    searchParams,
    listNewsCategoryOptions(gate.user.id),
  ]);
  if (!news) notFound();
  const editorial = news.activeRevision;
  const live = news.liveRevision;
  const title =
    (editorial ?? live ?? news.revisions[0])?.translations.find(
      (row) => row.locale === locale,
    )?.title || t("untitled");
  const permissions = gate.permissions;
  const canEdit = permissions.has(PERMISSIONS.NEWS_EDIT);
  const canReview = permissions.has(PERMISSIONS.NEWS_REVIEW);
  const canPublish = permissions.has(PERMISSIONS.NEWS_PUBLISH);
  const openEditorialCycle =
    editorial?.workflowStatus === "EDITING" ||
    editorial?.workflowStatus === "PENDING_REVIEW";
  const canRestoreRevision = (workflowStatus: string) =>
    (workflowStatus === "APPROVED" || workflowStatus === "RETURNED") &&
    !openEditorialCycle;
  const currentPath = `/${locale}/admin/content/news`;
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  const error =
    query.error && t.has(`errors.${query.error}`)
      ? t(`errors.${query.error}`)
      : query.error
        ? t("errors.generic")
        : null;
  const status =
    query.status && t.has(`results.${query.status}`)
      ? t(`results.${query.status}`)
      : null;
  return (
    <article className="admin-editor-page">
      <a className="admin-editor-back" href={currentPath}>
        {t("back")}
      </a>
      <AdminPageHeader
        eyebrow={t("section")}
        title={title}
        description={t("detailIntro")}
      />
      {error && (
        <p role="alert" className="news-alert">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="news-success">
          {status}
        </p>
      )}
      <section className="admin-status-grid" aria-label={t("statusTitle")}>
        <div className="admin-status-item">
          <p className="admin-status-label">{t("publicationLabel")}</p>
          <span className="ui-badge ui-badge-brand">
            {t(`publication.${news.publicationStatus}`)}
          </span>
        </div>
        <div className="admin-status-item">
          <p className="admin-status-label">{t("editorialLabel")}</p>
          <span className="ui-badge ui-badge-neutral">
            {editorial
              ? t(`workflow.${editorial.workflowStatus}`)
              : t("noActive")}
          </span>
        </div>
        <div className="admin-status-item">
          <p className="admin-status-label">{t("liveRevision")}</p>
          <strong>
            {live
              ? t("revisionNumber", { number: live.revisionNumber })
              : t("notLive")}
          </strong>
        </div>
        <div className="admin-status-item">
          <p className="admin-status-label">{t("editorialRevision")}</p>
          <strong>
            {editorial
              ? t("revisionNumber", { number: editorial.revisionNumber })
              : t("noActive")}
          </strong>
        </div>
      </section>
      {live && editorial && <p className="news-notice">{t("liveUnchanged")}</p>}
      {editorial && (
        <div className="news-actions">
          <a
            className="ui-button ui-button-secondary"
            href={`/ar/admin/preview/news/${editorial.id}`}
          >
            {t("previewAr")}
          </a>
          <a
            className="ui-button ui-button-secondary"
            href={`/en/admin/preview/news/${editorial.id}`}
          >
            {t("previewEn")}
          </a>
        </div>
      )}
      <AdminWorkflowStack>
        {editorial?.workflowStatus === "EDITING" && canEdit ? (
          <NewsEditor
            key={editorial.id}
            locale={locale}
            newsId={id}
            revision={{
              editVersion: editorial.editVersion,
              categoryIds: editorial.categories.map((row) => row.categoryId),
              displayDate: editorial.displayDate
                ? formatCalendarDateInput(editorial.displayDate)
                : "",
              translations: Object.fromEntries(
                editorial.translations.map((row) => [
                  row.locale,
                  {
                    title: row.title,
                    summary: row.summary ?? "",
                    slug: row.slug,
                    body: newsBodyText(row.body),
                    seoTitle: row.seoTitle ?? "",
                    seoDescription: row.seoDescription ?? "",
                  },
                ]),
              ),
            }}
            messages={{
              editorTitle: t("editorTitle"),
              editorIntro: t("editorIntro"),
              saved: t("saved"),
              saving: t("saving"),
              save: t("save"),
              unsaved: t("unsaved"),
              submit: t("actions.submit"),
              sections: {
                content: t("editorSections.content"),
                metadata: t("editorSections.metadata"),
                categories: t("editorSections.categories"),
              },
              categories: {
                hint: t("categories.hint"),
                inactiveAssigned: t("categories.inactiveAssigned"),
                noneAvailable: t("categories.noneAvailable"),
              },
              languages: { ar: t("languages.ar"), en: t("languages.en") },
              fields: {
                displayDate: t("fields.displayDate"),
                title: t("fields.title"),
                summary: t("fields.summary"),
                body: t("fields.body"),
                bodyHint: t("fields.bodyHint"),
                slug: t("fields.slug"),
                seoTitle: t("fields.seoTitle"),
                seoDescription: t("fields.seoDescription"),
              },
              errors: {
                ...stringMessages(t.raw("errors")),
                generic: t("errors.generic"),
              },
            }}
            categoryOptions={categoryOptions}
            saveAction={saveNewsAction}
            submitAction={submitNewsAction}
          />
        ) : null}
        {editorial?.workflowStatus === "EDITING" && !canEdit && (
          <p className="news-muted">{t("readOnly")}</p>
        )}
        {editorial?.workflowStatus === "PENDING_REVIEW" && (
          <section className="admin-workflow-panel">
            <h2>{t("reviewTitle")}</h2>
            {canReview && editorial.submittedById === gate.user.id && (
              <p className="news-notice">{t("selfApproval")}</p>
            )}
            {canReview && (
              <div className="ui-action-group">
                {editorial.submittedById !== gate.user.id && (
                  <form action={newsWorkflowAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="newsId" value={id} />
                    <button
                      className="ui-button ui-button-primary"
                      name="operation"
                      value="approve"
                    >
                      {t("actions.approve")}
                    </button>
                  </form>
                )}
                <form action={newsWorkflowAction} className="news-inline-form">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="newsId" value={id} />
                  <div className="admin-inline-field">
                    <label htmlFor="return-comment">
                      {t("fields.returnComment")}
                    </label>
                    <textarea
                      id="return-comment"
                      className="ui-input"
                      name="comment"
                      rows={2}
                      required
                    />
                  </div>
                  <button
                    className="ui-button ui-button-secondary"
                    name="operation"
                    value="return"
                  >
                    {t("actions.return")}
                  </button>
                </form>
              </div>
            )}
          </section>
        )}
        {editorial?.workflowStatus === "APPROVED" && (
          <section className="admin-workflow-panel">
            <h2>
              {news.publicationStatus === "PUBLISHED"
                ? t("approvedPendingTitle")
                : t("approvedTitle")}
            </h2>
            <p>{t(`approvedState.${news.publicationStatus}`)}</p>
            {canPublish && (
              <form action={newsWorkflowAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="newsId" value={id} />
                <button
                  className="ui-button ui-button-primary"
                  name="operation"
                  value="publish"
                >
                  {t("actions.publish")}
                </button>
              </form>
            )}
            {canEdit && (
              <form action={newsWorkflowAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="newsId" value={id} />
                <p>{t("restoreIntro")}</p>
                <button
                  className="ui-button ui-button-secondary"
                  name="operation"
                  value="restore"
                >
                  {t("actions.restore")}
                </button>
              </form>
            )}
          </section>
        )}
        {!editorial && canEdit && news.revisions.length > 0 && (
          <section className="admin-workflow-panel">
            <h2>{t("editPublishedTitle")}</h2>
            <p>{t("editPublishedIntro")}</p>
            <form action={newsWorkflowAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="newsId" value={id} />
              <button
                className="ui-button ui-button-secondary"
                name="operation"
                value="edit"
              >
                {t("actions.edit")}
              </button>
            </form>
          </section>
        )}
        {news.publicationStatus === "UNPUBLISHED" &&
          !editorial &&
          canPublish &&
          news.publicationEvents.some((event) => event.action === "PUBLISH") && (
            <section className="admin-workflow-panel">
              <h2>{t("republishTitle")}</h2>
              <p>{t("republishIntro")}</p>
              <form action={newsWorkflowAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="newsId" value={id} />
                <button
                  className="ui-button ui-button-primary"
                  name="operation"
                  value="republish"
                >
                  {t("actions.republish")}
                </button>
              </form>
            </section>
          )}
        {news.publicationStatus === "PUBLISHED" && canPublish && (
          <section className="admin-workflow-panel">
            <h2>{t("unpublishTitle")}</h2>
            <form action={newsWorkflowAction} className="news-inline-form">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="newsId" value={id} />
              <div className="admin-inline-field">
                <label htmlFor="unpublish-reason">
                  {t("fields.unpublishReason")}
                </label>
                <textarea
                  id="unpublish-reason"
                  className="ui-input"
                  name="reason"
                  rows={2}
                  required
                />
              </div>
              <button
                className="ui-button ui-button-danger"
                name="operation"
                value="unpublish"
              >
                {t("actions.unpublish")}
              </button>
            </form>
          </section>
        )}
      </AdminWorkflowStack>
      <AdminHistory title={t("history.title")}>
        <AdminHistorySubsection title={t("history.revisions")}>
          <p className="news-hint">{t("history.restoreHint")}</p>
          <AdminRevisionList>
            {news.revisions.map((revision) => (
              <AdminRevisionItem
                key={revision.id}
                revisionLabel={t("revisionNumber", {
                  number: revision.revisionNumber,
                })}
                statusBadge={
                  <span className="ui-badge ui-badge-neutral">
                    {t(`workflow.${revision.workflowStatus}`)}
                  </span>
                }
                liveBadge={
                  revision.id === news.liveRevisionId ? (
                    <span className="ui-badge ui-badge-brand">
                      {t("liveRevision")}
                    </span>
                  ) : undefined
                }
                dateTime={revision.createdAt.toISOString()}
                dateLabel={date(revision.createdAt)}
                actions={
                  <>
                    {canEdit && canRestoreRevision(revision.workflowStatus) ? (
                      <form action={newsWorkflowAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="newsId" value={id} />
                        <input type="hidden" name="operation" value="restore" />
                        <input
                          type="hidden"
                          name="revisionId"
                          value={revision.id}
                        />
                        <button
                          className="ui-button ui-button-secondary ui-button-compact"
                          type="submit"
                        >
                          {t("actions.restore")}
                        </button>
                      </form>
                    ) : null}
                    <a
                      className="ui-button ui-button-secondary ui-button-compact"
                      href={`/ar/admin/preview/news/${revision.id}`}
                    >
                      {t("previewAr")}
                    </a>
                    <a
                      className="ui-button ui-button-secondary ui-button-compact"
                      href={`/en/admin/preview/news/${revision.id}`}
                    >
                      {t("previewEn")}
                    </a>
                  </>
                }
              />
            ))}
          </AdminRevisionList>
        </AdminHistorySubsection>
        <AdminHistorySubsection title={t("history.workflow")}>
          {news.workflowEvents.length ? (
            <AdminEventList>
              {news.workflowEvents.map((event) => (
                <AdminEventItem
                  key={event.id}
                  title={t(`events.${event.action}`)}
                  dateTime={event.createdAt.toISOString()}
                  dateLabel={date(event.createdAt)}
                  detail={event.comment ? <p>{event.comment}</p> : undefined}
                />
              ))}
            </AdminEventList>
          ) : (
            <p className="admin-history-empty">{t("history.none")}</p>
          )}
        </AdminHistorySubsection>
        <AdminHistorySubsection title={t("history.publication")}>
          {news.publicationEvents.length ? (
            <AdminEventList>
              {news.publicationEvents.map((event) => (
                <AdminEventItem
                  key={event.id}
                  title={t(`events.${event.action}`)}
                  dateTime={event.createdAt.toISOString()}
                  dateLabel={date(event.createdAt)}
                  detail={event.reason ? <p>{event.reason}</p> : undefined}
                />
              ))}
            </AdminEventList>
          ) : (
            <p className="admin-history-empty">{t("history.none")}</p>
          )}
        </AdminHistorySubsection>
      </AdminHistory>
    </article>
  );
}
