"use client";

import { useActionState, useState } from "react";

import {
  CALLOUT_VARIANTS,
  type BlockDraft,
  type BlockLocaleContent,
  type BlockType,
  type CalloutVariant,
  type ManagedPageDraft,
  type TranslationDraft,
} from "../domain/draft";
import { createUuidV7 } from "../domain/ids";
import type { ManagedPageLocale } from "../domain/locales";
import { emptyRichTextDocument } from "../domain/rich-text-document";
import {
  RichTextEditor,
  type RichTextEditorLabels,
} from "./rich-text/RichTextEditor";

export type ManagedPageEditorState = {
  error: string | null;
  saved: boolean;
  editVersion: number;
};

export type ManagedPageEditorAction = (
  state: ManagedPageEditorState,
  formData: FormData,
) => Promise<ManagedPageEditorState>;

const EMPTY_TRANSLATION: TranslationDraft = {
  title: "",
  slug: "",
  intro: null,
  seoTitle: null,
  seoDescription: null,
};

function localeContent(type: BlockType): BlockLocaleContent {
  return {
    document: type === "RICHTEXT" ? emptyRichTextDocument() : null,
    title: null,
    body: type === "CALLOUT" ? "" : null,
    heading: null,
    labels: {},
  };
}

function withShells(draft: ManagedPageDraft): ManagedPageDraft {
  return {
    translations: {
      ar: draft.translations.ar ?? { ...EMPTY_TRANSLATION },
      en: draft.translations.en ?? { ...EMPTY_TRANSLATION },
    },
    blocks: draft.blocks.map((block) => ({
      ...block,
      content: {
        ar: block.content.ar ?? localeContent(block.type),
        en: block.content.en ?? localeContent(block.type),
      },
    })),
  };
}

export type ManagedPageEditorMessages = {
  editorTitle: string;
  editorIntro: string;
  saved: string;
  saving: string;
  save: string;
  unsaved: string;
  submit: string;
  structure: string;
  addRichText: string;
  addCallout: string;
  addLinkList: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  blocks: Record<BlockType, string>;
  variants: Record<CalloutVariant, string>;
  variant: string;
  addItem: string;
  itemTarget: string;
  externalUrl: string;
  internalPage: string;
  languages: { ar: string; en: string };
  fields: {
    title: string;
    intro: string;
    slug: string;
    seoTitle: string;
    seoDescription: string;
    calloutTitle: string;
    calloutBody: string;
    linkHeading: string;
    linkLabel: string;
  };
  richText: RichTextEditorLabels;
  errors: Readonly<Record<string, string>>;
};

