import { describe, expect, it } from "vitest";

import {
  formatCalendarDateInput,
  parseCalendarDateInput,
} from "@/modules/publishing/display-date";
import { NewsError, validateDraft } from "@/modules/publishing/news-rules";

const body = { version: 1 as const, type: "plainText" as const, text: "Body" };

function completeInput(displayDate?: string | null) {
  return {
    displayDate,
    categoryIds: [] as string[],
    translations: {
      ar: {
        title: "عنوان",
        slug: "slug-ar",
        summary: "ملخص",
        body,
      },
      en: {
        title: "Title",
        slug: "slug-en",
        summary: "Summary",
        body,
      },
    },
  };
}

describe("News displayDate validation", () => {
  it("allows incomplete draft without displayDate", () => {
    const draft = validateDraft({ translations: {}, categoryIds: [] });
    expect(draft.displayDate).toBeNull();
  });

  it("rejects submit when displayDate is missing", () => {
    expect(() => validateDraft(completeInput(null), true)).toThrow(NewsError);
    try {
      validateDraft(completeInput(""), true);
    } catch (error) {
      expect(error).toBeInstanceOf(NewsError);
      expect((error as NewsError).code).toBe("DISPLAY_DATE_REQUIRED");
    }
  });

  it("rejects invalid calendar values on save", () => {
    expect(() =>
      validateDraft({ ...completeInput("2026-02-30"), categoryIds: [] }),
    ).toThrow(NewsError);
  });

  it("persists a valid displayDate string", () => {
    const draft = validateDraft(completeInput("2024-01-10"), true);
    expect(draft.displayDate).toBe("2024-01-10");
    expect(formatCalendarDateInput(parseCalendarDateInput("2024-01-10")!)).toBe(
      "2024-01-10",
    );
  });
});
