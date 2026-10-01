import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolvePublishedNewsByIdsMock } = vi.hoisted(() => ({
  resolvePublishedNewsByIdsMock: vi.fn(),
}));

vi.mock("@/modules/publishing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/publishing")>();
  return {
    ...actual,
    resolvePublishedNewsByIds: resolvePublishedNewsByIdsMock,
    listLatestPublishedNews: vi.fn(async () => []),
  };
});

import {
  addManualNewsId,
  emptyHomepageDraft,
  filterAvailableManualNewsToAdd,
  moveManualNewsId,
  removeManualNewsId,
  resolveHomepageDraftToPublic,
  resolveSelectedManualNewsRows,
  validateHomepageDraft,
} from "@/modules/homepage";
import { assertPublishableHomepageDraft } from "@/modules/homepage/infrastructure/publish-validation";

const idA = "11111111-1111-4111-8111-111111111111";
const idB = "22222222-2222-4222-8222-222222222222";
const idC = "33333333-3333-4333-8333-333333333333";
const idD = "44444444-4444-4444-8444-444444444444";
const idUnavailable = "55555555-5555-4555-8555-555555555555";

const targets = [
  { id: idA, title: "News A", isPubliclyAvailable: true },
  { id: idB, title: "News B", isPubliclyAvailable: true },
  { id: idC, title: "News C", isPubliclyAvailable: true },
  { id: idUnavailable, title: "Stale", isPubliclyAvailable: false },
];

