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
  sections: { content: string; metadata: string; categories: string };
  languages: { ar: string; en: string };
  categories: {
    hint: string;
    inactiveAssigned: string;
    noneAvailable: string;
  };
  fields: {
    displayDate: string;
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

function LanguageFields({
  language,
  messages,
  fieldValue,
}: {
  language: "ar" | "en";
  messages: NewsEditorMessages;
  fieldValue: (
    name: string,
    language: string,
  ) => {
    value: string;
    onChange: (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => void;
  };
}) {
  return (
    <fieldset
      className="news-language"
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <legend>{messages.languages[language]}</legend>
      <div className="admin-form-section">
        <h3 className="admin-form-section-title">
          {messages.sections.content}
        </h3>
        <div className="ui-field">
          <label htmlFor={`title_${language}`}>{messages.fields.title}</label>
          <input
            id={`title_${language}`}
            className="ui-input"
            name={`title_${language}`}
            {...fieldValue("title", language)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor={`summary_${language}`}>
            {messages.fields.summary}
          </label>
          <textarea
            id={`summary_${language}`}
            className="ui-input"
            name={`summary_${language}`}
            rows={2}
            {...fieldValue("summary", language)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor={`body_${language}`}>{messages.fields.body}</label>
          <p className="news-hint" id={`body_hint_${language}`}>
            {messages.fields.bodyHint}
          </p>
          <textarea
            id={`body_${language}`}
            className="ui-input"
            name={`body_${language}`}
            rows={6}
            aria-describedby={`body_hint_${language}`}
            {...fieldValue("body", language)}
          />
        </div>
      </div>
      <div className="admin-form-section">
        <h3 className="admin-form-section-title">
          {messages.sections.metadata}
        </h3>
        <div className="ui-field">
          <label htmlFor={`slug_${language}`}>{messages.fields.slug}</label>
          <input
            id={`slug_${language}`}
            className="ui-input"
            name={`slug_${language}`}
            dir="auto"
            {...fieldValue("slug", language)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor={`seoTitle_${language}`}>
            {messages.fields.seoTitle}
          </label>
          <input
            id={`seoTitle_${language}`}
            className="ui-input"
            name={`seoTitle_${language}`}
            {...fieldValue("seoTitle", language)}
          />
        </div>
        <div className="ui-field">
          <label htmlFor={`seoDescription_${language}`}>
            {messages.fields.seoDescription}
          </label>
          <textarea
            id={`seoDescription_${language}`}
            className="ui-input"
            name={`seoDescription_${language}`}
            rows={2}
            {...fieldValue("seoDescription", language)}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function NewsEditor({
  locale,
  newsId,
  revision,
  messages,
  saveAction,
  submitAction,
  categoryOptions,
}: {
  locale: string;
  newsId: string;
  categoryOptions: readonly {
    id: string;
    nameAr: string;
    nameEn: string;
    isActive: boolean;
  }[];
  revision: {
    editVersion: number;
    categoryIds: string[];
    displayDate: string;
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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    () => [...revision.categoryIds],
  );
  const selectable = categoryOptions.filter(
    (option) => option.isActive || revision.categoryIds.includes(option.id),
  );
  const [formValues, setFormValues] = useState<Record<string, string>>(() => ({
    displayDate: revision.displayDate,
    ...Object.fromEntries(
      Object.entries(revision.translations).flatMap(([language, fields]) =>
        Object.entries(fields).map(([name, value]) => [
          `${name}_${language}`,
          value,
        ]),
      ),
    ),
  }));
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
      <div className="admin-editor-layout">
        <div className="admin-editor-main admin-editor-block">
          <div className="admin-editor-section">
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
              <input
                type="hidden"
                name="editVersion"
                value={state.editVersion}
              />
              {selectedCategoryIds.map((id) => (
                <input key={id} type="hidden" name="categoryId" value={id} />
              ))}
              <div className="admin-form-section">
                <h3 className="admin-form-section-title">
                  {messages.sections.metadata}
                </h3>
                <div className="ui-field">
                  <label htmlFor="displayDate">
                    {messages.fields.displayDate}
                  </label>
                  <input
                    id="displayDate"
                    className="ui-input"
                    type="date"
                    name="displayDate"
                    value={formValues.displayDate ?? ""}
                    onChange={(event) => {
                      setFormValues((current) => ({
                        ...current,
                        displayDate: event.target.value,
                      }));
                      setDirtyVersion(state.editVersion);
                    }}
                  />
                </div>
              </div>
              <div className="admin-form-section">
                <h3 className="admin-form-section-title">
                  {messages.sections.categories}
                </h3>
                <p className="news-muted">{messages.categories.hint}</p>
                {selectable.length === 0 ? (
                  <p className="news-muted">
                    {messages.categories.noneAvailable}
                  </p>
                ) : (
                  <ul className="news-category-list">
                    {selectable.map((option) => {
                      const checked = selectedCategoryIds.includes(option.id);
                      const inactiveAssigned =
                        !option.isActive &&
                        revision.categoryIds.includes(option.id);
                      const label =
                        locale === "ar" ? option.nameAr : option.nameEn;
                      return (
                        <li key={option.id}>
                          <label
                            className={`news-category-row${checked ? " news-category-row--selected" : ""}${!option.isActive && !revision.categoryIds.includes(option.id) ? " news-category-row--disabled" : ""}`}
                          >
                            <input
                              type="checkbox"
                              className="news-category-checkbox"
                              name={`category_toggle_${option.id}`}
                              checked={checked}
                              disabled={
                                !option.isActive &&
                                !revision.categoryIds.includes(option.id)
                              }
                              onChange={(event) => {
                                setSelectedCategoryIds((current) => {
                                  if (event.target.checked) {
                                    return [
                                      ...new Set([...current, option.id]),
                                    ];
                                  }
                                  return current.filter(
                                    (id) => id !== option.id,
                                  );
                                });
                                setDirtyVersion(state.editVersion);
                              }}
                            />
                            <span className="news-category-row-label">
                              {label}
                            </span>
                            {inactiveAssigned && checked && (
                              <span className="ui-badge ui-badge-neutral">
                                {messages.categories.inactiveAssigned}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="news-language-grid">
                {(["ar", "en"] as const).map((language) => (
                  <LanguageFields
                    key={language}
                    language={language}
                    messages={messages}
                    fieldValue={fieldValue}
                  />
                ))}
              </div>
              <div className="ui-action-group">
                <button
                  className="ui-button ui-button-primary"
                  type="submit"
                  disabled={pending}
                >
                  {pending ? messages.saving : messages.save}
                </button>
              </div>
            </form>
          </div>
        </div>
        <aside
          className="admin-editor-rail admin-editor-block"
          aria-labelledby="news-editor-rail"
        >
          <h2 id="news-editor-rail">{messages.submit}</h2>
          {dirty && (
            <p className="news-notice" role="status">
              {messages.unsaved}
            </p>
          )}
          <form action={submit}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="newsId" value={newsId} />
            <input type="hidden" name="editVersion" value={state.editVersion} />
            <input
              type="hidden"
              name="displayDate"
              value={formValues.displayDate ?? ""}
            />
            <div className="ui-action-group ui-action-group--stack">
              <button
                className="ui-button ui-button-secondary"
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
            </div>
          </form>
        </aside>
      </div>
    </section>
  );
}
