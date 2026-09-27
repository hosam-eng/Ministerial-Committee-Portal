"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

export interface NewsEditorState {
  error: string | null;
  saved: boolean;
  editVersion: number;
}
export type NewsEditorAction = (
  state: NewsEditorState,
  formData: FormData,
) => Promise<NewsEditorState>;
export type NewsWorkflowAction = (formData: FormData) => Promise<void>;

export function NewsEditor({
  locale,
  newsId,
  revision,
  saveAction,
  workflowAction,
}: {
  locale: string;
  newsId: string;
  revision: {
    editVersion: number;
    categoryIds: string[];
    translations: Record<
      string,
      {
        title: string;
        slug: string;
        summary: string;
        body: string;
        seoTitle: string;
        seoDescription: string;
      }
    >;
  };
  saveAction: NewsEditorAction;
  workflowAction: NewsWorkflowAction;
}) {
  const t = useTranslations("news");
  const [state, action, pending] = useActionState(saveAction, {
    error: null,
    saved: false,
    editVersion: revision.editVersion,
  });
  const [dirtyVersion, setDirtyVersion] = useState<number | null>(null);
  const dirty = dirtyVersion === state.editVersion;
  const safeError =
    state.error && t.has(`errors.${state.error}`)
      ? t(`errors.${state.error}`)
      : t("errors.generic");
  return (
    <section className="news-editor" aria-labelledby="news-editor-title">
      <h2 id="news-editor-title">{t("editorTitle")}</h2>
      <p className="news-muted">{t("editorIntro")}</p>
      {state.error && (
        <p className="news-alert" role="alert">
          {safeError}
        </p>
      )}
      {state.saved && !state.error && !dirty && (
        <p className="news-success" role="status">
          {t("saved")}
        </p>
      )}
      <form
        action={action}
        className="news-form"
        onChange={() => setDirtyVersion(state.editVersion)}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="newsId" value={newsId} />
        <input type="hidden" name="editVersion" value={state.editVersion} />
        {revision.categoryIds.map((id) => (
          <input key={id} type="hidden" name="categoryId" value={id} />
        ))}
        <div className="news-language-grid">
          {(["ar", "en"] as const).map((language) => {
            const values = revision.translations[language];
            return (
              <fieldset
                key={language}
                className="news-language"
                lang={language}
                dir={language === "ar" ? "rtl" : "ltr"}
              >
                <legend>{t(`languages.${language}`)}</legend>
                <label htmlFor={`title_${language}`}>{t("fields.title")}</label>
                <input
                  id={`title_${language}`}
                  name={`title_${language}`}
                  defaultValue={values?.title ?? ""}
                />
                <label htmlFor={`summary_${language}`}>
                  {t("fields.summary")}
                </label>
                <textarea
                  id={`summary_${language}`}
                  name={`summary_${language}`}
                  rows={3}
                  defaultValue={values?.summary ?? ""}
                />
                <label htmlFor={`body_${language}`}>{t("fields.body")}</label>
                <p className="news-hint" id={`body_hint_${language}`}>
                  {t("fields.bodyHint")}
                </p>
                <textarea
                  id={`body_${language}`}
                  name={`body_${language}`}
                  rows={9}
                  spellCheck={false}
                  aria-describedby={`body_hint_${language}`}
                  dir="ltr"
                  defaultValue={values?.body ?? ""}
                />
                <label htmlFor={`slug_${language}`}>{t("fields.slug")}</label>
                <input
                  id={`slug_${language}`}
                  name={`slug_${language}`}
                  dir="auto"
                  defaultValue={values?.slug ?? ""}
                />
                <label htmlFor={`seoTitle_${language}`}>
                  {t("fields.seoTitle")}
                </label>
                <input
                  id={`seoTitle_${language}`}
                  name={`seoTitle_${language}`}
                  defaultValue={values?.seoTitle ?? ""}
                />
                <label htmlFor={`seoDescription_${language}`}>
                  {t("fields.seoDescription")}
                </label>
                <textarea
                  id={`seoDescription_${language}`}
                  name={`seoDescription_${language}`}
                  rows={2}
                  defaultValue={values?.seoDescription ?? ""}
                />
              </fieldset>
            );
          })}
        </div>
        <button
          className="news-button news-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? t("saving") : t("save")}
        </button>
      </form>
      {dirty && (
        <p className="news-notice" role="status">
          {t("unsaved")}
        </p>
      )}
      <form action={workflowAction} className="news-actions">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="newsId" value={newsId} />
        <input type="hidden" name="editVersion" value={state.editVersion} />
        <button
          className="news-button"
          name="operation"
          value="submit"
          type="submit"
          disabled={dirty || pending}
        >
          {t("actions.submit")}
        </button>
      </form>
    </section>
  );
}
