import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { listManagedPageNavigationPickerTargets } from "@/modules/managed-pages";
import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import {
  HomepageEditor,
  describeHomepageDraftCompleteness,
  getEditorialHomepage,
} from "@/modules/homepage";
import { listNewsHomepagePickerTargets } from "@/modules/publishing";
import { AdminPageHeader } from "@/shared/ui/admin-page-header";
import {
  AdminEventItem,
  AdminEventList,
  AdminHistorySubsection,
  AdminRevisionItem,
  AdminRevisionList,
} from "@/shared/ui/admin-history";

import {
  homepageWorkflowAction,
  saveHomepageAction,
  submitHomepageAction,
} from "./actions";

function stringMessages(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export default async function HomepageAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.HOMEPAGE_READ);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;

  const contentLocale = locale === "en" ? "en" : "ar";
  const homepage = await getEditorialHomepage(gate.user.id);
  const [pageTargets, newsTargets, t, query] = await Promise.all([
    listManagedPageNavigationPickerTargets(gate.user.id, contentLocale),
    listNewsHomepagePickerTargets(gate.user.id, contentLocale),
    getTranslations({ locale, namespace: "homepage" }),
    searchParams,
  ]);

  const permissions = gate.permissions;
  const canEdit = permissions.has(PERMISSIONS.HOMEPAGE_EDIT);
  const canReview = permissions.has(PERMISSIONS.HOMEPAGE_REVIEW);
  const canPublish = permissions.has(PERMISSIONS.HOMEPAGE_PUBLISH);
  const editorial = homepage.active;
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

  const previewRevision = editorial?.id ?? homepage.liveRevisionId;
  const completenessIssues = editorial
    ? describeHomepageDraftCompleteness(editorial.draft)
    : [];

  return (
    <article className="admin-editor-page">
      <AdminPageHeader
        eyebrow={t("section")}
        title={t("title")}
        description={t("intro")}
      />
      {error ? (
        <p role="alert" className="news-alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="news-success">
          {status}
        </p>
      ) : null}

      <section
        className="admin-status-grid admin-status-grid--compact"
        aria-label={t("statusTitle")}
      >
        <div className="admin-status-item">
          <p className="admin-status-label">{t("publicationLabel")}</p>
          <span className="ui-badge ui-badge-brand">
            {t(`publication.${homepage.publicationStatus}`)}
          </span>
        </div>
        <div className="admin-status-item">
          <p className="admin-status-label">{t("editorialLabel")}</p>
          {editorial ? (
            <span className="ui-badge">
              {t("revisionNumber", { number: editorial.revisionNumber })} —{" "}
              {t(`workflow.${editorial.workflowStatus}`)}
            </span>
          ) : (
            <span className="news-muted">{t("noActive")}</span>
          )}
        </div>
        <div className="admin-status-item">
          <p className="admin-status-label">{t("liveRevision")}</p>
          {homepage.liveRevisionNumber ? (
            <span className="ui-badge ui-badge-brand">
              {t("revisionNumber", { number: homepage.liveRevisionNumber })}
            </span>
          ) : (
            <span className="news-muted">{t("notLive")}</span>
          )}
        </div>
      </section>

      {homepage.liveRevisionId && editorial ? (
        <p className="news-notice">{t("liveUnchanged")}</p>
      ) : null}

      {completenessIssues.length ? (
        <div className="news-notice" role="status">
          <p>{t("completeness.intro")}</p>
          <ul>
            {completenessIssues.map((key) => (
              <li key={key}>
                {t.has(`completeness.${key}`)
                  ? t(`completeness.${key}`)
                  : t("errors.generic")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {editorial ? (
        <HomepageEditor
          key={`${editorial.id}-${editorial.editVersion}`}
          locale={locale}
          previewRevision={previewRevision}
          publicationStatus={homepage.publicationStatus}
          canEdit={canEdit}
          canReview={canReview}
          canPublish={canPublish}
          initialDraft={editorial.draft}
          editVersion={editorial.editVersion}
          workflowStatus={editorial.workflowStatus}
          pageTargets={pageTargets}
          newsTargets={newsTargets}
          saveAction={saveHomepageAction}
          submitAction={submitHomepageAction}
          workflowAction={homepageWorkflowAction}
          messages={{
            saved: t("saved"),
            saving: t("saving"),
            save: t("save"),
            submit: t("actions.submit"),
            previewTitle: t("rail.preview"),
            previewAr: t("previewAr"),
            previewEn: t("previewEn"),
            workflowTitle: t("rail.workflow"),
            sections: {
              HERO: t("sections.HERO"),
              NEWS: t("sections.NEWS"),
            },
            fields: stringMessages(t.raw("fields")),
            newsMode: stringMessages(t.raw("newsMode")),
            ui: stringMessages(t.raw("ui")),
            workflow: {
              return: t("actions.return"),
              approve: t("actions.approve"),
              publish: t("actions.publish"),
              unpublish: t("actions.unpublish"),
              edit: t("actions.editPublished"),
              returnComment: t("actions.returnComment"),
              unpublishReason: t("actions.unpublishReason"),
              unpublishSection: t("rail.unpublish"),
            },
            errors: stringMessages(t.raw("errors")),
          }}
        />
      ) : (
        <p className="news-muted">{t("noActive")}</p>
      )}

      <details className="admin-history-details">
        <summary className="admin-history-summary">
          {t("history.title")}
        </summary>
        <section className="admin-history" aria-label={t("history.title")}>
          <AdminHistorySubsection title={t("history.revisions")}>
            <AdminRevisionList>
              {homepage.revisions.map((revision) => (
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
                    revision.id === homepage.liveRevisionId ? (
                      <span className="ui-badge ui-badge-brand">
                        {t("liveRevision")}
                      </span>
                    ) : undefined
                  }
                  dateTime={revision.createdAt.toISOString()}
                  dateLabel={new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(revision.createdAt)}
                  actions={
                    canEdit ? (
                      <form action={homepageWorkflowAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="operation" value="restore" />
                        <input
                          type="hidden"
                          name="revisionId"
                          value={revision.id}
                        />
                        <button
                          className="ui-button ui-button-secondary"
                          type="submit"
                        >
                          {t("actions.restore")}
                        </button>
                      </form>
                    ) : null
                  }
                />
              ))}
            </AdminRevisionList>
          </AdminHistorySubsection>
          <AdminHistorySubsection title={t("history.workflow")}>
            <AdminEventList>
              {homepage.workflowEvents.map((event) => (
                <AdminEventItem
                  key={`${event.action}-${event.createdAt.toISOString()}`}
                  title={t(`events.${event.action}`)}
                  detail={event.comment}
                  dateTime={event.createdAt.toISOString()}
                  dateLabel={new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(event.createdAt)}
                />
              ))}
            </AdminEventList>
          </AdminHistorySubsection>
          <AdminHistorySubsection title={t("history.publication")}>
            <AdminEventList>
              {homepage.publicationEvents.map((event) => (
                <AdminEventItem
                  key={`${event.action}-${event.createdAt.toISOString()}`}
                  title={t(`events.${event.action}`)}
                  detail={event.reason}
                  dateTime={event.createdAt.toISOString()}
                  dateLabel={new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(event.createdAt)}
                />
              ))}
            </AdminEventList>
          </AdminHistorySubsection>
        </section>
      </details>
    </article>
  );
}
