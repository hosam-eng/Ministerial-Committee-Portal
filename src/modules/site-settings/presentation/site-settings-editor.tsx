"use client";

import { useActionState, useMemo, useState } from "react";

import type {
  SiteSettingsDraft,
  SiteSettingsSocialLinkDraft,
} from "../domain/draft";

import { SiteSettingsActionBar } from "./site-settings-action-bar";

export type SiteSettingsEditorState = {
  error: string | null;
  saved: boolean;
  editVersion: number;
};

export type SiteSettingsEditorAction = (
  state: SiteSettingsEditorState,
  formData: FormData,
) => Promise<SiteSettingsEditorState>;

export type SiteSettingsEditorMessages = {
  saved: string;
  saving: string;
  save: string;
  submit: string;
  previewTitle: string;
  previewAr: string;
  previewEn: string;
  workflowTitle: string;
  submitTitle: string;
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
  sections: Record<string, string>;
  fields: Record<string, string>;
  languages: Record<string, string>;
  social: Record<string, string>;
  errors: Record<string, string>;
};

function newItemKey() {
  return crypto.randomUUID();
}

function normalizeLinks(links: SiteSettingsSocialLinkDraft[]) {
  return [...links]
    .sort((a, b) => a.position - b.position)
    .map((link, index) => ({ ...link, position: index }));
}

