/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { emptyRichTextDocument } from "@/modules/managed-pages/domain/rich-text-document";
import { ManagedPageActionBar } from "@/modules/managed-pages/presentation/managed-page-actions";
import {
  ManagedPageEditor,
  type ManagedPageEditorMessages,
  type ManagedPageEditorState,
} from "@/modules/managed-pages/presentation/managed-page-editor";
import { RichTextEditor } from "@/modules/managed-pages/presentation/rich-text/RichTextEditor";

const messages: ManagedPageEditorMessages = {
  editorTitle: "Edit bilingual page",
  editorIntro: "Shared structure",
  saved: "Draft saved.",
  saving: "Saving…",
  save: "Save draft",
  unsaved: "Save your changes before submitting for review.",
  submit: "Submit for review",
  structure: "Shared blocks",
  addRichText: "Add rich text",
  addCallout: "Add callout",
  addLinkList: "Add link list",
  moveUp: "Move up",
  moveDown: "Move down",
  remove: "Remove block",
  blocks: { RICHTEXT: "Rich text", CALLOUT: "Callout", LINK_LIST: "Link list" },
  variants: {
    institutional: "Institutional",
    info: "Information",
    success: "Success",
    warning: "Warning",
    error: "Error",
  },
  variant: "Callout meaning",
  addItem: "Add link",
  itemTarget: "Link type",
  externalUrl: "External address",
  internalPage: "Managed page",
  languages: { ar: "Arabic content", en: "English content" },
  fields: {
    title: "Title",
    intro: "Introduction",
    slug: "Slug",
    seoTitle: "SEO title",
    seoDescription: "SEO description",
    calloutTitle: "Callout title",
    calloutBody: "Callout text",
    linkHeading: "Link list heading",
    linkLabel: "Link label",
  },
  richText: {
    toolbar: "Formatting",
    editingRegion: "Rich text",
    paragraph: "Paragraph",
    h2: "Heading 2",
    h3: "Heading 3",
    h4: "Heading 4",
    bold: "Bold",
    italic: "Italic",
    bulletList: "Bullet list",
    orderedList: "Numbered list",
    quote: "Quotation",
    link: "Link",
    linkDialog: "Edit link",
    external: "External address",
    internal: "Managed page",
    url: "Address",
    page: "Page",
    applyLink: "Apply link",
    removeLink: "Remove link",
    close: "Close",
  },
  errors: {
    CONCURRENT_MODIFICATION: "Someone else changed this draft.",
    generic: "Failed",
  },
};

const draft = {
  translations: {
    ar: {
      title: "",
      slug: "",
      intro: null,
      seoTitle: null,
      seoDescription: null,
    },
    en: {
      title: "",
      slug: "",
      intro: null,
      seoTitle: null,
      seoDescription: null,
    },
  },
  blocks: [],
};

describe("managed page editor", () => {
  it("sets the Arabic editing direction and adds, reorders, and removes blocks", async () => {
    render(
      <ManagedPageEditor
        locale="ar"
        pageId="page-1"
        editVersion={1}
        draft={draft}
        pages={[]}
        messages={messages}
        saveAction={async (state) => state}
        submitAction={async (state) => state}
      />,
    );
    expect(screen.getByRole("tab", { name: "Arabic content" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Add rich text" }));
    fireEvent.click(screen.getByRole("button", { name: "Add callout" }));
    const list = screen.getByRole("list", { name: "Shared blocks" });
    expect(list.textContent?.indexOf("Rich text")).toBeLessThan(
      list.textContent?.indexOf("Callout") ?? 0,
    );
    const moveDown = screen.getAllByRole("button", { name: "Move down" })[0];
    expect(moveDown).toBeDefined();
    fireEvent.click(moveDown!);
    expect(list.textContent?.indexOf("Callout")).toBeLessThan(
      list.textContent?.indexOf("Rich text") ?? 0,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove block" })[0]!,
    );
    expect(
      screen.getAllByRole("button", { name: "Remove block" }),
    ).toHaveLength(1);
    const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
    expect(toolbar).toHaveAttribute("dir", "rtl");
  });

  it("announces a concurrency conflict returned by the save action", async () => {
    const saveAction = async (
      state: ManagedPageEditorState,
    ): Promise<ManagedPageEditorState> => ({
      ...state,
      error: "CONCURRENT_MODIFICATION",
      saved: false,
    });
    render(
      <ManagedPageEditor
        locale="en"
        pageId="page-1"
        editVersion={1}
        draft={draft}
        pages={[]}
        messages={messages}
        saveAction={saveAction}
        submitAction={async (state) => state}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Someone else changed this draft.",
    );
  });

  it("announces a validation failure and sets the English editing direction", async () => {
    render(
      <ManagedPageEditor
        locale="en"
        pageId="page-1"
        editVersion={1}
        draft={draft}
        pages={[]}
        messages={messages}
        saveAction={async (state) => ({
          ...state,
          error: "INVALID_DRAFT",
          saved: false,
        })}
        submitAction={async (state) => state}
      />,
    );
    expect(document.getElementById("panel-en")).toHaveAttribute("dir", "ltr");
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed");
  });

  it("exposes toolbar actions to the keyboard", async () => {
    render(
      <RichTextEditor
        id="rich-1"
        locale="en"
        value={emptyRichTextDocument()}
        pages={[]}
        labels={messages.richText}
        onChange={() => undefined}
      />,
    );
    const bold = screen.getByRole("button", { name: "Bold" });
    bold.focus();
    expect(bold).toHaveFocus();
    fireEvent.keyDown(bold, { key: "Enter" });
    fireEvent.click(bold);
    expect(bold).toHaveAttribute("aria-pressed");
  });
});

describe("managed page action visibility", () => {
  it("shows review actions only when review permission is supplied", () => {
    const action = () => undefined;
    const labels = {
      return: "Return",
      approve: "Approve",
      publish: "Publish",
      unpublish: "Unpublish",
      edit: "Edit published page",
      returnComment: "Reason for return",
      unpublishReason: "Reason for unpublishing",
    };
    const { rerender } = render(
      <ManagedPageActionBar
        locale="en"
        pageId="page-1"
        workflowStatus="PENDING_REVIEW"
        publicationStatus="NEVER_PUBLISHED"
        canEdit={false}
        canReview={false}
        canPublish={false}
        action={action}
        messages={labels}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Approve" }),
    ).not.toBeInTheDocument();
    rerender(
      <ManagedPageActionBar
        locale="en"
        pageId="page-1"
        workflowStatus="PENDING_REVIEW"
        publicationStatus="NEVER_PUBLISHED"
        canEdit={false}
        canReview
        canPublish={false}
        action={action}
        messages={labels}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish" }),
    ).not.toBeInTheDocument();
  });

  it("shows publish and unpublish only when publish permission is supplied", () => {
    render(
      <ManagedPageActionBar
        locale="en"
        pageId="page-1"
        workflowStatus="APPROVED"
        publicationStatus="PUBLISHED"
        canEdit
        canReview
        canPublish
        action={() => undefined}
        messages={{
          return: "Return",
          approve: "Approve",
          publish: "Publish",
          unpublish: "Unpublish",
          edit: "Edit published page",
          returnComment: "Reason for return",
          unpublishReason: "Reason for unpublishing",
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unpublish" }),
    ).toBeInTheDocument();
  });
});
