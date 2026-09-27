import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import { getEditorialNews, NewsEditor } from "@/modules/publishing";

import { newsWorkflowAction, saveNewsAction } from "../actions";

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
  const [news, t, query] = await Promise.all([
    getEditorialNews(gate.user.id, id),
    getTranslations({ locale, namespace: "news" }),
    searchParams,
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
    <article className="news-workspace">
      <a href={currentPath}>{t("back")}</a>
      <div className="news-heading">
        <div>
          <p className="news-eyebrow">{t("section")}</p>
          <h1>{title}</h1>
          <p>{t("detailIntro")}</p>
        </div>
      </div>
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
      <section className="news-summary" aria-label={t("statusTitle")}>
        <div>
          <span>{t("publicationLabel")}</span>
          <strong>{t(`publication.${news.publicationStatus}`)}</strong>
        </div>
        <div>
          <span>{t("editorialLabel")}</span>
          <strong>
            {editorial
              ? t(`workflow.${editorial.workflowStatus}`)
              : t("noActive")}
          </strong>
        </div>
        <div>
          <span>{t("liveRevision")}</span>
          <strong>
            {live
              ? t("revisionNumber", { number: live.revisionNumber })
              : t("notLive")}
          </strong>
        </div>
        <div>
          <span>{t("editorialRevision")}</span>
          <strong>
            {editorial
              ? t("revisionNumber", { number: editorial.revisionNumber })
              : t("noActive")}
          </strong>
        </div>
      </section>
      {live && editorial && <p className="news-notice">{t("liveUnchanged")}</p>}
      {editorial?.workflowStatus === "EDITING" && canEdit ? (
        <NewsEditor
          key={editorial.id}
          locale={locale}
          newsId={id}
          revision={{
            editVersion: editorial.editVersion,
            categoryIds: editorial.categories.map((row) => row.categoryId),
            translations: Object.fromEntries(
              editorial.translations.map((row) => [
                row.locale,
                {
                  title: row.title,
                  summary: row.summary ?? "",
                  slug: row.slug,
                  body:
                    row.body == null ? "" : JSON.stringify(row.body, null, 2),
                  seoTitle: row.seoTitle ?? "",
                  seoDescription: row.seoDescription ?? "",
                },
              ]),
            ),
          }}
          saveAction={saveNewsAction}
          workflowAction={newsWorkflowAction}
        />
      ) : null}
      {editorial?.workflowStatus === "EDITING" && !canEdit && (
        <p className="news-muted">{t("readOnly")}</p>
      )}
      {editorial?.workflowStatus === "PENDING_REVIEW" && (
        <section className="news-step">
          <h2>{t("reviewTitle")}</h2>
          {canReview && editorial.submittedById === gate.user.id && (
            <p className="news-notice">{t("selfApproval")}</p>
          )}
          {canReview && (
            <div className="news-actions">
              {editorial.submittedById !== gate.user.id && (
                <form action={newsWorkflowAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="newsId" value={id} />
                  <button
                    className="news-button news-primary"
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
                <label htmlFor="return-comment">
                  {t("fields.returnComment")}
                </label>
                <textarea
                  id="return-comment"
                  name="comment"
                  rows={2}
                  required
                />
                <button className="news-button" name="operation" value="return">
                  {t("actions.return")}
                </button>
              </form>
            </div>
          )}
        </section>
      )}
      {editorial?.workflowStatus === "APPROVED" && (
        <section className="news-step">
          <h2>{t("approvedTitle")}</h2>
          <p>{t("approvedNotPublished")}</p>
          {canPublish && (
            <form action={newsWorkflowAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="newsId" value={id} />
              <button
                className="news-button news-primary"
                name="operation"
                value="publish"
              >
                {t("actions.publish")}
              </button>
            </form>
          )}
        </section>
      )}
      {!editorial && canEdit && news.revisions.length > 0 && (
        <section className="news-step">
          <h2>{t("editPublishedTitle")}</h2>
          <p>{t("editPublishedIntro")}</p>
          <form action={newsWorkflowAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="newsId" value={id} />
            <button className="news-button" name="operation" value="edit">
              {t("actions.edit")}
            </button>
          </form>
        </section>
      )}
      {news.publicationStatus === "PUBLISHED" && canPublish && (
        <section className="news-step">
          <h2>{t("unpublishTitle")}</h2>
          <form action={newsWorkflowAction} className="news-inline-form">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="newsId" value={id} />
            <label htmlFor="unpublish-reason">
              {t("fields.unpublishReason")}
            </label>
            <textarea id="unpublish-reason" name="reason" rows={2} required />
            <button
              className="news-button news-danger"
              name="operation"
              value="unpublish"
            >
              {t("actions.unpublish")}
            </button>
          </form>
        </section>
      )}
      <section className="news-history">
        <h2>{t("history.title")}</h2>
        <h3>{t("history.revisions")}</h3>
        <ol>
          {news.revisions.map((revision) => (
            <li key={revision.id}>
              <strong>
                {t("revisionNumber", { number: revision.revisionNumber })}
              </strong>{" "}
              — {t(`workflow.${revision.workflowStatus}`)} ·{" "}
              <time dateTime={revision.createdAt.toISOString()}>
                {date(revision.createdAt)}
              </time>
              {revision.id === news.liveRevisionId && ` · ${t("liveRevision")}`}
            </li>
          ))}
        </ol>
        <h3>{t("history.workflow")}</h3>
        {news.workflowEvents.length ? (
          <ol>
            {news.workflowEvents.map((event) => (
              <li key={event.id}>
                {t(`events.${event.action}`)} ·{" "}
                <time dateTime={event.createdAt.toISOString()}>
                  {date(event.createdAt)}
                </time>
                {event.comment && <p>{event.comment}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p>{t("history.none")}</p>
        )}
        <h3>{t("history.publication")}</h3>
        {news.publicationEvents.length ? (
          <ol>
            {news.publicationEvents.map((event) => (
              <li key={event.id}>
                {t(`events.${event.action}`)} ·{" "}
                <time dateTime={event.createdAt.toISOString()}>
                  {date(event.createdAt)}
                </time>
                {event.reason && <p>{event.reason}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p>{t("history.none")}</p>
        )}
      </section>
    </article>
  );
}
