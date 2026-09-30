import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { listManagedPageNavigationPickerTargets } from "@/modules/managed-pages";
import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import {
  NavigationEditor,
  getEditorialPublicNavigation,
} from "@/modules/public-navigation";
import { AdminPageHeader } from "@/shared/ui/admin-page-header";
import {
  AdminEventItem,
  AdminEventList,
  AdminHistorySubsection,
  AdminRevisionItem,
  AdminRevisionList,
} from "@/shared/ui/admin-history";

import {
  navigationWorkflowAction,
  saveNavigationAction,
  submitNavigationAction,
} from "./actions";
import { NavigationItemCount } from "./navigation-item-count";

function stringMessages(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export default async function NavigationAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.NAVIGATION_READ);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;

  const contentLocale = locale === "en" ? "en" : "ar";
  const navigation = await getEditorialPublicNavigation(gate.user.id);
  const pageTargets = await listManagedPageNavigationPickerTargets(
    gate.user.id,
    contentLocale,
  );
  const [t, query] = await Promise.all([
    getTranslations({ locale, namespace: "navigation" }),
    searchParams,
  ]);

  const permissions = gate.permissions;
  const canEdit = permissions.has(PERMISSIONS.NAVIGATION_EDIT);
  const canReview = permissions.has(PERMISSIONS.NAVIGATION_REVIEW);
  const canPublish = permissions.has(PERMISSIONS.NAVIGATION_PUBLISH);
  const editorial = navigation.active;
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

  const previewRevision = editorial?.id ?? navigation.liveRevisionId;

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
            {t(`publication.${navigation.publicationStatus}`)}
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
          {navigation.liveRevisionNumber ? (
            <span className="ui-badge ui-badge-brand">
              {t("revisionNumber", { number: navigation.liveRevisionNumber })}
            </span>
          ) : (
            <span className="news-muted">{t("notLive")}</span>
          )}
        </div>
      </section>

      {navigation.liveRevisionId && editorial ? (
        <p className="news-notice navigation-live-note">{t("liveUnchanged")}</p>
      ) : null}

      {editorial ? (
        <NavigationEditor
          key={`${editorial.id}-${editorial.editVersion}`}
          locale={locale}
          previewRevision={previewRevision}
          publicationStatus={navigation.publicationStatus}
          canEdit={canEdit}
          canReview={canReview}
          canPublish={canPublish}
          initialDraft={editorial.draft}
          editVersion={editorial.editVersion}
          workflowStatus={editorial.workflowStatus}
          pageTargets={pageTargets}
          saveAction={saveNavigationAction}
          submitAction={submitNavigationAction}
          workflowAction={navigationWorkflowAction}
          ItemCountDisplay={NavigationItemCount}
          messages={{
            saved: t("saved"),
            saving: t("saving"),
            save: t("save"),
            submit: t("actions.submit"),
            previewTitle: t("rail.preview"),
            previewAr: t("previewAr"),
            previewEn: t("previewEn"),
            workflowTitle: t("rail.workflow"),
            ui: {
              locationPickerLabel: t("ui.locationPickerLabel"),
              locationContext: {
                MAIN: t("ui.locationContext.MAIN"),
                UTILITY: t("ui.locationContext.UTILITY"),
                FOOTER: t("ui.locationContext.FOOTER"),
              },
              addItem: t("ui.addItem"),
              treeTitle: t("ui.treeTitle"),
              noSelection: t("ui.noSelection"),
              draftRail: t("ui.draftRail"),
            },
            locations: {
              MAIN: t("locations.MAIN"),
              UTILITY: t("locations.UTILITY"),
              FOOTER: t("locations.FOOTER"),
            },
            itemTypes: stringMessages(t.raw("itemTypes")),
            fields: stringMessages(t.raw("fields")),
            tree: stringMessages(t.raw("tree")),
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
        <section className="news-editor">
          <div className="admin-editor-layout">
            <div className="admin-editor-main admin-editor-block">
              <p className="news-muted">{t("noActive")}</p>
            </div>
            <aside className="admin-editor-rail admin-editor-block">
              {previewRevision ? (
                <section className="admin-rail-section">
                  <h3 className="admin-rail-section-title">
                    {t("rail.preview")}
                  </h3>
                  <div className="ui-action-group ui-action-group--stack">
                    <a
                      className="ui-button ui-button-secondary"
                      href={`/ar/admin/preview/navigation/${previewRevision}`}
                    >
                      {t("previewAr")}
                    </a>
                    <a
                      className="ui-button ui-button-secondary"
                      href={`/en/admin/preview/navigation/${previewRevision}`}
                    >
                      {t("previewEn")}
                    </a>
                  </div>
                </section>
              ) : null}
              <section className="admin-rail-section">
                <h3 className="admin-rail-section-title">
                  {t("rail.workflow")}
                </h3>
                {navigation.publicationStatus === "PUBLISHED" && canEdit ? (
                  <form action={navigationWorkflowAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="operation" value="edit" />
                    <button
                      className="ui-button ui-button-secondary"
                      type="submit"
                    >
                      {t("actions.editPublished")}
                    </button>
                  </form>
                ) : null}
              </section>
            </aside>
          </div>
        </section>
      )}

      <details className="admin-history-details">
        <summary className="admin-history-summary">
          {t("history.title")}
        </summary>
        <section className="admin-history" aria-label={t("history.title")}>
          <AdminHistorySubsection title={t("history.revisions")}>
            <AdminRevisionList>
              {navigation.revisions.map((revision) => (
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
                    revision.id === navigation.liveRevisionId ? (
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
                      <form action={navigationWorkflowAction}>
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
              {navigation.workflowEvents.map((event) => (
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
              {navigation.publicationEvents.map((event) => (
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
