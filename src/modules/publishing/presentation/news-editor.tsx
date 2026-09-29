"use client";

import { useActionState, useState, type ChangeEvent } from "react";

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

export interface NewsEditorMessages {
  editorTitle: string;
  editorIntro: string;
  saved: string;
  saving: string;
  save: string;
  unsaved: string;
  submit: string;
  languages: { ar: string; en: string };
  fields: {
    title: string;
    summary: string;
    body: string;
    bodyHint: string;
    slug: string;
    seoTitle: string;
    seoDescription: string;
  };
  errors: Readonly<Record<string, string>>;
}

function localizedError(
  code: string | null,
  errors: Readonly<Record<string, string>>,
) {
  if (code && Object.hasOwn(errors, code)) return errors[code];
  return errors.generic;
}

export function NewsEditor({
  locale,
  newsId,
  revision,
  messages,
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
  messages: NewsEditorMessages;
  saveAction: NewsEditorAction;
  submitAction: NewsSubmitAction;
}) {
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
  const safeError = localizedError(state.error, messages.errors);
  return (
    <section className="news-editor" aria-labelledby="news-editor-title">
      <h2 id="news-editor-title">{messages.editorTitle}</h2>
      <p className="news-muted">{messages.editorIntro}</p>
      {state.error && (
        <p className="news-alert" role="alert">
          {safeError}
        </p>
      )}
      {state.saved && !state.error && !dirty && (
        <p className="news-success" role="status">
          {messages.saved}
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
                <legend>{messages.languages[language]}</legend>
                <label htmlFor={`title_${language}`}>
                  {messages.fields.title}
                </label>
                <input
                  id={`title_${language}`}
                  name={`title_${language}`}
                  {...fieldValue("title", language)}
                />
                <label htmlFor={`summary_${language}`}>
                  {messages.fields.summary}
                </label>
                <textarea
                  id={`summary_${language}`}
                  name={`summary_${language}`}
                  rows={3}
                  {...fieldValue("summary", language)}
                />
                <label htmlFor={`body_${language}`}>
                  {messages.fields.body}
                </label>
                <p className="news-hint" id={`body_hint_${language}`}>
                  {messages.fields.bodyHint}
                </p>
                <textarea
                  id={`body_${language}`}
                  name={`body_${language}`}
                  rows={9}
                  aria-describedby={`body_hint_${language}`}
                  {...fieldValue("body", language)}
                />
                <label htmlFor={`slug_${language}`}>
                  {messages.fields.slug}
                </label>
                <input
                  id={`slug_${language}`}
                  name={`slug_${language}`}
                  dir="auto"
                  {...fieldValue("slug", language)}
                />
                <label htmlFor={`seoTitle_${language}`}>
                  {messages.fields.seoTitle}
                </label>
                <input
                  id={`seoTitle_${language}`}
                  name={`seoTitle_${language}`}
                  {...fieldValue("seoTitle", language)}
                />
                <label htmlFor={`seoDescription_${language}`}>
                  {messages.fields.seoDescription}
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
          {pending ? messages.saving : messages.save}
        </button>
      </form>
      {dirty && (
        <p className="news-notice" role="status">
          {messages.unsaved}
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
          {messages.submit}
        </button>
        {submitState.error &&
          submitState.attemptedVersion === state.editVersion && (
            <p className="news-alert" role="alert">
              {localizedError(submitState.error, messages.errors)}
            </p>
          )}
      </form>
    </section>
  );
}