function publicNews(newsId: string, title: string) {
  return {
    newsId,
    title,
    summary: "",
    slug: title.toLowerCase(),
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("manual news ordering helpers", () => {
  it("adds the first item at position 0", () => {
    expect(addManualNewsId([], idA)).toEqual([idA]);
  });

  it("adds three items in order", () => {
    let ids: string[] = [];
    ids = addManualNewsId(ids, idA);
    ids = addManualNewsId(ids, idB);
    ids = addManualNewsId(ids, idC);
    expect(ids).toEqual([idA, idB, idC]);
  });

  it("enforces max three selections", () => {
    const ids = [idA, idB, idC];
    expect(addManualNewsId(ids, idD)).toEqual([idA, idB, idC]);
  });

  it("moves an item down and up", () => {
    const ids = [idA, idB, idC];
    expect(moveManualNewsId(ids, idC, "up")).toEqual([idA, idC, idB]);
    expect(moveManualNewsId([idA, idC, idB], idC, "down")).toEqual([
      idA,
      idB,
      idC,
    ]);
  });

  it("disables move at boundaries", () => {
    const ids = [idA, idB];
    expect(moveManualNewsId(ids, idA, "up")).toEqual([idA, idB]);
    expect(moveManualNewsId(ids, idB, "down")).toEqual([idA, idB]);
    expect(moveManualNewsId([idA], idA, "up")).toEqual([idA]);
    expect(moveManualNewsId([idA], idA, "down")).toEqual([idA]);
  });

  it("removes a middle item without position gaps", () => {
    expect(removeManualNewsId([idA, idB, idC], idB)).toEqual([idA, idC]);
  });

  it("lists only available unselected targets for add", () => {
    expect(
      filterAvailableManualNewsToAdd(targets, [idA, idUnavailable]),
    ).toEqual([
      { id: idB, title: "News B", isPubliclyAvailable: true },
      { id: idC, title: "News C", isPubliclyAvailable: true },
    ]);
  });

  it("keeps unavailable selected rows visible with fallback title", () => {
    const byId = new Map(targets.map((row) => [row.id, row]));
    const rows = resolveSelectedManualNewsRows([idA, idUnavailable], byId);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.title).toBe("News A");
    expect(rows[1]?.isPubliclyAvailable).toBe(false);
    expect(rows[1]?.title).toBe("Stale");
  });

  it("clears manual ids when switching to automatic and does not restore them", () => {
    const draft = emptyHomepageDraft();
    draft.sections[1]!.news!.mode = "MANUAL";
    draft.sections[1]!.news!.manualNewsIds = [idA, idB];
    const automatic = validateHomepageDraft({
      ...draft,
      sections: draft.sections.map((section) =>
        section.sectionType === "NEWS" && section.news
          ? {
              ...section,
              news: { ...section.news, mode: "AUTOMATIC" as const },
            }
          : section,
      ),
    });
    expect(automatic.sections[1]!.news!.manualNewsIds).toEqual([]);

    const manualAgain = validateHomepageDraft({
      ...automatic,
      sections: automatic.sections.map((section) =>
        section.sectionType === "NEWS" && section.news
          ? {
              ...section,
              news: { ...section.news, mode: "MANUAL" as const },
            }
          : section,
      ),
    });
    expect(manualAgain.sections[1]!.news!.manualNewsIds).toEqual([]);
  });

  it("preserves manual news order through draft validation", () => {
    const draft = emptyHomepageDraft();
    draft.sections[1]!.news!.mode = "MANUAL";
    draft.sections[1]!.news!.manualNewsIds = [idC, idA, idB];
    const parsed = validateHomepageDraft(JSON.parse(JSON.stringify(draft)));
    expect(parsed.sections[1]!.news!.manualNewsIds).toEqual([idC, idA, idB]);
  });
});

describe("manual news public resolution", () => {
  beforeEach(() => {
    resolvePublishedNewsByIdsMock.mockReset();
  });

  it("renders preview/public items in manual id order", async () => {
    resolvePublishedNewsByIdsMock.mockImplementation(async (_locale, ids) =>
      ids.flatMap((newsId: string) => {
        const titles: Record<string, string> = {
          [idA]: "A",
          [idB]: "B",
          [idC]: "C",
        };
        const title = titles[newsId];
        return title ? [publicNews(newsId, title)] : [];
      }),
    );

    const draft = emptyHomepageDraft();
    draft.sections[1]!.news!.mode = "MANUAL";
    draft.sections[1]!.news!.manualNewsIds = [idA, idC, idB];
    draft.sections[1]!.news!.translations.en.sectionHeading = "News";
    draft.sections[1]!.news!.translations.ar.sectionHeading = "أخبار";

    const homepage = await resolveHomepageDraftToPublic(draft, "en", {
      prisma: {},
    } as never);
    const news = homepage.sections.find((section) => section.type === "news");
    expect(news?.news?.items.map((item) => item.title)).toEqual([
      "A",
      "C",
      "B",
    ]);
  });

  it("omits unavailable manual targets safely in public output", async () => {
    resolvePublishedNewsByIdsMock.mockImplementation(async (_locale, ids) =>
      ids.flatMap((newsId: string) =>
        newsId === idA ? [publicNews(idA, "A")] : [],
      ),
    );

    const draft = emptyHomepageDraft();
    draft.sections[1]!.news!.mode = "MANUAL";
    draft.sections[1]!.news!.manualNewsIds = [idA, idUnavailable];
    draft.sections[1]!.news!.translations.en.sectionHeading = "News";
    draft.sections[1]!.news!.translations.ar.sectionHeading = "أخبار";

    const homepage = await resolveHomepageDraftToPublic(draft, "en", {
      prisma: {},
    } as never);
    const news = homepage.sections.find((section) => section.type === "news");
    expect(news?.news?.items).toHaveLength(1);
    expect(news?.news?.items[0]?.title).toBe("A");
  });

  it("blocks publish when a manual target is unavailable", async () => {
    resolvePublishedNewsByIdsMock.mockResolvedValue([]);

    const draft = emptyHomepageDraft();
    draft.sections[1]!.news!.mode = "MANUAL";
    draft.sections[1]!.news!.manualNewsIds = [idUnavailable];

    await expect(
      assertPublishableHomepageDraft(draft, { prisma: {} } as never),
    ).rejects.toMatchObject({ code: "UNAVAILABLE_TARGET" });
  });
});
