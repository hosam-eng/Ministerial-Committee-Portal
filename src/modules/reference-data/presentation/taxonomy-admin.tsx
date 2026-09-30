"use client";

import { useActionState, useMemo, useState } from "react";

import { ReferenceDataDeleteControl } from "./reference-data-governance";
import { ReferenceDataRowList } from "./reference-data-row-list";

export type TaxonomyAdminRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  referenceCount?: number;
};

export type ReferenceFormState = {
  error: string | null;
  nameAr?: string;
  nameEn?: string;
  similarMatches?: { nameAr: string; nameEn: string }[];
};

export type TaxonomyAdminMessages = {
  nameAr: string;
  nameEn: string;
  status: string;
  active: string;
  inactive: string;
  references: string;
  noReferences: string;
  usageCount: string;
  columnNameAr: string;
  columnNameEn: string;
  columnStatus: string;
  columnUsage: string;
  columnActions: string;
  actions: string;
  edit: string;
  save: string;
  cancel: string;
  create: string;
  activate: string;
  deactivate: string;
  delete: string;
  cannotDelete: string;
  createTitle: string;
  editTitle: string;
  dependencyBlocked: string;
  errors: Readonly<Record<string, string>>;
};

export type TaxonomyFormAction = (
  state: ReferenceFormState,
  formData: FormData,
) => Promise<ReferenceFormState>;

function localizedError(
  code: string | null,
  errors: Readonly<Record<string, string>>,
) {
  if (code && Object.hasOwn(errors, code)) return errors[code];
  return errors.generic ?? code;
}

export function TaxonomyAdmin({
  locale,
  sectionSlug,
  rows,
  canManage,
  messages,
  createAction,
  updateAction,
  setActiveAction,
  deleteAction,
  renderCreateForm,
}: {
  locale: string;
  sectionSlug: string;
  rows: readonly TaxonomyAdminRow[];
  canManage: boolean;
  messages: TaxonomyAdminMessages;
  createAction: TaxonomyFormAction;
  updateAction: TaxonomyFormAction;
  setActiveAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  renderCreateForm?: (props: {
    locale: string;
    sectionSlug: string;
    messages: TaxonomyAdminMessages;
    createAction: TaxonomyFormAction;
    onCancel: () => void;
  }) => React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create">("list");
  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const rowColumns = {
    nameAr: messages.columnNameAr,
    nameEn: messages.columnNameEn,
    status: messages.columnStatus,
    active: messages.active,
    inactive: messages.inactive,
    usage: messages.columnUsage,
    usageNone: messages.noReferences,
    usageCount: messages.usageCount,
    actions: messages.columnActions,
    edit: messages.edit,
  };

  return (
    <div className="access-admin-layout">
      <div className="access-admin-list">
        <div className="access-admin-list-header">
          {canManage && (
            <button
              type="button"
              className="ui-button ui-button-primary"
              onClick={() => {
                setMode("create");
                setSelectedId(null);
              }}
            >
              {messages.create}
            </button>
          )}
        </div>
        <ReferenceDataRowList
          columns={rowColumns}
          rows={rows}
          selectedId={selectedId}
          onSelect={(id) => {
            setMode("list");
            setSelectedId(id);
          }}
        />
      </div>
      <div className="access-admin-detail">
        {mode === "create" &&
          canManage &&
          (renderCreateForm ? (
            renderCreateForm({
              locale,
              sectionSlug,
              messages,
              createAction,
              onCancel: () => setMode("list"),
            })
          ) : (
            <TaxonomyForm
              title={messages.createTitle}
              locale={locale}
              sectionSlug={sectionSlug}
              messages={messages}
              action={createAction}
              onCancel={() => setMode("list")}
            />
          ))}
        {mode === "list" && selected && (
          <>
            {canManage ? (
              <TaxonomyForm
                title={messages.editTitle}
                locale={locale}
                sectionSlug={sectionSlug}
                messages={messages}
                action={updateAction}
                initial={selected}
                onCancel={() => setSelectedId(null)}
              />
            ) : (
              <TaxonomyReadonly row={selected} messages={messages} />
            )}
            <TaxonomyGovernance
              locale={locale}
              sectionSlug={sectionSlug}
              row={selected}
              canManage={canManage}
              messages={messages}
              setActiveAction={setActiveAction}
              deleteAction={deleteAction}
            />
          </>
        )}
      </div>
    </div>
  );
}

function TaxonomyReadonly({
  row,
  messages,
}: {
  row: TaxonomyAdminRow;
  messages: TaxonomyAdminMessages;
}) {
  return (
    <div className="admin-form-section">
      <p>
        <strong>{messages.nameAr}:</strong> {row.nameAr}
      </p>
      <p>
        <strong>{messages.nameEn}:</strong> {row.nameEn}
      </p>
      <p>
        <strong>{messages.status}:</strong>{" "}
        {row.isActive ? messages.active : messages.inactive}
      </p>
    </div>
  );
}

function TaxonomyForm({
  title,
  locale,
  sectionSlug,
  messages,
  action,
  initial,
  onCancel,
  preservedValues,
}: {
  title: string;
  locale: string;
  sectionSlug: string;
  messages: TaxonomyAdminMessages;
  action: TaxonomyFormAction;
  initial?: TaxonomyAdminRow;
  onCancel?: () => void;
  preservedValues?: { nameAr: string; nameEn: string };
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
  });
  const [draft, setDraft] = useState({
    nameAr: preservedValues?.nameAr ?? initial?.nameAr ?? "",
    nameEn: preservedValues?.nameEn ?? initial?.nameEn ?? "",
  });
  const [edited, setEdited] = useState(false);
  const nameAr =
    !edited && state.nameAr !== undefined ? state.nameAr : draft.nameAr;
  const nameEn =
    !edited && state.nameEn !== undefined ? state.nameEn : draft.nameEn;

  return (
    <form action={formAction} className="admin-form-section">
      <h3>{title}</h3>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="sectionSlug" value={sectionSlug} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {state.error && (
        <p className="ui-alert ui-alert-error" role="alert">
          {localizedError(state.error, messages.errors)}
        </p>
      )}
      <div className="ui-field">
        <label htmlFor="nameAr">{messages.nameAr}</label>
        <input
          id="nameAr"
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
        <label htmlFor="nameEn">{messages.nameEn}</label>
        <input
          id="nameEn"
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
      <div className="ui-action-group">
        <button
          type="submit"
          className="ui-button ui-button-primary"
          disabled={pending}
        >
          {messages.save}
        </button>
        {onCancel && (
          <button
            type="button"
            className="ui-button ui-button-secondary"
            onClick={onCancel}
          >
            {messages.cancel}
          </button>
        )}
      </div>
    </form>
  );
}

