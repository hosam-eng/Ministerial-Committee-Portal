/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  HomepageEditor,
  emptyHomepageDraft,
  validateHomepageHeroCta,
  type HomepageDraft,
} from "@/modules/homepage";

import en from "../../messages/en.json";

const MP01 = "01a10210-dfe3-750b-a6a5-b318f5651ee0";

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

function draftWithSystemRouteCta() {
  const draft = emptyHomepageDraft();
  const hero = draft.sections[0]!.hero!;
  hero.ctaEnabled = true;
  hero.ctaTargetType = "SYSTEM_ROUTE";
  hero.systemRouteKey = "NEWS";
  return draft;
}

describe("homepage editor hero CTA target type", () => {
  it("submits a valid CONTENT_ROUTE draft after switching from SYSTEM_ROUTE", async () => {
    let capturedDraft: HomepageDraft | null = null;
    const saveAction = async (
      state: { error: string | null; saved: boolean; editVersion: number },
      formData: FormData,
    ) => {
      capturedDraft = JSON.parse(
        formData.get("draft") as string,
      ) as HomepageDraft;
      return { ...state, error: null, saved: true };
    };

    render(
      <HomepageEditor
        locale="en"
        previewRevision={null}
        publicationStatus="NEVER_PUBLISHED"
        canEdit
        canReview={false}
        canPublish={false}
        initialDraft={draftWithSystemRouteCta()}
        editVersion={1}
        workflowStatus="EDITING"
        pageTargets={[
          {
            id: MP01,
            title: "About the Committee",
            isPubliclyAvailable: true,
          },
        ]}
        newsTargets={[]}
        saveAction={saveAction}
        submitAction={async () => {}}
        workflowAction={async () => {}}
        messages={editorMessages()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: en.homepage.sections.HERO }),
    );

    const comboboxes = screen.getAllByRole("combobox");
    const targetTypeSelect = comboboxes.find(
      (element) =>
        element.querySelector('option[value="CONTENT_ROUTE"]') !== null,
    );
    expect(targetTypeSelect).toBeDefined();
    fireEvent.change(targetTypeSelect!, {
      target: { value: "CONTENT_ROUTE" },
    });

    const pageSelect = screen.getAllByRole("combobox").find((element) => {
      const select = element as HTMLSelectElement;
      return [...select.options].some((option) => option.value === MP01);
    });
    expect(pageSelect).toBeDefined();
    fireEvent.change(pageSelect!, { target: { value: MP01 } });

    fireEvent.click(screen.getByRole("button", { name: en.homepage.save }));

    await waitFor(() => {
      expect(capturedDraft).not.toBeNull();
    });

    const hero = capturedDraft!.sections.find(
      (section) => section.sectionType === "HERO",
    )!.hero!;
    expect(hero.ctaTargetType).toBe("CONTENT_ROUTE");
    expect(hero.systemRouteKey).toBe("");
    expect(hero.contentTargetKind).toBe("MANAGED_PAGE");
    expect(hero.contentTargetId).toBe(MP01);
    expect(() => validateHomepageHeroCta(hero, true)).not.toThrow();
  });
});
