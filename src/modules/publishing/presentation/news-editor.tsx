"use client";

import { useActionState, useState, type ChangeEvent } from "react";
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
export type NewsSubmitAction = (
  state: { error: string | null; attemptedVersion: number },
  formData: FormData,
) => Promise<{ error: string | null; attemptedVersion: number }>;

export function NewsEditor({
  locale,
  newsId,
  revision,
  saveAction,
  submitAction,
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
  submitAction: NewsSubmitAction;
}) {
  const t = useTranslations("news");
  const [state, action, pending] = useActionState(saveAction, {
    error: null,
    saved: false,
    editVersion: revision.editVersion,
  });
  const [submitState, submit, submitting] = useActionState(submitAction, {
    error: null,
    attemptedVersion: revision.editVersion,
  });
  const [dirtyVersion, setDirtyVersion] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(revision.translations).flatMap(([language, fields]) =>
        Object.entries(fields).map(([name, value]) => [
          `${name}_${language}`,
          value,
        ]),
      ),
    ),
  );
  const fieldValue = (name: string, language: string) => ({
    value: formValues[`${name}_${language}`] ?? "",
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormValues((current) => ({
        ...current,
        [event.target.name]: event.target.value,
      }));
      setDirtyVersion(state.editVersion);
    },
  });
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
      <form action={action} className="news-form">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="newsId" value={newsId} />
        <input type="hidden" name="editVersion" value={state.editVersion} />
        {revision.categoryIds.map((id) => (
          <input key={id} type="hidden" name="categoryId" value={id} />
        ))}
        <div className="news-language-grid">
          {(["ar", "en"] as const).map((language) => {
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
                  {...fieldValue("title", language)}
                />
                <label htmlFor={`summary_${language}`}>
                  {t("fields.summary")}
                </label>
                <textarea
                  id={`summary_${language}`}
                  name={`summary_${language}`}
                  rows={3}
                  {...fieldValue("summary", language)}
                />
                <label htmlFor={`body_${language}`}>{t("fields.body")}</label>
                <p className="news-hint" id={`body_hint_${language}`}>
                  {t("fields.bodyHint")}
                </p>
                <textarea
                  id={`body_${language}`}
                  name={`body_${language}`}
                  rows={9}
                  aria-describedby={`body_hint_${language}`}
                  {...fieldValue("body", language)}
                />
                <label htmlFor={`slug_${language}`}>{t("fields.slug")}</label>
                <input
                  id={`slug_${language}`}
                  name={`slug_${language}`}
                  dir="auto"
                  {...fieldValue("slug", language)}
                />
                <label htmlFor={`seoTitle_${language}`}>
                  {t("fields.seoTitle")}
                </label>
                <input
                  id={`seoTitle_${language}`}
                  name={`seoTitle_${language}`}
                  {...fieldValue("seoTitle", language)}
                />
                <label htmlFor={`seoDescription_${language}`}>
                  {t("fields.seoDescription")}
                </label>
                <textarea
                  id={`seoDescription_${language}`}
                  name={`seoDescription_${language}`}
                  rows={2}
                  {...fieldValue("seoDescription", language)}
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
      <form action={submit} className="news-actions">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="newsId" value={newsId} />
        <input type="hidden" name="editVersion" value={state.editVersion} />
        <button
          className="news-button"
          type="submit"
          disabled={dirty || pending || submitting}
        >
          {t("actions.submit")}
        </button>
        {submitState.error &&
          submitState.attemptedVersion === state.editVersion && (
            <p className="news-alert" role="alert">
              {t.has(`errors.${submitState.error}`)
                ? t(`errors.${submitState.error}`)
                : t("errors.generic")}
            </p>
          )}
      </form>
    </section>
  );
}
