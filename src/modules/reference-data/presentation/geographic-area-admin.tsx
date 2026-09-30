"use client";

import { useActionState, useMemo, useState } from "react";

import { ReferenceDataDeleteControl } from "./reference-data-governance";
import { ReferenceDataRowList } from "./reference-data-row-list";
import type { TaxonomyFormAction } from "./taxonomy-admin";

export type GeographicAdminRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  code: string | null;
  parentId: string | null;
  parentLabelEn: string | null;
  isActive: boolean;
  childCount: number;
};

export type GeographicAdminMessages = {
  nameAr: string;
  nameEn: string;
  code: string;
  parent: string;
  noParent: string;
  status: string;
  active: string;
  inactive: string;
  actions: string;
  create: string;
  save: string;
  cancel: string;
  activate: string;
  deactivate: string;
  delete: string;
  cannotDelete: string;
  createTitle: string;
  editTitle: string;
  dependencyBlocked: string;
  childDeleteBlocked: string;
  hierarchyPath: string;
  columnNameAr: string;
  columnNameEn: string;
  columnStatus: string;
  columnUsage: string;
  columnActions: string;
  edit: string;
  usageChildren: string;
  usageNone: string;
  errors: Readonly<Record<string, string>>;
};

function localizedError(
  code: string | null,
  errors: Readonly<Record<string, string>>,
) {
  if (code && Object.hasOwn(errors, code)) return errors[code];
  return errors.generic ?? code;
}

export function GeographicAreaAdmin({
  locale,
  sectionSlug,
  rows,
  canManage,
  messages,
  createAction,
  updateAction,
  setActiveAction,
  deleteAction,
}: {
  locale: string;
  sectionSlug: string;
  rows: readonly GeographicAdminRow[];
  canManage: boolean;
  messages: GeographicAdminMessages;
  createAction: TaxonomyFormAction;
  updateAction: TaxonomyFormAction;
  setActiveAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create">("list");
  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const parentOptions = rows.filter((row) => row.id !== selectedId);

  const rowColumns = {
    nameAr: messages.columnNameAr,
    nameEn: messages.columnNameEn,
    status: messages.columnStatus,
    active: messages.active,
    inactive: messages.inactive,
    usage: messages.columnUsage,
    usageNone: messages.usageNone,
    usageCount: messages.usageChildren,
    actions: messages.columnActions,
    edit: messages.edit,
  };

  const listRows = rows.map((row) => ({
    id: row.id,
    nameAr: row.nameAr,
    nameEn: row.code ? `${row.nameEn} · ${row.code}` : row.nameEn,
    isActive: row.isActive,
    usageDetail:
      row.childCount > 0
        ? messages.usageChildren.replace("{count}", String(row.childCount))
        : messages.usageNone,
  }));

  return (
    <div className="access-admin-layout">
      <div className="access-admin-list">
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
        <ReferenceDataRowList
          columns={rowColumns}
          rows={listRows}
          selectedId={selectedId}
          onSelect={(id) => {
            setMode("list");
            setSelectedId(id);
          }}
        />
      </div>
      <div className="access-admin-detail">
        {(mode === "create" || selected) && (
          <GeographicForm
            title={
              mode === "create" ? messages.createTitle : messages.editTitle
            }
            locale={locale}
            sectionSlug={sectionSlug}
            messages={messages}
            action={mode === "create" ? createAction : updateAction}
            initial={mode === "create" ? undefined : (selected ?? undefined)}
            parentOptions={parentOptions}
            onCancel={() => {
              setMode("list");
              setSelectedId(null);
            }}
          />
        )}
        {selected && canManage && (
          <div className="admin-form-section admin-refdata-governance">
            <p className="news-muted">
              {messages.hierarchyPath}:{" "}
              {selected.parentLabelEn ?? messages.noParent}
            </p>
            <h3>{messages.actions}</h3>
            <div className="ui-action-group admin-refdata-governance-actions">
              <form
                action={setActiveAction}
                className="admin-refdata-governance-action"
              >
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="sectionSlug" value={sectionSlug} />
                <input type="hidden" name="id" value={selected.id} />
                <input
                  type="hidden"
                  name="isActive"
                  value={selected.isActive ? "false" : "true"}
                />
                <button type="submit" className="ui-button ui-button-secondary">
                  {selected.isActive ? messages.deactivate : messages.activate}
                </button>
              </form>
              <ReferenceDataDeleteControl
                canDelete={selected.childCount === 0}
                blockedReason={
                  selected.childCount > 0 ? messages.childDeleteBlocked : null
                }
                deleteLabel={messages.delete}
                cannotDeleteLabel={messages.cannotDelete}
                locale={locale}
                sectionSlug={sectionSlug}
                id={selected.id}
                deleteAction={deleteAction}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GeographicForm({
  title,
  locale,
  sectionSlug,
  messages,
  action,
  initial,
  parentOptions,
  onCancel,
}: {
  title: string;
  locale: string;
  sectionSlug: string;
  messages: GeographicAdminMessages;
  action: TaxonomyFormAction;
  initial?: GeographicAdminRow;
  parentOptions: readonly GeographicAdminRow[];
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
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
        <label htmlFor="geo_nameAr">{messages.nameAr}</label>
        <input
          id="geo_nameAr"
          className="ui-input"
          name="nameAr"
          defaultValue={initial?.nameAr ?? ""}
          required
          dir="rtl"
          lang="ar"
        />
      </div>
      <div className="ui-field">
        <label htmlFor="geo_nameEn">{messages.nameEn}</label>
        <input
          id="geo_nameEn"
          className="ui-input"
          name="nameEn"
          defaultValue={initial?.nameEn ?? ""}
          required
          dir="ltr"
          lang="en"
        />
      </div>
      <div className="ui-field">
        <label htmlFor="geo_code">{messages.code}</label>
        <input
          id="geo_code"
          className="ui-input"
          name="code"
          defaultValue={initial?.code ?? ""}
        />
      </div>
      <div className="ui-field">
        <label htmlFor="geo_parent">{messages.parent}</label>
        <select
          id="geo_parent"
          className="ui-input"
          name="parentId"
          defaultValue={initial?.parentId ?? ""}
        >
          <option value="">{messages.noParent}</option>
          {parentOptions.map((row) => (
            <option key={row.id} value={row.id}>
              {row.nameEn}
            </option>
          ))}
        </select>
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