export function SiteSettingsEditor({
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
  messages,
}: {
  locale: string;
  previewRevision: string | null;
  publicationStatus: string;
  canEdit: boolean;
  canReview: boolean;
  canPublish: boolean;
  initialDraft: SiteSettingsDraft;
  editVersion: number;
  workflowStatus: string;
  saveAction: SiteSettingsEditorAction;
  submitAction: (formData: FormData) => void | Promise<void>;
  workflowAction: (formData: FormData) => void | Promise<void>;
  messages: SiteSettingsEditorMessages;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [state, save, saving] = useActionState(saveAction, {
    error: null,
    saved: false,
    editVersion,
  });

  const readOnly = !canEdit || workflowStatus !== "EDITING";
  const contentLocale = locale === "en" ? "en" : "ar";
  const serialized = useMemo(() => JSON.stringify(draft), [draft]);

  function updateLocale(
    loc: "ar" | "en",
    field: keyof SiteSettingsDraft["translations"]["ar"],
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [loc]: { ...current.translations[loc], [field]: value },
      },
    }));
  }

  function updateSocial(
    index: number,
    patch: Partial<SiteSettingsSocialLinkDraft>,
  ) {
    setDraft((current) => {
      const links = normalizeLinks(
        current.socialLinks.map((link, i) =>
          i === index ? { ...link, ...patch } : link,
        ),
      );
      return { ...current, socialLinks: links };
    });
  }

  function addSocial() {
    setDraft((current) => ({
      ...current,
      socialLinks: normalizeLinks([
        ...current.socialLinks,
        {
          itemKey: newItemKey(),
          labelAr: "",
          labelEn: "",
          url: "",
          position: current.socialLinks.length,
        },
      ]),
    }));
  }

  function removeSocial(index: number) {
    setDraft((current) => ({
      ...current,
      socialLinks: normalizeLinks(
        current.socialLinks.filter((_, i) => i !== index),
      ),
    }));
  }

  function moveSocial(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const links = normalizeLinks([...current.socialLinks]);
      const target = index + direction;
      if (target < 0 || target >= links.length) return current;
      const copy = [...links];
      const [row] = copy.splice(index, 1);
      copy.splice(target, 0, row);
      return { ...current, socialLinks: normalizeLinks(copy) };
    });
  }

  const errorMessage =
    state.error && messages.errors[state.error]
      ? messages.errors[state.error]
      : state.error
        ? messages.errors.generic
        : null;

  return (
    <section
      className="news-editor"
      aria-labelledby="site-settings-editor-title"
    >
      <div className="admin-editor-layout">
        <div className="admin-editor-main admin-editor-block">
          <h2 id="site-settings-editor-title" className="sr-only">
            {messages.sections.identity}
          </h2>
          {errorMessage ? (
            <p role="alert" className="news-alert">
              {errorMessage}
            </p>
          ) : null}
          {state.saved ? (
            <p role="status" className="news-success">
              {messages.saved}
            </p>
          ) : null}

          <form action={save} className="site-settings-form">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="editVersion" value={state.editVersion} />
            <input type="hidden" name="draft" value={serialized} readOnly />

            <div className="admin-form-section">
              <h3 className="admin-form-section-title">
                {messages.sections.identity}
              </h3>
              <p className="news-muted">{messages.sections.identityHint}</p>
              <div className="admin-locale-grid">
                {(["ar", "en"] as const).map((loc) => (
                  <div key={loc} className="admin-locale-panel">
                    <h4>{messages.languages[loc]}</h4>
                    <label className="ui-field">
                      <span>{messages.fields.officialName}</span>
                      <input
                        className="ui-input"
                        value={draft.translations[loc].officialName}
                        onChange={(event) =>
                          updateLocale(loc, "officialName", event.target.value)
                        }
                        disabled={readOnly}
                        required={loc === contentLocale}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-form-section">
              <h3 className="admin-form-section-title">
                {messages.sections.contact}
              </h3>
              <label className="ui-field">
                <span>{messages.fields.contactEmail}</span>
                <input
                  className="ui-input ui-input-ltr"
                  dir="ltr"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={draft.contactEmail}
                  onChange={(event) =>
                    setDraft((c) => ({
                      ...c,
                      contactEmail: event.target.value,
                    }))
                  }
                  disabled={readOnly}
                />
              </label>
              <label className="ui-field">
                <span>{messages.fields.contactPhone}</span>
                <input
                  className="ui-input ui-input-ltr"
                  dir="ltr"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={draft.contactPhone}
                  onChange={(event) =>
                    setDraft((c) => ({
                      ...c,
                      contactPhone: event.target.value,
                    }))
                  }
                  disabled={readOnly}
                />
              </label>
              <div className="admin-locale-grid">
                {(["ar", "en"] as const).map((loc) => (
                  <label key={loc} className="ui-field">
                    <span>
                      {messages.fields.address} ({messages.languages[loc]})
                    </span>
                    <textarea
                      className="ui-input"
                      rows={3}
                      value={draft.translations[loc].address}
                      onChange={(event) =>
                        updateLocale(loc, "address", event.target.value)
                      }
                      disabled={readOnly}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="admin-form-section">
              <h3 className="admin-form-section-title">
                {messages.sections.social}
              </h3>
              <p className="news-muted">{messages.social.hint}</p>
              <ul className="site-settings-social-list">
                {draft.socialLinks.map((link, index) => (
                  <li key={link.itemKey} className="site-settings-social-row">
                    <label className="ui-field">
                      <span>{messages.social.labelAr}</span>
                      <input
                        className="ui-input"
                        value={link.labelAr}
                        onChange={(event) =>
                          updateSocial(index, { labelAr: event.target.value })
                        }
                        disabled={readOnly}
                      />
                    </label>
                    <label className="ui-field">
                      <span>{messages.social.labelEn}</span>
                      <input
                        className="ui-input"
                        value={link.labelEn}
                        onChange={(event) =>
                          updateSocial(index, { labelEn: event.target.value })
                        }
                        disabled={readOnly}
                      />
                    </label>
                    <label className="ui-field">
                      <span>{messages.social.url}</span>
                      <input
                        className="ui-input ui-input-ltr"
                        dir="ltr"
                        type="url"
                        inputMode="url"
                        value={link.url}
                        onChange={(event) =>
                          updateSocial(index, { url: event.target.value })
                        }
                        disabled={readOnly}
                        placeholder="https://"
                      />
                    </label>
                    {!readOnly ? (
                      <div className="ui-action-group site-settings-social-actions">
                        <button
                          type="button"
                          className="ui-button ui-button-secondary"
                          onClick={() => moveSocial(index, -1)}
                          disabled={index === 0}
                          aria-label={messages.social.moveUp}
                        >
                          {messages.social.moveUp}
                        </button>
                        <button
                          type="button"
                          className="ui-button ui-button-secondary"
                          onClick={() => moveSocial(index, 1)}
                          disabled={index === draft.socialLinks.length - 1}
                          aria-label={messages.social.moveDown}
                        >
                          {messages.social.moveDown}
                        </button>
                        <button
                          type="button"
                          className="ui-button ui-button-danger"
                          onClick={() => removeSocial(index)}
                        >
                          {messages.social.remove}
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {!readOnly ? (
                <div className="ui-action-group">
                  <button
                    type="button"
                    className="ui-button ui-button-secondary"
                    onClick={addSocial}
                  >
                    {messages.social.add}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="admin-form-section">
              <h3 className="admin-form-section-title">
                {messages.sections.seo}
              </h3>
              <div className="admin-locale-grid">
                {(["ar", "en"] as const).map((loc) => (
                  <div key={loc} className="admin-locale-panel">
                    <h4>{messages.languages[loc]}</h4>
                    <label className="ui-field">
                      <span>{messages.fields.defaultSeoTitle}</span>
                      <input
                        className="ui-input"
                        value={draft.translations[loc].defaultSeoTitle}
                        onChange={(event) =>
                          updateLocale(
                            loc,
                            "defaultSeoTitle",
                            event.target.value,
                          )
                        }
                        disabled={readOnly}
                      />
                    </label>
                    <label className="ui-field">
                      <span>{messages.fields.defaultSeoDescription}</span>
                      <textarea
                        className="ui-input"
                        rows={3}
                        value={draft.translations[loc].defaultSeoDescription}
                        onChange={(event) =>
                          updateLocale(
                            loc,
                            "defaultSeoDescription",
                            event.target.value,
                          )
                        }
                        disabled={readOnly}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {!readOnly ? (
              <div className="ui-action-group">
                <button
                  className="ui-button ui-button-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? messages.saving : messages.save}
                </button>
              </div>
            ) : null}
          </form>
        </div>

        <aside
          className="admin-editor-rail admin-editor-block"
          aria-labelledby="site-settings-rail"
        >
          {previewRevision ? (
            <section className="admin-rail-section">
              <h3 className="admin-rail-section-title">
                {messages.previewTitle}
              </h3>
              <div className="ui-action-group ui-action-group--stack">
                <a
                  className="ui-button ui-button-secondary"
                  href={`/ar/admin/preview/site-settings/${previewRevision}`}
                >
                  {messages.previewAr}
                </a>
                <a
                  className="ui-button ui-button-secondary"
                  href={`/en/admin/preview/site-settings/${previewRevision}`}
                >
                  {messages.previewEn}
                </a>
              </div>
            </section>
          ) : null}

          <section className="admin-rail-section">
            <h3 id="site-settings-rail" className="admin-rail-section-title">
              {messages.workflowTitle}
            </h3>
            <SiteSettingsActionBar
              locale={locale}
              workflowStatus={workflowStatus}
              publicationStatus={publicationStatus}
              canEdit={canEdit}
              canReview={canReview}
              canPublish={canPublish}
              action={workflowAction}
              messages={messages.workflow}
            />
          </section>

          {canEdit && workflowStatus === "EDITING" ? (
            <section className="admin-rail-section">
              <h3 className="admin-rail-section-title">
                {messages.submitTitle}
              </h3>
              <form action={submitAction}>
                <input type="hidden" name="locale" value={locale} />
                <input
                  type="hidden"
                  name="editVersion"
                  value={state.editVersion}
                />
                <input type="hidden" name="draft" value={serialized} readOnly />
                <div className="ui-action-group ui-action-group--stack">
                  <button
                    className="ui-button ui-button-secondary"
                    type="submit"
                  >
                    {messages.submit}
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