export function ManagedPageEditor({
  locale,
  pageId,
  editVersion,
  draft,
  pages,
  messages,
  saveAction,
  submitAction,
}: {
  locale: string;
  pageId: string;
  editVersion: number;
  draft: ManagedPageDraft;
  pages: readonly { id: string; label: string }[];
  messages: ManagedPageEditorMessages;
  saveAction: ManagedPageEditorAction;
  submitAction: ManagedPageEditorAction;
}) {
  const [state, save, pending] = useActionState(saveAction, {
    error: null,
    saved: false,
    editVersion,
  });
  const [submitState, submit, submitting] = useActionState(submitAction, {
    error: null,
    saved: false,
    editVersion,
  });
  const [value, setValue] = useState(() => withShells(draft));
  const [dirtyVersion, setDirtyVersion] = useState<number | null>(null);
  const [tab, setTab] = useState<ManagedPageLocale>(
    locale === "en" ? "en" : "ar",
  );
  const dirty = dirtyVersion === state.editVersion;
  const errorCode = state.error ?? submitState.error;
  const error = errorCode
    ? (messages.errors[errorCode] ?? messages.errors.generic)
    : null;
  const markDirty = (
    recipe: (current: ManagedPageDraft) => ManagedPageDraft,
  ) => {
    setValue(recipe);
    setDirtyVersion(state.editVersion);
  };
  const updateTranslation = (
    language: ManagedPageLocale,
    patch: Partial<TranslationDraft>,
  ) => {
    markDirty((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [language]: {
          ...(current.translations[language] ?? EMPTY_TRANSLATION),
          ...patch,
        },
      },
    }));
  };
  const updateBlock = (
    id: string,
    patch: (block: BlockDraft) => BlockDraft,
  ) => {
    markDirty((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === id ? patch(block) : block,
      ),
    }));
  };
  const moveBlock = (index: number, delta: number) => {
    markDirty((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.blocks.length) return current;
      const blocks = [...current.blocks];
      const [item] = blocks.splice(index, 1);
      blocks.splice(target, 0, item!);
      return { ...current, blocks };
    });
  };
  const addBlock = (type: BlockType) => {
    const block: BlockDraft = {
      id: createUuidV7(),
      type,
      calloutVariant: type === "CALLOUT" ? "institutional" : null,
      linkItems: [],
      content: { ar: localeContent(type), en: localeContent(type) },
    };
    markDirty((current) => ({
      ...current,
      blocks: [...current.blocks, block],
    }));
  };
  return (
    <section
      className="news-editor"
      aria-labelledby="managed-page-editor-title"
    >
      <div className="admin-editor-layout">
        <div className="admin-editor-main admin-editor-block">
          <div className="admin-editor-section">
            <h2 id="managed-page-editor-title">{messages.editorTitle}</h2>
            <p className="news-muted">{messages.editorIntro}</p>
            {error && (
              <p className="news-alert" role="alert">
                {error}
              </p>
            )}
            {state.saved && !state.error && !dirty && (
              <p className="news-success" role="status">
                {messages.saved}
              </p>
            )}
            <h3 className="admin-form-section-title">{messages.structure}</h3>
            <div className="managed-block-toolbar ui-action-group">
              <button
                type="button"
                className="ui-button ui-button-secondary ui-button-compact"
                onClick={() => addBlock("RICHTEXT")}
              >
                {messages.addRichText}
              </button>
              <button
                type="button"
                className="ui-button ui-button-secondary ui-button-compact"
                onClick={() => addBlock("CALLOUT")}
              >
                {messages.addCallout}
              </button>
              <button
                type="button"
                className="ui-button ui-button-secondary ui-button-compact"
                onClick={() => addBlock("LINK_LIST")}
              >
                {messages.addLinkList}
              </button>
            </div>
            <ol className="managed-block-list" aria-label={messages.structure}>
              {value.blocks.map((block, index) => (
                <li
                  key={block.id}
                  className="admin-controlled-block"
                  onKeyDown={(event) => {
                    const target = event.target;
                    if (!(target instanceof HTMLElement)) return;
                    if (
                      target.closest(
                        "input, textarea, select, [contenteditable='true']",
                      )
                    )
                      return;
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      moveBlock(index, -1);
                    }
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      moveBlock(index, 1);
                    }
                  }}
                >
                  <div className="admin-controlled-block-header">
                    <strong>{messages.blocks[block.type]}</strong>
                    <div className="ui-action-group">
                      <button
                        type="button"
                        className="ui-button ui-button-secondary ui-button-compact"
                        onClick={() => moveBlock(index, -1)}
                        disabled={index === 0}
                      >
                        {messages.moveUp}
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button-secondary ui-button-compact"
                        onClick={() => moveBlock(index, 1)}
                        disabled={index === value.blocks.length - 1}
                      >
                        {messages.moveDown}
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button-danger ui-button-compact"
                        onClick={() =>
                          markDirty((current) => ({
                            ...current,
                            blocks: current.blocks.filter(
                              (item) => item.id !== block.id,
                            ),
                          }))
                        }
                      >
                        {messages.remove}
                      </button>
                    </div>
                  </div>
                  {block.type === "CALLOUT" && (
                    <label>
                      {messages.variant}
                      <select
                        value={block.calloutVariant ?? "institutional"}
                        onChange={(event) =>
                          updateBlock(block.id, (current) => ({
                            ...current,
                            calloutVariant: event.target
                              .value as CalloutVariant,
                          }))
                        }
                      >
                        {CALLOUT_VARIANTS.map((variant) => (
                          <option key={variant} value={variant}>
                            {messages.variants[variant]}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {block.type === "LINK_LIST" && (
                    <div>
                      {block.linkItems.map((item, itemIndex) => (
                        <div key={item.id} className="managed-link-item">
                          <label>
                            {messages.itemTarget}
                            <select
                              value={item.kind}
                              onChange={(event) => {
                                const kind =
                                  event.target.value === "internal"
                                    ? "internal"
                                    : "external";
                                updateBlock(block.id, (current) => ({
                                  ...current,
                                  linkItems: current.linkItems.map((entry) =>
                                    entry.id === item.id
                                      ? {
                                          ...entry,
                                          kind,
                                          href: null,
                                          targetRef: null,
                                        }
                                      : entry,
                                  ),
                                }));
                              }}
                            >
                              <option value="external">
                                {messages.fields.linkLabel}
                              </option>
                              <option value="internal">
                                {messages.internalPage}
                              </option>
                            </select>
                          </label>
                          {item.kind === "external" ? (
                            <label>
                              {messages.externalUrl}
                              <input
                                value={item.href ?? ""}
                                onChange={(event) =>
                                  updateBlock(block.id, (current) => ({
                                    ...current,
                                    linkItems: current.linkItems.map((entry) =>
                                      entry.id === item.id
                                        ? {
                                            ...entry,
                                            href: event.target.value,
                                            targetRef: null,
                                          }
                                        : entry,
                                    ),
                                  }))
                                }
                              />
                            </label>
                          ) : (
                            <label>
                              {messages.internalPage}
                              <select
                                value={item.targetRef ?? ""}
                                onChange={(event) =>
                                  updateBlock(block.id, (current) => ({
                                    ...current,
                                    linkItems: current.linkItems.map((entry) =>
                                      entry.id === item.id
                                        ? {
                                            ...entry,
                                            targetRef: event.target.value,
                                            href: null,
                                          }
                                        : entry,
                                    ),
                                  }))
                                }
                              >
                                <option value="" />
                                {pages.map((page) => (
                                  <option key={page.id} value={page.id}>
                                    {page.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <button
                            type="button"
                            className="ui-button ui-button-secondary ui-button-compact"
                            onClick={() => moveItem(block, itemIndex, -1)}
                            disabled={itemIndex === 0}
                          >
                            {messages.moveUp}
                          </button>
                          <button
                            type="button"
                            className="ui-button ui-button-secondary ui-button-compact"
                            onClick={() => moveItem(block, itemIndex, 1)}
                            disabled={itemIndex === block.linkItems.length - 1}
                          >
                            {messages.moveDown}
                          </button>
                          <button
                            type="button"
                            className="ui-button ui-button-danger ui-button-compact"
                            onClick={() =>
                              updateBlock(block.id, (current) => ({
                                ...current,
                                linkItems: current.linkItems.filter(
                                  (entry) => entry.id !== item.id,
                                ),
                              }))
                            }
                          >
                            {messages.remove}
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="ui-button ui-button-secondary ui-button-compact"
                        onClick={() =>
                          updateBlock(block.id, (current) => ({
                            ...current,
                            linkItems: [
                              ...current.linkItems,
                              {
                                id: createUuidV7(),
                                kind: "external",
                                href: null,
                                targetRef: null,
                              },
                            ],
                          }))
                        }
                      >
                        {messages.addItem}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <div
              className="managed-locale-tabs ui-action-group"
              role="tablist"
              aria-label={messages.editorTitle}
            >
              {(["ar", "en"] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  role="tab"
                  id={`tab-${language}`}
                  aria-selected={tab === language}
                  aria-controls={`panel-${language}`}
                  className="ui-button ui-button-secondary ui-button-compact"
                  onClick={() => setTab(language)}
                >
                  {messages.languages[language]}
                </button>
              ))}
            </div>
            <form action={save} className="news-form">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="pageId" value={pageId} />
              <input
                type="hidden"
                name="editVersion"
                value={state.editVersion}
              />
              <input type="hidden" name="draft" value={JSON.stringify(value)} />
              {(["ar", "en"] as const).map((language) => {
                const translation =
                  value.translations[language] ?? EMPTY_TRANSLATION;
                const hidden = tab !== language;
                return (
                  <div
                    key={language}
                    id={`panel-${language}`}
                    role="tabpanel"
                    aria-labelledby={`tab-${language}`}
                    hidden={hidden}
                    lang={language}
                    dir={language === "ar" ? "rtl" : "ltr"}
                  >
                    <label htmlFor={`title_${language}`}>
                      {messages.fields.title}
                    </label>
                    <input
                      id={`title_${language}`}
                      value={translation.title}
                      onChange={(event) =>
                        updateTranslation(language, {
                          title: event.target.value,
                        })
                      }
                    />
                    <label htmlFor={`intro_${language}`}>
                      {messages.fields.intro}
                    </label>
                    <textarea
                      id={`intro_${language}`}
                      rows={3}
                      value={translation.intro ?? ""}
                      onChange={(event) =>
                        updateTranslation(language, {
                          intro: event.target.value,
                        })
                      }
                    />
                    <label htmlFor={`slug_${language}`}>
                      {messages.fields.slug}
                    </label>
                    <input
                      id={`slug_${language}`}
                      dir="auto"
                      value={translation.slug}
                      onChange={(event) =>
                        updateTranslation(language, {
                          slug: event.target.value,
                        })
                      }
                    />
                    <label htmlFor={`seoTitle_${language}`}>
                      {messages.fields.seoTitle}
                    </label>
                    <input
                      id={`seoTitle_${language}`}
                      value={translation.seoTitle ?? ""}
                      onChange={(event) =>
                        updateTranslation(language, {
                          seoTitle: event.target.value,
                        })
                      }
                    />
                    <label htmlFor={`seoDescription_${language}`}>
                      {messages.fields.seoDescription}
                    </label>
                    <textarea
                      id={`seoDescription_${language}`}
                      rows={2}
                      value={translation.seoDescription ?? ""}
                      onChange={(event) =>
                        updateTranslation(language, {
                          seoDescription: event.target.value,
                        })
                      }
                    />
                    {value.blocks.map((block) => {
                      const content =
                        block.content[language] ?? localeContent(block.type);
                      if (block.type === "RICHTEXT") {
                        return hidden ? null : (
                          <RichTextEditor
                            key={`${block.id}-${language}`}
                            id={`${block.id}-${language}`}
                            locale={language}
                            value={content.document ?? emptyRichTextDocument()}
                            pages={pages}
                            labels={messages.richText}
                            onChange={(document) =>
                              updateBlock(block.id, (current) => {
                                const localized =
                                  current.content[language] ??
                                  localeContent(block.type);
                                return {
                                  ...current,
                                  content: {
                                    ...current.content,
                                    [language]: { ...localized, document },
                                  },
                                };
                              })
                            }
                          />
                        );
                      }
                      if (block.type === "CALLOUT") {
                        return (
                          <fieldset key={block.id}>
                            <legend>{messages.blocks.CALLOUT}</legend>
                            <label
                              htmlFor={`callout_title_${block.id}_${language}`}
                            >
                              {messages.fields.calloutTitle}
                            </label>
                            <input
                              id={`callout_title_${block.id}_${language}`}
                              value={content.title ?? ""}
                              onChange={(event) =>
                                updateBlock(block.id, (current) => ({
                                  ...current,
                                  content: {
                                    ...current.content,
                                    [language]: {
                                      ...content,
                                      title: event.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                            <label
                              htmlFor={`callout_body_${block.id}_${language}`}
                            >
                              {messages.fields.calloutBody}
                            </label>
                            <textarea
                              id={`callout_body_${block.id}_${language}`}
                              rows={3}
                              value={content.body ?? ""}
                              onChange={(event) =>
                                updateBlock(block.id, (current) => ({
                                  ...current,
                                  content: {
                                    ...current.content,
                                    [language]: {
                                      ...content,
                                      body: event.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </fieldset>
                        );
                      }
                      return (
                        <fieldset key={block.id}>
                          <legend>{messages.blocks.LINK_LIST}</legend>
                          <label
                            htmlFor={`link_heading_${block.id}_${language}`}
                          >
                            {messages.fields.linkHeading}
                          </label>
                          <input
                            id={`link_heading_${block.id}_${language}`}
                            value={content.heading ?? ""}
                            onChange={(event) =>
                              updateBlock(block.id, (current) => ({
                                ...current,
                                content: {
                                  ...current.content,
                                  [language]: {
                                    ...content,
                                    heading: event.target.value,
                                  },
                                },
                              }))
                            }
                          />
                          {block.linkItems.map((item, itemIndex) => (
                            <label
                              key={item.id}
                              htmlFor={`link_label_${item.id}_${language}`}
                            >
                              {messages.fields.linkLabel} {itemIndex + 1}
                              <input
                                id={`link_label_${item.id}_${language}`}
                                value={content.labels[item.id] ?? ""}
                                onChange={(event) =>
                                  updateBlock(block.id, (current) => ({
                                    ...current,
                                    content: {
                                      ...current.content,
                                      [language]: {
                                        ...content,
                                        labels: {
                                          ...content.labels,
                                          [item.id]: event.target.value,
                                        },
                                      },
                                    },
                                  }))
                                }
                              />
                            </label>
                          ))}
                        </fieldset>
                      );
                    })}
                  </div>
                );
              })}
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
          aria-labelledby="managed-page-editor-rail"
        >
          <h2 id="managed-page-editor-rail">{messages.submit}</h2>
          {dirty && (
            <p className="news-notice" role="status">
              {messages.unsaved}
            </p>
          )}
          <form action={submit}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="pageId" value={pageId} />
            <input type="hidden" name="editVersion" value={state.editVersion} />
            <div className="ui-action-group ui-action-group--stack">
              <button
                className="ui-button ui-button-secondary"
                type="submit"
                disabled={dirty || submitting || pending}
              >
                {messages.submit}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </section>
  );

  function moveItem(block: BlockDraft, index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= block.linkItems.length) return;
    const linkItems = [...block.linkItems];
    const [item] = linkItems.splice(index, 1);
    linkItems.splice(target, 0, item!);
    updateBlock(block.id, (current) => ({ ...current, linkItems }));
  }
}
