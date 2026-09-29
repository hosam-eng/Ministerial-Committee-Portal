import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import {
  ManagedPageActionBar,
  getEditorialManagedPage,
} from "@/modules/managed-pages";
import {
  ManagedPageEditor,
  type ManagedPageEditorMessages,
} from "@/modules/managed-pages/editor";
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
  managedPageWorkflowAction,
  saveManagedPageAction,
  submitManagedPageAction,
} from "../actions";

function stringMessages(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export default async function ManagedPageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.MANAGED_PAGES_READ);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  const [page, t, query] = await Promise.all([
    getEditorialManagedPage(gate.user.id, id, locale === "en" ? "en" : "ar"),
    getTranslations({ locale, namespace: "managedPages" }),
    searchParams,
  ]);
  if (!page) notFound();
  const permissions = gate.permissions;
  const canEdit = permissions.has(PERMISSIONS.MANAGED_PAGES_EDIT);
  const canReview = permissions.has(PERMISSIONS.MANAGED_PAGES_REVIEW);
  const canPublish = permissions.has(PERMISSIONS.MANAGED_PAGES_PUBLISH);
  const editorial = page.active;
  const title =
    editorial?.draft.translations[locale === "en" ? "en" : "ar"]?.title ||
    t("untitled");
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
  const messages: ManagedPageEditorMessages = {
    editorTitle: t("editorTitle"),
    editorIntro: t("editorIntro"),
    saved: t("saved"),
    saving: t("saving"),
    save: t("save"),
    unsaved: t("unsaved"),
    submit: t("actions.submit"),
    structure: t("blocksTitle"),
    addRichText: t("addRichText"),
    addCallout: t("addCallout"),
    addLinkList: t("addLinkList"),
    moveUp: t("moveUp"),
    moveDown: t("moveDown"),
    remove: t("removeBlock"),
    blocks: {
      RICHTEXT: t("blockRichText"),
      CALLOUT: t("blockCallout"),
      LINK_LIST: t("blockLinkList"),
    },
    variants: {
      institutional: t("variants.INSTITUTIONAL"),
      info: t("variants.INFO"),
      success: t("variants.SUCCESS"),
      warning: t("variants.WARNING"),
      error: t("variants.ERROR"),
    },
    variant: t("variant"),
    addItem: t("addItem"),
    itemTarget: t("itemKind"),
    externalUrl: t("external"),
    internalPage: t("internal"),
    languages: { ar: t("languages.ar"), en: t("languages.en") },
    fields: {
      title: t("fields.title"),
      intro: t("fields.summary"),
      slug: t("fields.slug"),
      seoTitle: t("fields.seoTitle"),
      seoDescription: t("fields.seoDescription"),
      calloutTitle: t("calloutTitle"),
      calloutBody: t("calloutBody"),
      linkHeading: t("linkHeading"),
      linkLabel: t("itemLabel"),
    },
    richText: {
      toolbar: t("toolbar.toolbar"),
      editingRegion: t("toolbar.editingRegion"),
      paragraph: t("toolbar.paragraph"),
      h2: t("toolbar.h2"),
      h3: t("toolbar.h3"),
      h4: t("toolbar.h4"),
      bold: t("toolbar.bold"),
      italic: t("toolbar.italic"),
      bulletList: t("toolbar.bulletList"),
      orderedList: t("toolbar.orderedList"),
      quote: t("toolbar.blockquote"),
      link: t("toolbar.link"),
      linkDialog: t("toolbar.linkDialog"),
      external: t("toolbar.external"),
      internal: t("toolbar.internal"),
      url: t("toolbar.linkValue"),
      page: t("toolbar.internal"),
      applyLink: t("toolbar.applyLink"),
      removeLink: t("toolbar.removeLink"),
      close: t("toolbar.close"),
    },
    errors: stringMessages(t.raw("errors")),
  };
  const previewRevision = editorial?.id;
  return (
    <article className="admin-editor-page">
      <a className="admin-editor-back" href={`/${locale}/admin/content/pages`}>
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
            {t(`publication.${page.publicationStatus}`)}
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
            {page.liveRevisionNumber
              ? t("revisionNumber", { number: page.liveRevisionNumber })
              : t("notLive")}
          </strong>
        </div>
      </section>
      <p className="news-muted">
        {t("dependencies", { count: page.outgoingTargets.length })}
      </p>
      <p className="news-muted">
        {t("incoming", { count: page.incomingCount })}
      </p>
      {page.liveRevisionId && editorial && (
        <p className="news-notice">{t("liveUnchanged")}</p>
      )}
      {previewRevision && (
        <div className="news-actions">
          <a
            className="ui-button ui-button-secondary"
            href={`/ar/admin/preview/managed-pages/${previewRevision}`}
          >
            {t("previewAr")}
          </a>
          <a
            className="ui-button ui-button-secondary"
            href={`/en/admin/preview/managed-pages/${previewRevision}`}
          >
            {t("previewEn")}
          </a>
        </div>
      )}
      <AdminWorkflowStack>
        {editorial?.workflowStatus === "EDITING" && canEdit ? (
          <ManagedPageEditor
            key={`${editorial.id}-${editorial.editVersion}`}
            locale={locale}
            pageId={page.id}
            editVersion={editorial.editVersion}
            draft={editorial.draft}
            pages={page.linkOptions}
            messages={messages}
            saveAction={saveManagedPageAction}
            submitAction={submitManagedPageAction}
          />
        ) : null}
        {editorial?.workflowStatus === "EDITING" && !canEdit ? (
          <p className="news-muted">{t("readOnly")}</p>
        ) : null}
        <ManagedPageActionBar
          locale={locale}
          pageId={page.id}
          workflowStatus={editorial?.workflowStatus ?? null}
          publicationStatus={page.publicationStatus}
          canEdit={canEdit}
          canReview={canReview}
          canPublish={canPublish}
          action={managedPageWorkflowAction}
          messages={{
            return: t("actions.return"),
            approve: t("actions.approve"),
            publish: t("actions.publish"),
            unpublish: t("actions.unpublish"),
            edit: t("actions.edit"),
            returnComment: t("fields.returnComment"),
            unpublishReason: t("fields.unpublishReason"),
          }}
        />
      </AdminWorkflowStack>
      <AdminHistory title={t("history.title")}>
        <p className="news-hint">{t("history.restoreHint")}</p>
        <AdminHistorySubsection title={t("history.revisions")}>
          <AdminRevisionList>
            {page.revisions.map((revision) => (
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
                  revision.id === page.liveRevisionId ? (
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
                  <>
                    {canEdit ? (
                      <form action={managedPageWorkflowAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="pageId" value={page.id} />
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
                      href={`/ar/admin/preview/managed-pages/${revision.id}`}
                    >
                      {t("previewAr")}
                    </a>
                    <a
                      className="ui-button ui-button-secondary ui-button-compact"
                      href={`/en/admin/preview/managed-pages/${revision.id}`}
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
          {page.workflowEvents.length ? (
            <AdminEventList>
              {page.workflowEvents.map((event, index) => (
                <AdminEventItem
                  key={`${event.action}-${event.createdAt.toISOString()}-${index}`}
                  title={t(`events.${event.action}`)}
                  dateTime={event.createdAt.toISOString()}
                  dateLabel={new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(event.createdAt)}
                  detail={event.comment ? <p>{event.comment}</p> : undefined}
                />
              ))}
            </AdminEventList>
          ) : (
            <p className="admin-history-empty">{t("history.none")}</p>
          )}
        </AdminHistorySubsection>
        <AdminHistorySubsection title={t("history.publication")}>
          {page.publicationEvents.length ? (
            <AdminEventList>
              {page.publicationEvents.map((event, index) => (
                <AdminEventItem
                  key={`${event.action}-${event.createdAt.toISOString()}-${index}`}
                  title={t(`events.${event.action}`)}
                  dateTime={event.createdAt.toISOString()}
                  dateLabel={new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(event.createdAt)}
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
