"use client";

import { useActionState, useMemo, useState } from "react";

import {
  TaxonomyAdmin,
  type ReferenceFormState,
  type TaxonomyAdminMessages,
  type TaxonomyAdminRow,
  type TaxonomyFormAction,
} from "./taxonomy-admin";

function localizedError(
  code: string | null,
  errors: Readonly<Record<string, string>>,
) {
  if (code && Object.hasOwn(errors, code)) return errors[code];
  return errors.generic ?? code;
}

export function OrganizationAdmin({
  locale,
  sectionSlug,
  rows,
  canManage,
  messages,
  searchPlaceholder,
  createAction,
  updateAction,
  setActiveAction,
  deleteAction,
}: {
  locale: string;
  sectionSlug: string;
  rows: readonly TaxonomyAdminRow[];
  canManage: boolean;
  messages: TaxonomyAdminMessages & {
    searchLabel: string;
    searchHint: string;
    similarWarning: string;
    similarFoundTitle: string;
    acknowledgeSimilar: string;
    reviewMatches: string;
  };
  searchPlaceholder: string;
  searchResults?: readonly TaxonomyAdminRow[];
  createAction: TaxonomyFormAction;
  updateAction: TaxonomyFormAction;
  setActiveAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const comparable = query.trim().toLocaleLowerCase("en-US");
    if (!comparable) return rows;
    return rows.filter(
      (row) =>
        row.nameAr.toLocaleLowerCase("en-US").includes(comparable) ||
        row.nameEn.toLocaleLowerCase("en-US").includes(comparable),
    );
  }, [query, rows]);

  return (
    <div className="admin-form-section">
      <div className="ui-field">
        <label htmlFor="org-search">{messages.searchLabel}</label>
        <p className="news-muted" id="org-search-hint">
          {messages.searchHint}
        </p>
        <input
          id="org-search"
          className="ui-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-describedby="org-search-hint"
        />
      </div>
      <TaxonomyAdmin
        locale={locale}
        sectionSlug={sectionSlug}
        rows={filtered}
        canManage={canManage}
        messages={messages}
        createAction={createAction}
        updateAction={updateAction}
        setActiveAction={setActiveAction}
        deleteAction={deleteAction}
        renderCreateForm={(props) => (
          <OrganizationCreateForm {...props} extendedMessages={messages} />
        )}
      />
    </div>
  );
}

function OrganizationCreateForm({
  locale,
  sectionSlug,
  messages,
  extendedMessages,
  createAction,
  onCancel,
}: {
  locale: string;
  sectionSlug: string;
  messages: TaxonomyAdminMessages;
  extendedMessages: TaxonomyAdminMessages & {
    similarWarning: string;
    similarFoundTitle: string;
    acknowledgeSimilar: string;
    reviewMatches: string;
  };
  createAction: TaxonomyFormAction;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(createAction, {
    error: null,
  } satisfies ReferenceFormState);
  const [draft, setDraft] = useState({ nameAr: "", nameEn: "" });
  const [edited, setEdited] = useState(false);
  const nameAr =
    !edited && state.nameAr !== undefined ? state.nameAr : draft.nameAr;
  const nameEn =
    !edited && state.nameEn !== undefined ? state.nameEn : draft.nameEn;

  const similarPending = state.error === "SIMILAR_ORGANIZATION";

  return (
    <div className="admin-form-section">
      <form action={formAction}>
        <h3>{messages.createTitle}</h3>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="sectionSlug" value={sectionSlug} />
        {state.error && !similarPending && (
          <p className="ui-alert ui-alert-error" role="alert">
            {localizedError(state.error, messages.errors)}
          </p>
        )}
        <div className="ui-field">
          <label htmlFor="org_nameAr">{messages.nameAr}</label>
          <input
            id="org_nameAr"
            className="ui-input"
            name="nameAr"
            value={nameAr}
            onChange={(event) => {
              setEdited(true);
              setDraft((current) => ({
                ...current,
                nameAr: event.target.value,
              }));
            }}
            required
            dir="rtl"
            lang="ar"
          />
        </div>
        <div className="ui-field">
          <label htmlFor="org_nameEn">{messages.nameEn}</label>
          <input
            id="org_nameEn"
            className="ui-input"
            name="nameEn"
            value={nameEn}
            onChange={(event) => {
              setEdited(true);
              setDraft((current) => ({
                ...current,
                nameEn: event.target.value,
              }));
            }}
            required
            dir="ltr"
            lang="en"
          />
        </div>
        {!similarPending && (
          <div className="ui-action-group">
            <button
              type="submit"
              className="ui-button ui-button-primary"
              disabled={pending}
            >
              {messages.save}
            </button>
            <button
              type="button"
              className="ui-button ui-button-secondary"
              onClick={onCancel}
            >
              {messages.cancel}
            </button>
          </div>
        )}
      </form>
      {similarPending && (
        <div className="ui-alert ui-alert-warning" role="alert">
          <p>{extendedMessages.similarWarning}</p>
          {state.similarMatches && state.similarMatches.length > 0 && (
            <div className="admin-refdata-similar-list">
              <p className="admin-refdata-similar-title">
                {extendedMessages.similarFoundTitle}
              </p>
              <ul>
                {state.similarMatches.map((match) => (
                  <li key={`${match.nameAr}-${match.nameEn}`}>
                    <span dir="rtl" lang="ar">
                      {match.nameAr}
                    </span>
                    {" · "}
                    <span dir="ltr" lang="en">
                      {match.nameEn}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="ui-action-group">
            <form action={formAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="sectionSlug" value={sectionSlug} />
              <input type="hidden" name="nameAr" value={nameAr} />
              <input type="hidden" name="nameEn" value={nameEn} />
              <input type="hidden" name="acknowledgeSimilar" value="true" />
              <button
                type="submit"
                className="ui-button ui-button-secondary"
                disabled={pending}
              >
                {extendedMessages.acknowledgeSimilar}
              </button>
            </form>
            <button
              type="button"
              className="ui-button ui-button-secondary"
              onClick={onCancel}
            >
              {extendedMessages.reviewMatches}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
