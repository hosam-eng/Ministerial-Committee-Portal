/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomepageEditor, emptyHomepageDraft } from "@/modules/homepage";

import en from "../../messages/en.json";

const idA = "11111111-1111-4111-8111-111111111111";
const idB = "22222222-2222-4222-8222-222222222222";
const idC = "33333333-3333-4333-8333-333333333333";
const idUnavailable = "55555555-5555-4555-8555-555555555555";

async function noopSave(state: {
  error: string | null;
  saved: boolean;
  editVersion: number;
}) {
  return state;
}

function editorMessages() {
  const hp = en.homepage;
  return {
    saved: hp.saved,
    saving: hp.saving,
    save: hp.save,
    submit: hp.actions.submit,
    previewTitle: hp.rail.preview,
    previewAr: hp.previewAr,
    previewEn: hp.previewEn,
    workflowTitle: hp.rail.workflow,
    sections: { HERO: hp.sections.HERO, NEWS: hp.sections.NEWS },
    fields: hp.fields as Record<string, string>,
    newsMode: hp.newsMode as Record<string, string>,
    ui: hp.ui as Record<string, string>,
    workflow: {
      return: hp.actions.return,
      approve: hp.actions.approve,
      publish: hp.actions.publish,
      unpublish: hp.actions.unpublish,
      edit: hp.actions.editPublished,
      returnComment: hp.actions.returnComment,
      unpublishReason: hp.actions.unpublishReason,
      unpublishSection: hp.rail.unpublish,
    },
    errors: hp.errors as Record<string, string>,
  };
}

function renderManualEditor(
  manualNewsIds: string[] = [],
  newsTargets = [
    { id: idA, title: "News A", isPubliclyAvailable: true },
    { id: idB, title: "News B", isPubliclyAvailable: true },
    { id: idC, title: "News C", isPubliclyAvailable: true },
    { id: idUnavailable, title: "Stale pick", isPubliclyAvailable: false },
  ],
) {
  const draft = emptyHomepageDraft();
  draft.sections[1]!.news!.mode = "MANUAL";
  draft.sections[1]!.news!.manualNewsIds = manualNewsIds;

  return render(
    <HomepageEditor
      locale="en"
      previewRevision={null}
      publicationStatus="NEVER_PUBLISHED"
      canEdit
      canReview={false}
      canPublish={false}
      initialDraft={draft}
      editVersion={1}
      workflowStatus="EDITING"
      pageTargets={[]}
      newsTargets={newsTargets}
      saveAction={noopSave}
      submitAction={async () => {}}
      workflowAction={async () => {}}
      messages={editorMessages()}
    />,
  );
}

describe("homepage editor manual news", () => {
  it("opens manual news controls on the news section", () => {
    renderManualEditor();
    fireEvent.click(
      screen.getByRole("button", { name: en.homepage.sections.NEWS }),
    );
    expect(
      screen.getByRole("group", { name: en.homepage.ui.selectedManualNews }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: en.homepage.ui.addManualNews }),
    ).toBeInTheDocument();
  });

  it("adds news in order and supports move/remove", () => {
    renderManualEditor();
    fireEvent.click(
      screen.getByRole("button", { name: en.homepage.sections.NEWS }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Add “News A”/i }));
    fireEvent.click(screen.getByRole("button", { name: /Add “News B”/i }));
    fireEvent.click(screen.getByRole("button", { name: /Add “News C”/i }));

    const selected = screen.getByRole("group", {
      name: en.homepage.ui.selectedManualNews,
    });
    const items = within(selected).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("News A");
    expect(items[2]).toHaveTextContent("News C");

    fireEvent.click(
      within(items[2]!).getByRole("button", { name: /Move up: News C/i }),
    );
    const reordered = within(selected).getAllByRole("listitem");
    expect(reordered[1]).toHaveTextContent("News C");

    fireEvent.click(
      within(reordered[1]!).getByRole("button", { name: /Remove: News C/i }),
    );
    const remaining = within(selected).getAllByRole("listitem");
    expect(remaining).toHaveLength(2);
    expect(remaining.map((item) => item.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("News A"),
        expect.stringContaining("News B"),
      ]),
    );
  });

  it("shows unavailable selected news and hides it from add choices", () => {
    renderManualEditor([idA, idUnavailable]);
    fireEvent.click(
      screen.getByRole("button", { name: en.homepage.sections.NEWS }),
    );

    const selected = screen.getByRole("group", {
      name: en.homepage.ui.selectedManualNews,
    });
    expect(within(selected).getByText("Stale pick")).toBeInTheDocument();
    expect(
      within(selected).getByText(en.homepage.ui.notPubliclyAvailable),
    ).toBeInTheDocument();

    const add = screen.getByRole("group", {
      name: en.homepage.ui.addManualNews,
    });
    expect(within(add).queryByText(/Stale pick/i)).toBeNull();
    expect(within(add).queryByRole("button", { name: /Stale/i })).toBeNull();
  });

  it("blocks adding a fourth item with explanation", () => {
    renderManualEditor([idA, idB, idC]);
    fireEvent.click(
      screen.getByRole("button", { name: en.homepage.sections.NEWS }),
    );
    expect(
      screen.getByText(en.homepage.ui.manualNewsMaxReached),
    ).toBeInTheDocument();
  });

  it("clears manual ids when switching to automatic", () => {
    renderManualEditor([idA, idB]);
    fireEvent.click(
      screen.getByRole("button", { name: en.homepage.sections.NEWS }),
    );

    fireEvent.change(screen.getByLabelText(en.homepage.fields.newsMode), {
      target: { value: "AUTOMATIC" },
    });
    expect(
      screen.queryByRole("group", { name: en.homepage.ui.selectedManualNews }),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText(en.homepage.fields.newsMode), {
      target: { value: "MANUAL" },
    });
    expect(
      screen.getByText(en.homepage.ui.noSelectedManualNews),
    ).toBeInTheDocument();
  });
});
