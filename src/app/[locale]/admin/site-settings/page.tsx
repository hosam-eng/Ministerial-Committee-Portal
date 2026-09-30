import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import {
  SiteSettingsActionBar,
  SiteSettingsEditor,
  getEditorialSiteSettings,
} from "@/modules/site-settings";
import { AdminPageHeader } from "@/shared/ui/admin-page-header";
import {
  AdminEventItem,
  AdminEventList,
  AdminHistory,
  AdminHistorySubsection,
  AdminRevisionItem,
  AdminRevisionList,
} from "@/shared/ui/admin-history";

import {
  saveSiteSettingsAction,
  siteSettingsWorkflowAction,
  submitSiteSettingsAction,
} from "./actions";

function stringMessages(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export default async function SiteSettingsAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.SITE_SETTINGS_READ);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;

  const settings = await getEditorialSiteSettings(gate.user.id);
  const [t, query] = await Promise.all([
    getTranslations({ locale, namespace: "siteSettings" }),
    searchParams,
  ]);

  const permissions = gate.permissions;
  const canEdit = permissions.has(PERMISSIONS.SITE_SETTINGS_EDIT);
  const canReview = permissions.has(PERMISSIONS.SITE_SETTINGS_REVIEW);
  const canPublish = permissions.has(PERMISSIONS.SITE_SETTINGS_PUBLISH);
  const editorial = settings.active;
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

  const previewRevision = editorial?.id ?? settings.liveRevisionId;

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

      <section className="admin-status-grid" aria-label={t("statusTitle")}>
        <div className="admin-status-item">
          <p className="admin-status-label">{t("publicationLabel")}</p>
          <span className="ui-badge ui-badge-brand">
            {t(`publication.${settings.publicationStatus}`)}
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
            {settings.liveRevisionNumber
              ? t("revisionNumber", { number: settings.liveRevisionNumber })
              : t("notLive")}
          </strong>
        </div>
      </section>

      {settings.liveRevisionId && editorial ? (
        <p className="news-notice">{t("liveUnchanged")}</p>
      ) : null}

      {editorial ? (
        <SiteSettingsEditor
          key={`${editorial.id}-${editorial.editVersion}`}
          locale={locale}
          previewRevision={previewRevision}
          publicationStatus={settings.publicationStatus}
          canEdit={canEdit}
          canReview={canReview}
          canPublish={canPublish}
          initialDraft={editorial.draft}
          editVersion={editorial.editVersion}
          workflowStatus={editorial.workflowStatus}
          saveAction={saveSiteSettingsAction}
          submitAction={submitSiteSettingsAction}
          workflowAction={siteSettingsWorkflowAction}
          messages={{
            saved: t("saved"),
            saving: t("saving"),
            save: t("save"),
            submit: t("actions.submit"),
            previewTitle: t("rail.preview"),
            previewAr: t("previewAr"),
            previewEn: t("previewEn"),
            workflowTitle: t("rail.workflow"),
            submitTitle: t("rail.submit"),
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
            sections: {
              identity: t("sections.identity"),
              identityHint: t("sections.identityHint"),
              contact: t("sections.contact"),
              social: t("sections.social"),
              seo: t("sections.seo"),
            },
            fields: {
              officialName: t("fields.officialName"),
              contactEmail: t("fields.contactEmail"),
              contactPhone: t("fields.contactPhone"),
              address: t("fields.address"),
              defaultSeoTitle: t("fields.defaultSeoTitle"),
              defaultSeoDescription: t("fields.defaultSeoDescription"),
            },
            languages: { ar: t("languages.ar"), en: t("languages.en") },
            social: {
              hint: t("social.hint"),
              labelAr: t("social.labelAr"),
              labelEn: t("social.labelEn"),
              url: t("social.url"),
              add: t("social.add"),
              remove: t("social.remove"),
              moveUp: t("social.moveUp"),
              moveDown: t("social.moveDown"),
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
            <aside
              className="admin-editor-rail admin-editor-block"
              aria-labelledby="site-settings-idle-rail"
            >
              {previewRevision ? (
                <section className="admin-rail-section">
                  <h3 className="admin-rail-section-title">
                    {t("rail.preview")}
                  </h3>
                  <div className="ui-action-group ui-action-group--stack">
                    <a
                      className="ui-button ui-button-secondary"
                      href={`/ar/admin/preview/site-settings/${previewRevision}`}
                    >
                      {t("previewAr")}
                    </a>
                    <a
                      className="ui-button ui-button-secondary"
                      href={`/en/admin/preview/site-settings/${previewRevision}`}
                    >
                      {t("previewEn")}
                    </a>
                  </div>
                </section>
              ) : null}
              <section className="admin-rail-section">
                <h3
                  id="site-settings-idle-rail"
                  className="admin-rail-section-title"
                >
                  {t("rail.workflow")}
                </h3>
                <SiteSettingsActionBar
                  locale={locale}
                  workflowStatus={null}
                  publicationStatus={settings.publicationStatus}
                  canEdit={canEdit}
                  canReview={canReview}
                  canPublish={canPublish}
                  action={siteSettingsWorkflowAction}
                  messages={{
                    return: t("actions.return"),
                    approve: t("actions.approve"),
                    publish: t("actions.publish"),
                    unpublish: t("actions.unpublish"),
                    edit: t("actions.editPublished"),
                    returnComment: t("actions.returnComment"),
                    unpublishReason: t("actions.unpublishReason"),
                    unpublishSection: t("rail.unpublish"),
                  }}
                />
              </section>
            </aside>
          </div>
        </section>
      )}

      <AdminHistory title={t("history.title")}>
        <p className="news-hint">{t("history.restoreHint")}</p>
        <AdminHistorySubsection title={t("history.revisions")}>
          <AdminRevisionList>
            {settings.revisions.map((revision) => (
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
                  revision.id === settings.liveRevisionId ? (
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
                    <form action={siteSettingsWorkflowAction}>
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
            {settings.workflowEvents.map((event, index) => (
              <AdminEventItem
                key={`wf-${index}`}
                title={t(`events.${event.action}`)}
                detail={event.comment ? <p>{event.comment}</p> : undefined}
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
            {settings.publicationEvents.map((event, index) => (
              <AdminEventItem
                key={`pub-${index}`}
                title={t(`events.${event.action}`)}
                detail={event.reason ? <p>{event.reason}</p> : undefined}
                dateTime={event.createdAt.toISOString()}
                dateLabel={new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(event.createdAt)}
              />
            ))}
          </AdminEventList>
        </AdminHistorySubsection>
      </AdminHistory>
    </article>
  );
}
