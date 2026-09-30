/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { NavigationItemCount } from "@/app/[locale]/admin/navigation/navigation-item-count";
import { NavigationEditor } from "@/modules/public-navigation";

import en from "../../messages/en.json";

const keyGroup = "22222222-2222-4222-8222-222222222222";
const keyPage = "33333333-3333-4333-8333-333333333333";
const pageId = "55555555-5555-4555-8555-555555555555";

const nav = en.navigation;

async function noopSave(state: {
  error: string | null;
  saved: boolean;
  editVersion: number;
}) {
  return state;
}

function editorMessages() {
  return {
    saved: nav.saved,
    saving: nav.saving,
    save: nav.save,
    submit: nav.actions.submit,
    previewTitle: nav.rail.preview,
    previewAr: nav.previewAr,
    previewEn: nav.previewEn,
    workflowTitle: nav.rail.workflow,
    ui: {
      locationPickerLabel: nav.ui.locationPickerLabel,
      locationContext: nav.ui.locationContext,
      addItem: nav.ui.addItem,
      treeTitle: nav.ui.treeTitle,
      noSelection: nav.ui.noSelection,
      draftRail: nav.ui.draftRail,
    },
    locations: nav.locations,
    itemTypes: nav.itemTypes,
    fields: nav.fields,
    tree: nav.tree,
    workflow: {
      return: nav.actions.return,
      approve: nav.actions.approve,
      publish: nav.actions.publish,
      unpublish: nav.actions.unpublish,
      edit: nav.actions.editPublished,
      returnComment: nav.actions.returnComment,
      unpublishReason: nav.actions.unpublishReason,
      unpublishSection: nav.rail.unpublish,
    },
    errors: nav.errors,
  };
}

function renderEditor(
  props: Partial<React.ComponentProps<typeof NavigationEditor>> = {},
) {
  const locale = props.locale ?? "en";
  return render(
    <NextIntlClientProvider locale={locale} messages={en}>
      <NavigationEditor
        locale={locale}
        ItemCountDisplay={NavigationItemCount}
        previewRevision={null}
        publicationStatus="NEVER_PUBLISHED"
        canEdit
        canReview={false}
        canPublish={false}
        editVersion={1}
        workflowStatus="EDITING"
        pageTargets={[]}
        saveAction={noopSave}
        submitAction={async () => {}}
        workflowAction={async () => {}}
        initialDraft={{
          items: [
            {
              itemKey: keyGroup,
              location: "MAIN",
              itemType: "GROUP",
              parentItemKey: null,
              siblingOrder: 0,
              labelAr: "مجموعة",
              labelEn: "Group",
              systemRouteKey: "",
              contentTargetKind: "",
              contentTargetId: "",
              externalUrl: "",
            },
            {
              itemKey: keyPage,
              location: "MAIN",
              itemType: "CONTENT_ROUTE",
              parentItemKey: keyGroup,
              siblingOrder: 0,
              labelAr: "صفحة",
              labelEn: "Page",
              systemRouteKey: "",
              contentTargetKind: "MANAGED_PAGE",
              contentTargetId: pageId,
              externalUrl: "",
            },
          ],
        }}
        messages={editorMessages()}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe("NavigationEditor sibling controls", () => {
  it("disables move controls for a single child under a group", () => {
    renderEditor();

    const moveUpButtons = screen.getAllByRole("button", {
      name: nav.tree.moveUp,
    });
    const childMoveUp = moveUpButtons[moveUpButtons.length - 1];
    const childMoveDown = screen.getAllByRole("button", {
      name: nav.tree.moveDown,
    })[moveUpButtons.length - 1];

    expect(childMoveUp).toBeDisabled();
    expect(childMoveDown).toBeDisabled();
  });

  it("renders nested rows with depth markers", () => {
    renderEditor({ canEdit: false, workflowStatus: "APPROVED" });

    expect(document.querySelector('[data-depth="2"]')).not.toBeNull();
  });

  it("uses a single Add item control with an accessible type menu", () => {
    renderEditor();

    expect(
      screen.queryByRole("button", { name: nav.tree.addGroup }),
    ).not.toBeInTheDocument();

    const addItem = screen.getByRole("button", {
      name: `+ ${nav.ui.addItem}`,
    });
    fireEvent.click(addItem);

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: nav.itemTypes.GROUP }),
    ).toBeInTheDocument();
  });

  it("shows the navigation location selector as the first hierarchy level", () => {
    renderEditor();

    expect(
      screen.getByRole("heading", { name: nav.ui.locationPickerLabel }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: nav.locations.MAIN }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