function TaxonomyGovernance({
  locale,
  sectionSlug,
  row,
  canManage,
  messages,
  setActiveAction,
  deleteAction,
}: {
  locale: string;
  sectionSlug: string;
  row: TaxonomyAdminRow;
  canManage: boolean;
  messages: TaxonomyAdminMessages;
  setActiveAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  if (!canManage) return null;
  const referenceCount = row.referenceCount ?? 0;
  const canDelete = referenceCount === 0;
  const blockedReason =
    referenceCount > 0
      ? messages.references.replace("{count}", String(referenceCount))
      : null;

  return (
    <div className="admin-form-section admin-refdata-governance">
      <h3>{messages.actions}</h3>
      <div className="ui-action-group admin-refdata-governance-actions">
        <form
          action={setActiveAction}
          className="admin-refdata-governance-action"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="sectionSlug" value={sectionSlug} />
          <input type="hidden" name="id" value={row.id} />
          <input
            type="hidden"
            name="isActive"
            value={row.isActive ? "false" : "true"}
          />
          <button type="submit" className="ui-button ui-button-secondary">
            {row.isActive ? messages.deactivate : messages.activate}
          </button>
        </form>
        <ReferenceDataDeleteControl
          canDelete={canDelete}
          blockedReason={blockedReason}
          deleteLabel={messages.delete}
          cannotDeleteLabel={messages.cannotDelete}
          locale={locale}
          sectionSlug={sectionSlug}
          id={row.id}
          deleteAction={deleteAction}
        />
      </div>
    </div>
  );
}

export { TaxonomyForm };
