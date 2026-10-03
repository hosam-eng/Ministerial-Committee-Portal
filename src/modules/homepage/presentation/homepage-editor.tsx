"use client";

import { useActionState, useMemo, useState } from "react";

import {
  swapHomepageSectionPositions,
  type HomepageDraft,
} from "../domain/draft";
import {
  addManualNewsId,
  canAddManualNews,
  filterAvailableManualNewsToAdd,
  moveManualNewsId,
  removeManualNewsId,
  resolveSelectedManualNewsRows,
} from "../domain/manual-news";
import type { HomepageSectionType } from "../domain/sections";
import { HOMEPAGE_CTA_SYSTEM_ROUTE_KEYS } from "../domain/system-routes";

import { HomepageActionBar } from "./homepage-action-bar";

export type HomepageEditorState = {
  error: string | null;
  saved: boolean;
  editVersion: number;
};

export type HomepageEditorAction = (
  state: HomepageEditorState,
  formData: FormData,
) => Promise<HomepageEditorState>;

export type HomepagePickerTarget = {
  id: string;
  title: string;
  isPubliclyAvailable: boolean;
  displayDate?: Date | string | null;
};

export type HomepageEditorMessages = {
  saved: string;
  saving: string;
  save: string;
  submit: string;
  previewTitle: string;
  previewAr: string;
  previewEn: string;
  workflowTitle: string;
  sections: Record<string, string>;
  fields: Record<string, string>;
  newsMode: Record<string, string>;
  ui: Record<string, string>;
  workflow: {
    return: string;
    approve: string;
    publish: string;
    unpublish: string;
    edit: string;
    returnComment: string;
    unpublishReason: string;
    unpublishSection: string;
  };
  errors: Record<string, string>;
};

