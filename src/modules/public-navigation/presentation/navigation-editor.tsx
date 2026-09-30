"use client";

import type { ComponentType } from "react";
import { useActionState, useId, useMemo, useState } from "react";

import {
  canMoveItem,
  moveItem,
  nextSiblingOrder,
  removeNavigationItems,
  reparentItem,
  walkLocationTree,
} from "../domain/hierarchy";
import type {
  NavigationDraft,
  NavigationItemDraft,
  NavigationLocation,
} from "../domain/draft";
import { PUBLIC_SYSTEM_ROUTE_KEYS } from "../domain/system-routes";

import { NavigationActionBar } from "./navigation-action-bar";

export type NavigationEditorState = {
  error: string | null;
  saved: boolean;
  editVersion: number;
};

export type NavigationEditorAction = (
  state: NavigationEditorState,
  formData: FormData,
) => Promise<NavigationEditorState>;

export type NavigationPickerTarget = {
  id: string;
  title: string;
  isPubliclyAvailable: boolean;
};

export type NavigationEditorMessages = {
  saved: string;
  saving: string;
  save: string;
  submit: string;
  previewTitle: string;
  previewAr: string;
  previewEn: string;
  workflowTitle: string;
  locations: Record<NavigationLocation, string>;
  itemTypes: Record<string, string>;
  fields: Record<string, string>;
  tree: Record<string, string>;
  ui: {
    locationPickerLabel: string;
    locationContext: Record<NavigationLocation, string>;
    addItem: string;
    treeTitle: string;
    noSelection: string;
    draftRail: string;
  };
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

const ADD_ITEM_TYPES = [
  "GROUP",
  "SYSTEM_ROUTE",
  "CONTENT_ROUTE",
  "EXTERNAL_LINK",
] as const satisfies readonly NavigationItemDraft["itemType"][];

function newItemKey() {
  return crypto.randomUUID();
}

function displayLabel(item: NavigationItemDraft, locale: string) {
  const primary = locale === "en" ? item.labelEn : item.labelAr;
  const secondary = locale === "en" ? item.labelAr : item.labelEn;
  return primary.trim() || secondary.trim() || item.itemType;
}

function targetSummary(
  item: NavigationItemDraft,
  pageTargets: NavigationPickerTarget[],
  unavailableLabel: string,
): string | null {
  switch (item.itemType) {
    case "SYSTEM_ROUTE":
      return item.systemRouteKey.trim() || null;
    case "CONTENT_ROUTE": {
      const target = pageTargets.find((row) => row.id === item.contentTargetId);
      if (!target) return null;
      return target.isPubliclyAvailable
        ? target.title
        : `${target.title} (${unavailableLabel})`;
    }
    case "EXTERNAL_LINK":
      return item.externalUrl.trim() || null;
    default:
      return null;
  }
}

export function NavigationEditor({
  locale,
  previewRevision,
  publicationStatus,
  canEdit,
  canReview,
  canPublish,
  initialDraft,
  editVersion,
  workflowStatus,
  pageTargets,
  saveAction,
  submitAction,
  workflowAction,
  messages,
  ItemCountDisplay,
}: {
  locale: string;
  previewRevision: string | null;
  publicationStatus: string;
  canEdit: boolean;
  canReview: boolean;
  canPublish: boolean;
  initialDraft: NavigationDraft;
  editVersion: number;
  workflowStatus: string;
  pageTargets: NavigationPickerTarget[];
  saveAction: NavigationEditorAction;
  submitAction: (formData: FormData) => void | Promise<void>;
  workflowAction: (formData: FormData) => void | Promise<void>;
  messages: NavigationEditorMessages;
  ItemCountDisplay: ComponentType<{ count: number }>;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [location, setLocation] = useState<NavigationLocation>("MAIN");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuId = useId();
  const [state, save, saving] = useActionState(saveAction, {
    error: null,
    saved: false,
    editVersion,
  });
  const readOnly = !canEdit || workflowStatus !== "EDITING";
  const serialized = useMemo(() => JSON.stringify(draft), [draft]);
  const selected = draft.items.find((item) => item.itemKey === selectedKey);
  const visible = walkLocationTree(draft.items, location);

  function addItem(itemType: NavigationItemDraft["itemType"]) {
    const item: NavigationItemDraft = {
      itemKey: newItemKey(),
      location,
      itemType,
      parentItemKey: null,
      siblingOrder: nextSiblingOrder(draft.items, location, null),
      labelAr: "",
      labelEn: "",
      systemRouteKey: itemType === "SYSTEM_ROUTE" ? "NEWS" : "",
      contentTargetKind: itemType === "CONTENT_ROUTE" ? "MANAGED_PAGE" : "",
      contentTargetId: "",
      externalUrl: "",
    };
    setDraft({ items: [...draft.items, item] });
    setSelectedKey(item.itemKey);
    setAddMenuOpen(false);
  }

  function updateSelected(patch: Partial<NavigationItemDraft>) {
    if (!selectedKey) return;
    setDraft({
      items: draft.items.map((item) =>
        item.itemKey === selectedKey ? { ...item, ...patch } : item,
      ),
    });
  }

  function removeSelected() {
    if (!selectedKey) return;
    const removeKeys = new Set<string>();
    function collect(key: string) {
      removeKeys.add(key);
      for (const child of draft.items.filter(
        (item) => item.parentItemKey === key,
      )) {
        collect(child.itemKey);
      }
    }
    collect(selectedKey);
    setDraft({
      items: removeNavigationItems(draft.items, location, removeKeys),
    });
    setSelectedKey(null);
  }

  function shift(itemKey: string, direction: "up" | "down") {
    if (readOnly) return;
    try {
      const next = moveItem(draft.items, location, itemKey, direction);
      setDraft({ items: next });
    } catch {
      /* disabled at boundary */
    }
  }

  const parentGroups = draft.items.filter(
    (item) => item.location === location && item.itemType === "GROUP",
  );

  return (
    <div className="admin-editor-layout navigation-editor-layout">
      <section className="admin-editor-workspace navigation-editor-workspace">
        <section
          className="navigation-location-panel"
          aria-labelledby="navigation-location-heading"
        >
          <h2
            id="navigation-location-heading"
            className="navigation-panel-title"
          >
            {messages.ui.locationPickerLabel}
          </h2>
          <div
            className="navigation-location-segment"
            role="tablist"
            aria-label={messages.ui.locationPickerLabel}
          >
            {(["MAIN", "UTILITY", "FOOTER"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={location === tab}
                className={
                  location === tab
                    ? "navigation-location-segment-option is-active"
                    : "navigation-location-segment-option"
                }
                onClick={() => {
                  setLocation(tab);
                  setSelectedKey(null);
                  setAddMenuOpen(false);
                }}
              >
                {messages.locations[tab]}
              </button>
            ))}
          </div>
        </section>

        <header className="navigation-location-context">
          <div>
            <h3 className="navigation-context-title">
              {messages.ui.locationContext[location]}
            </h3>
            <ItemCountDisplay count={visible.length} />
          </div>
          {!readOnly ? (
            <div className="navigation-add-item">
              <button
                type="button"
                className="ui-button ui-button-secondary navigation-add-item-trigger"
                aria-expanded={addMenuOpen}
                aria-controls={addMenuId}
                aria-haspopup="menu"
                onClick={() => setAddMenuOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setAddMenuOpen(false);
                }}
              >
                + {messages.ui.addItem}
              </button>
              {addMenuOpen ? (
                <ul
                  id={addMenuId}
                  role="menu"
                  className="navigation-add-item-menu"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setAddMenuOpen(false);
                  }}
                >
                  {ADD_ITEM_TYPES.map((itemType) => (
                    <li key={itemType} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        className="navigation-add-item-option"
                        onClick={() => addItem(itemType)}
                      >
                        {messages.itemTypes[itemType]}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </header>

        <section
          className="navigation-tree-panel"
          aria-labelledby="navigation-tree-heading"
        >
          <h3 id="navigation-tree-heading" className="navigation-panel-title">
            {messages.ui.treeTitle}
          </h3>
          <ul className="navigation-tree-list">
            {visible.map((item) => {
              const summary = targetSummary(
                item,
                pageTargets,
                messages.tree.unavailable,
              );
              const isSelected = selectedKey === item.itemKey;
              return (
                <li
                  key={item.itemKey}
                  className={[
                    "navigation-tree-row",
                    item.itemType === "GROUP"
                      ? "navigation-tree-row--group"
                      : "",
                    isSelected ? "navigation-tree-row--selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-depth={item.depth}
                >
                  <span
                    className="navigation-tree-gutter"
                    aria-hidden
                    data-depth={item.depth}
                  />
                  <button
                    type="button"
                    className="navigation-tree-select"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedKey(item.itemKey)}
                  >
                    <span className="navigation-tree-main">
                      <span className="navigation-tree-label">
                        {displayLabel(item, locale)}
                      </span>
                      {summary ? (
                        <span className="navigation-tree-target">
                          {summary}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={
                        item.itemType === "GROUP"
                          ? "ui-badge ui-badge-neutral navigation-tree-type"
                          : "ui-badge navigation-tree-type"
                      }
                    >
                      {messages.itemTypes[item.itemType]}
                    </span>
                  </button>
                  {!readOnly ? (
                    <div className="navigation-tree-moves">
                      <button
                        type="button"
                        className="navigation-tree-move"
                        aria-label={messages.tree.moveUp}
                        disabled={
                          !canMoveItem(
                            draft.items,
                            location,
                            item.itemKey,
                            "up",
                          )
                        }
                        onClick={() => {
                          setSelectedKey(item.itemKey);
                          shift(item.itemKey, "up");
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="navigation-tree-move"
                        aria-label={messages.tree.moveDown}
                        disabled={
                          !canMoveItem(
                            draft.items,
                            location,
                            item.itemKey,
                            "down",
                          )
                        }
                        onClick={() => {
                          setSelectedKey(item.itemKey);
                          shift(item.itemKey, "down");
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section
          className="navigation-item-panel"
          aria-labelledby="navigation-item-editor-heading"
        >
          {selected ? (
            <div className="navigation-item-form">
              <h3 id="navigation-item-editor-heading">
                {messages.tree.editItem}
              </h3>
              <label className="ui-field">
                <span>{messages.fields.labelAr}</span>
                <input
                  className="ui-input"
                  value={selected.labelAr}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateSelected({ labelAr: event.target.value })
                  }
                />
              </label>
              <label className="ui-field">
                <span>{messages.fields.labelEn}</span>
                <input
                  className="ui-input"
                  value={selected.labelEn}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateSelected({ labelEn: event.target.value })
                  }
                />
              </label>
              <label className="ui-field">
                <span>{messages.fields.parentGroup}</span>
                <select
                  className="ui-input"
                  disabled={readOnly}
                  value={selected.parentItemKey ?? ""}
                  onChange={(event) => {
                    if (!selectedKey) return;
                    const parentValue = event.target.value || null;
                    try {
                      setDraft({
                        items: reparentItem(
                          draft.items,
                          location,
                          selectedKey,
                          parentValue,
                        ),
                      });
                    } catch {
                      /* keep current parent when move would break hierarchy */
                    }
                  }}
                >
                  <option value="">{messages.tree.rootLevel}</option>
                  {parentGroups
                    .filter((group) => group.itemKey !== selected.itemKey)
                    .map((group) => (
                      <option key={group.itemKey} value={group.itemKey}>
                        {displayLabel(group, locale)}
                      </option>
                    ))}
                </select>
              </label>
              {selected.itemType === "SYSTEM_ROUTE" ? (
                <label className="ui-field">
                  <span>{messages.fields.systemRouteKey}</span>
                  <select
                    className="ui-input"
                    disabled={readOnly}
                    value={selected.systemRouteKey}
                    onChange={(event) =>
                      updateSelected({ systemRouteKey: event.target.value })
                    }
                  >
                    {PUBLIC_SYSTEM_ROUTE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {selected.itemType === "CONTENT_ROUTE" ? (
                <label className="ui-field">
                  <span>{messages.fields.managedPage}</span>
                  <select
                    className="ui-input"
                    disabled={readOnly}
                    value={selected.contentTargetId}
                    onChange={(event) =>
                      updateSelected({ contentTargetId: event.target.value })
                    }
                  >
                    <option value="">{messages.tree.selectPage}</option>
                    {pageTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.title}
                        {!target.isPubliclyAvailable
                          ? ` (${messages.tree.unavailable})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {selected.itemType === "EXTERNAL_LINK" ? (
                <label className="ui-field">
                  <span>{messages.fields.externalUrl}</span>
                  <input
                    className="ui-input"
                    value={selected.externalUrl}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateSelected({ externalUrl: event.target.value })
                    }
                  />
                </label>
              ) : null}
              {!readOnly ? (
                <div className="navigation-item-danger">
                  <button
                    type="button"
                    className="ui-button ui-button-danger ui-button-compact"
                    onClick={removeSelected}
                  >
                    {messages.tree.removeItem}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="navigation-item-empty">{messages.ui.noSelection}</p>
          )}
        </section>
      </section>

      <aside className="admin-editor-rail navigation-editor-rail">
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

        {previewRevision ? (
          <section className="admin-rail-section">
            <h2 className="admin-rail-section-title">
              {messages.previewTitle}
            </h2>
            <div className="ui-action-group ui-action-group--stack">
              <a
                className="ui-button ui-button-secondary"
                href={`/${locale}/admin/preview/navigation/${previewRevision}`}
              >
                {messages.previewAr}
              </a>
              <a
                className="ui-button ui-button-secondary"
                href={`/en/admin/preview/navigation/${previewRevision}`}
              >
                {messages.previewEn}
              </a>
            </div>
          </section>
        ) : null}

        {!readOnly ? (
          <section className="admin-rail-section">
            <h2 className="admin-rail-section-title">
              {messages.ui.draftRail}
            </h2>
            <form action={save}>
              <input type="hidden" name="locale" value={locale} />
              <input
                type="hidden"
                name="editVersion"
                value={state.editVersion}
              />
              <input type="hidden" name="draft" value={serialized} readOnly />
              <div className="ui-action-group ui-action-group--stack">
                <button
                  className="ui-button ui-button-primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? messages.saving : messages.save}
                </button>
              </div>
            </form>
            <form action={submitAction} className="navigation-rail-submit">
              <input type="hidden" name="locale" value={locale} />
              <input
                type="hidden"
                name="editVersion"
                value={state.editVersion}
              />
              <input type="hidden" name="draft" value={serialized} readOnly />
              <div className="ui-action-group ui-action-group--stack">
                <button className="ui-button ui-button-secondary" type="submit">
                  {messages.submit}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="admin-rail-section">
          <h2 className="admin-rail-section-title">{messages.workflowTitle}</h2>
          <NavigationActionBar
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
      </aside>
    </div>
  );
}