export function HomepageEditor({
  locale,
  previewRevision,
  publicationStatus,
  canEdit,
  canReview,
  canPublish,
  initialDraft,
  editVersion,
  workflowStatus,
  saveAction,
  submitAction,
  workflowAction,
  pageTargets,
  newsTargets,
  messages,
}: {
  locale: string;
  previewRevision: string | null;
  publicationStatus: string;
  canEdit: boolean;
  canReview: boolean;
  canPublish: boolean;
  initialDraft: HomepageDraft;
  editVersion: number;
  workflowStatus: string | null;
  saveAction: HomepageEditorAction;
  submitAction: (formData: FormData) => Promise<void>;
  workflowAction: (formData: FormData) => Promise<void>;
  pageTargets: HomepagePickerTarget[];
  newsTargets: HomepagePickerTarget[];
  messages: HomepageEditorMessages;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [selected, setSelected] = useState<HomepageSectionType>("HERO");
  const [state, formAction, pending] = useActionState(saveAction, {
    error: null,
    saved: false,
    editVersion,
  });
  const version = state.editVersion;
  const readOnly = !canEdit || workflowStatus !== "EDITING";
  const sortedSections = useMemo(
    () => [...draft.sections].sort((a, b) => a.position - b.position),
    [draft.sections],
  );
  const activeSection = sortedSections.find(
    (section) => section.sectionType === selected,
  );

  function updateDraft(next: HomepageDraft) {
    setDraft(next);
  }

  function moveSection(type: HomepageSectionType, direction: "up" | "down") {
    updateDraft(swapHomepageSectionPositions(draft, type, direction));
  }

  function patchHero(
    patch: Partial<NonNullable<HomepageDraft["sections"][0]["hero"]>>,
  ) {
    updateDraft({
      sections: draft.sections.map((section) =>
        section.sectionType === "HERO" && section.hero
          ? { ...section, hero: { ...section.hero, ...patch } }
          : section,
      ),
    });
  }

  function patchHeroTranslation(
    lang: "ar" | "en",
    patch: Partial<
      NonNullable<HomepageDraft["sections"][0]["hero"]>["translations"]["ar"]
    >,
  ) {
    const heroSection = draft.sections.find((s) => s.sectionType === "HERO");
    if (!heroSection?.hero) return;
    patchHero({
      translations: {
        ...heroSection.hero.translations,
        [lang]: { ...heroSection.hero.translations[lang], ...patch },
      },
    });
  }

  function patchNews(
    patch: Partial<NonNullable<HomepageDraft["sections"][0]["news"]>>,
  ) {
    updateDraft({
      sections: draft.sections.map((section) => {
        if (section.sectionType !== "NEWS" || !section.news) return section;
        const news = { ...section.news, ...patch };
        if (news.mode === "AUTOMATIC") news.manualNewsIds = [];
        return { ...section, news };
      }),
    });
  }

  function patchNewsTranslation(
    lang: "ar" | "en",
    patch: Partial<
      NonNullable<HomepageDraft["sections"][0]["news"]>["translations"]["ar"]
    >,
  ) {
    const newsSection = draft.sections.find((s) => s.sectionType === "NEWS");
    if (!newsSection?.news) return;
    patchNews({
      translations: {
        ...newsSection.news.translations,
        [lang]: { ...newsSection.news.translations[lang], ...patch },
      },
    });
  }

  function addManualNews(newsId: string) {
    const newsSection = draft.sections.find((s) => s.sectionType === "NEWS");
    if (!newsSection?.news || newsSection.news.mode !== "MANUAL") return;
    patchNews({
      manualNewsIds: addManualNewsId(newsSection.news.manualNewsIds, newsId),
    });
  }

  function removeManualNews(newsId: string) {
    const newsSection = draft.sections.find((s) => s.sectionType === "NEWS");
    if (!newsSection?.news || newsSection.news.mode !== "MANUAL") return;
    patchNews({
      manualNewsIds: removeManualNewsId(newsSection.news.manualNewsIds, newsId),
    });
  }

  function reorderManualNews(newsId: string, direction: "up" | "down") {
    const newsSection = draft.sections.find((s) => s.sectionType === "NEWS");
    if (!newsSection?.news || newsSection.news.mode !== "MANUAL") return;
    patchNews({
      manualNewsIds: moveManualNewsId(
        newsSection.news.manualNewsIds,
        newsId,
        direction,
      ),
    });
  }

  const newsTargetsById = useMemo(
    () => new Map(newsTargets.map((target) => [target.id, target])),
    [newsTargets],
  );

  const manualSelectedRows = useMemo(() => {
    if (activeSection?.sectionType !== "NEWS" || !activeSection.news) return [];
    if (activeSection.news.mode !== "MANUAL") return [];
    return resolveSelectedManualNewsRows(
      activeSection.news.manualNewsIds,
      newsTargetsById,
    );
  }, [activeSection, newsTargetsById]);

  const manualAvailableToAdd = useMemo(() => {
    if (activeSection?.sectionType !== "NEWS" || !activeSection.news) return [];
    if (activeSection.news.mode !== "MANUAL") return [];
    return filterAvailableManualNewsToAdd(
      newsTargets,
      activeSection.news.manualNewsIds,
    );
  }, [activeSection, newsTargets]);

  const draftJson = JSON.stringify(draft);

  return (
    <div className="admin-editor-layout">
      <div className="admin-editor-main">
        <section aria-label={messages.ui.sectionList}>
          <ul className="admin-homepage-section-list">
            {sortedSections.map((section, index) => (
              <li key={section.sectionType}>
                <button
                  type="button"
                  className={
                    selected === section.sectionType
                      ? "ui-button ui-button-primary"
                      : "ui-button ui-button-secondary"
                  }
                  onClick={() => setSelected(section.sectionType)}
                >
                  {messages.sections[section.sectionType]}
                  {!section.enabled ? ` (${messages.ui.disabled})` : ""}
                </button>
                {!readOnly ? (
                  <span className="ui-action-group">
                    <button
                      type="button"
                      className="ui-button ui-button-secondary"
                      disabled={index === 0}
                      onClick={() => moveSection(section.sectionType, "up")}
                    >
                      {messages.ui.moveUp}
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button-secondary"
                      disabled={index === sortedSections.length - 1}
                      onClick={() => moveSection(section.sectionType, "down")}
                    >
                      {messages.ui.moveDown}
                    </button>
                    <label className="ui-field ui-field--inline">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) =>
                          updateDraft({
                            sections: draft.sections.map((row) =>
                              row.sectionType === section.sectionType
                                ? { ...row, enabled: event.target.checked }
                                : row,
                            ),
                          })
                        }
                      />
                      <span>{messages.ui.enabled}</span>
                    </label>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {activeSection?.sectionType === "HERO" && activeSection.hero ? (
          <section className="admin-homepage-panel">
            <h3>{messages.sections.HERO}</h3>
            {(["ar", "en"] as const).map((lang) => (
              <fieldset key={lang} disabled={readOnly}>
                <legend>{messages.fields[`language_${lang}`] ?? lang}</legend>
                <label className="ui-field">
                  <span>{messages.fields.heroTitle}</span>
                  <input
                    className="ui-input"
                    value={activeSection.hero!.translations[lang].title}
                    onChange={(event) =>
                      patchHeroTranslation(lang, { title: event.target.value })
                    }
                  />
                </label>
                <label className="ui-field">
                  <span>{messages.fields.heroSupportingText}</span>
                  <textarea
                    className="ui-input"
                    rows={3}
                    value={
                      activeSection.hero!.translations[lang].supportingText
                    }
                    onChange={(event) =>
                      patchHeroTranslation(lang, {
                        supportingText: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="ui-field">
                  <span>{messages.fields.heroCtaLabel}</span>
                  <input
                    className="ui-input"
                    value={activeSection.hero!.translations[lang].ctaLabel}
                    onChange={(event) =>
                      patchHeroTranslation(lang, {
                        ctaLabel: event.target.value,
                      })
                    }
                  />
                </label>
              </fieldset>
            ))}
            <label className="ui-field ui-field--inline">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={activeSection.hero.ctaEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  patchHero(
                    enabled
                      ? {
                          ctaEnabled: true,
                          ctaTargetType:
                            activeSection.hero!.ctaTargetType || "SYSTEM_ROUTE",
                          systemRouteKey:
                            activeSection.hero!.systemRouteKey || "HOME",
                        }
                      : { ctaEnabled: false },
                  );
                }}
              />
              <span>{messages.fields.ctaEnabled}</span>
            </label>
            {activeSection.hero.ctaEnabled ? (
              <>
                <label className="ui-field">
                  <span>{messages.fields.ctaTargetType}</span>
                  <select
                    className="ui-input"
                    disabled={readOnly}
                    value={activeSection.hero.ctaTargetType || "SYSTEM_ROUTE"}
                    onChange={(event) =>
                      patchHero({
                        ctaTargetType: event.target.value as
                          "SYSTEM_ROUTE" | "CONTENT_ROUTE" | "EXTERNAL_LINK",
                      })
                    }
                  >
                    <option value="SYSTEM_ROUTE">
                      {messages.fields.targetSystemRoute}
                    </option>
                    <option value="CONTENT_ROUTE">
                      {messages.fields.targetContentRoute}
                    </option>
                    <option value="EXTERNAL_LINK">
                      {messages.fields.targetExternalLink}
                    </option>
                  </select>
                </label>
                {activeSection.hero.ctaTargetType === "SYSTEM_ROUTE" ||
                !activeSection.hero.ctaTargetType ? (
                  <label className="ui-field">
                    <span>{messages.fields.systemRouteKey}</span>
                    <select
                      className="ui-input"
                      disabled={readOnly}
                      value={activeSection.hero.systemRouteKey || "HOME"}
                      onChange={(event) =>
                        patchHero({ systemRouteKey: event.target.value })
                      }
                    >
                      {HOMEPAGE_CTA_SYSTEM_ROUTE_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {activeSection.hero.ctaTargetType === "CONTENT_ROUTE" ? (
                  <label className="ui-field">
                    <span>{messages.fields.managedPage}</span>
                    <select
                      className="ui-input"
                      disabled={readOnly}
                      value={activeSection.hero.contentTargetId}
                      onChange={(event) =>
                        patchHero({
                          contentTargetKind: "MANAGED_PAGE",
                          contentTargetId: event.target.value,
                        })
                      }
                    >
                      <option value="">{messages.ui.selectPage}</option>
                      {pageTargets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.title}
                          {!target.isPubliclyAvailable
                            ? ` (${messages.ui.unavailable})`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {activeSection.hero.ctaTargetType === "EXTERNAL_LINK" ? (
                  <label className="ui-field">
                    <span>{messages.fields.externalUrl}</span>
                    <input
                      className="ui-input"
                      disabled={readOnly}
                      value={activeSection.hero.externalUrl}
                      onChange={(event) =>
                        patchHero({ externalUrl: event.target.value })
                      }
                    />
                  </label>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}

        {activeSection?.sectionType === "NEWS" && activeSection.news ? (
          <section className="admin-homepage-panel">
            <h3>{messages.sections.NEWS}</h3>
            <label className="ui-field">
              <span>{messages.fields.newsMode}</span>
              <select
                className="ui-input"
                disabled={readOnly}
                value={activeSection.news.mode}
                onChange={(event) =>
                  patchNews({
                    mode:
                      event.target.value === "MANUAL" ? "MANUAL" : "AUTOMATIC",
                  })
                }
              >
                <option value="AUTOMATIC">{messages.newsMode.AUTOMATIC}</option>
                <option value="MANUAL">{messages.newsMode.MANUAL}</option>
              </select>
            </label>
            {(["ar", "en"] as const).map((lang) => (
              <label key={lang} className="ui-field">
                <span>{messages.fields.newsHeading}</span>
                <input
                  className="ui-input"
                  disabled={readOnly}
                  value={activeSection.news!.translations[lang].sectionHeading}
                  onChange={(event) =>
                    patchNewsTranslation(lang, {
                      sectionHeading: event.target.value,
                    })
                  }
                />
              </label>
            ))}
            {activeSection.news.mode === "MANUAL" ? (
              <div className="admin-homepage-manual-news">
                <fieldset disabled={readOnly}>
                  <legend>{messages.ui.selectedManualNews}</legend>
                  {manualSelectedRows.length ? (
                    <ol className="admin-homepage-manual-news-selected">
                      {manualSelectedRows.map((row, index) => {
                        const disableReorder = manualSelectedRows.length <= 1;
                        const publishedLabel =
                          row.displayDate && row.isPubliclyAvailable
                            ? new Intl.DateTimeFormat(locale, {
                                dateStyle: "medium",
                                timeZone: "UTC",
                              }).format(new Date(row.displayDate))
                            : null;
                        return (
                          <li key={row.id}>
                            <span className="admin-homepage-manual-news-title">
                              {row.title}
                            </span>
                            {publishedLabel ? (
                              <span className="news-muted">
                                {publishedLabel}
                              </span>
                            ) : null}
                            {!row.isPubliclyAvailable ? (
                              <span className="ui-badge ui-badge-neutral">
                                {messages.ui.notPubliclyAvailable}
                              </span>
                            ) : null}
                            {!readOnly ? (
                              <span className="ui-action-group">
                                <button
                                  type="button"
                                  className="ui-button ui-button-secondary"
                                  disabled={disableReorder || index === 0}
                                  aria-label={`${messages.ui.moveUp}: ${row.title}`}
                                  onClick={() =>
                                    reorderManualNews(row.id, "up")
                                  }
                                >
                                  {messages.ui.moveUp}
                                </button>
                                <button
                                  type="button"
                                  className="ui-button ui-button-secondary"
                                  disabled={
                                    disableReorder ||
                                    index === manualSelectedRows.length - 1
                                  }
                                  aria-label={`${messages.ui.moveDown}: ${row.title}`}
                                  onClick={() =>
                                    reorderManualNews(row.id, "down")
                                  }
                                >
                                  {messages.ui.moveDown}
                                </button>
                                <button
                                  type="button"
                                  className="ui-button ui-button-secondary"
                                  aria-label={`${messages.ui.removeManualNews}: ${row.title}`}
                                  onClick={() => removeManualNews(row.id)}
                                >
                                  {messages.ui.removeManualNews}
                                </button>
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="news-muted">
                      {messages.ui.noSelectedManualNews}
                    </p>
                  )}
                </fieldset>
                <fieldset disabled={readOnly}>
                  <legend>{messages.ui.addManualNews}</legend>
                  {!canAddManualNews(activeSection.news.manualNewsIds) ? (
                    <p className="news-muted">
                      {messages.ui.manualNewsMaxReached}
                    </p>
                  ) : manualAvailableToAdd.length ? (
                    <ul className="admin-homepage-manual-news-add">
                      {manualAvailableToAdd.map((target) => (
                        <li key={target.id}>
                          <button
                            type="button"
                            className="ui-button ui-button-secondary"
                            onClick={() => addManualNews(target.id)}
                          >
                            {messages.ui.addNewsItem.replace(
                              "{title}",
                              target.title,
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="news-muted">
                      {messages.ui.noAvailableManualNews}
                    </p>
                  )}
                </fieldset>
              </div>
            ) : (
              <p className="news-muted">{messages.ui.automaticNewsHint}</p>
            )}
          </section>
        ) : null}

        {state.error ? (
          <p role="alert" className="news-alert">
            {messages.errors[state.error] ?? messages.errors.generic}
          </p>
        ) : null}
        {state.saved ? (
          <p role="status" className="news-success">
            {messages.saved}
          </p>
        ) : null}
      </div>

      <aside className="admin-editor-rail">
        <h2>{messages.ui.draftRail}</h2>
        {previewRevision ? (
          <div className="admin-rail-block">
            <h3>{messages.previewTitle}</h3>
            <div className="ui-action-group ui-action-group--stack">
              <a
                className="ui-button ui-button-secondary"
                href={`/${locale}/admin/preview/homepage/${previewRevision}?locale=ar`}
              >
                {messages.previewAr}
              </a>
              <a
                className="ui-button ui-button-secondary"
                href={`/${locale}/admin/preview/homepage/${previewRevision}?locale=en`}
              >
                {messages.previewEn}
              </a>
            </div>
          </div>
        ) : null}
        {!readOnly ? (
          <>
            <form action={formAction} className="admin-rail-form">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="editVersion" value={String(version)} />
              <input type="hidden" name="draft" value={draftJson} />
              <div className="ui-action-group ui-action-group--stack">
                <button
                  className="ui-button ui-button-primary"
                  type="submit"
                  disabled={pending}
                >
                  {pending ? messages.saving : messages.save}
                </button>
              </div>
            </form>
            <form action={submitAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="editVersion" value={String(version)} />
              <input type="hidden" name="draft" value={draftJson} />
              <div className="ui-action-group ui-action-group--stack">
                <button className="ui-button ui-button-secondary" type="submit">
                  {messages.submit}
                </button>
              </div>
            </form>
          </>
        ) : null}
        <div className="admin-rail-block">
          <h3>{messages.workflowTitle}</h3>
          <HomepageActionBar
            locale={locale}
            workflowStatus={workflowStatus}
            publicationStatus={publicationStatus}
            canEdit={canEdit}
            canReview={canReview}
            canPublish={canPublish}
            action={workflowAction}
            messages={messages.workflow}
          />
        </div>
      </aside>
    </div>
  );
}
