import { describe, expect, it } from "vitest";

import { replaceAdminLocalePrefix } from "@/i18n/admin-locale-switch";

describe("replaceAdminLocalePrefix", () => {
  it("preserves admin root", () => {
    expect(replaceAdminLocalePrefix("/ar/admin", "en")).toBe("/en/admin");
    expect(replaceAdminLocalePrefix("/en/admin", "ar")).toBe("/ar/admin");
  });

  it("preserves list routes", () => {
    expect(replaceAdminLocalePrefix("/ar/admin/content/pages", "en")).toBe(
      "/en/admin/content/pages",
    );
    expect(replaceAdminLocalePrefix("/en/admin/navigation", "ar")).toBe(
      "/ar/admin/navigation",
    );
  });

  it("preserves detail routes with stable IDs", () => {
    const id = "01a0ec85-88b9-77f3-9636-380e59385b33";
    expect(
      replaceAdminLocalePrefix(`/ar/admin/content/pages/${id}`, "en"),
    ).toBe(`/en/admin/content/pages/${id}`);
    expect(replaceAdminLocalePrefix(`/en/admin/content/news/${id}`, "ar")).toBe(
      `/ar/admin/content/news/${id}`,
    );
  });

  it("preserves reference-data slugs", () => {
    expect(
      replaceAdminLocalePrefix(
        "/ar/admin/reference-data/event-categories",
        "en",
      ),
    ).toBe("/en/admin/reference-data/event-categories");
  });

  it("preserves query strings and hash", () => {
    expect(
      replaceAdminLocalePrefix("/ar/admin/navigation", "en", {
        search: "status=editing",
        hash: "#history",
      }),
    ).toBe("/en/admin/navigation?status=editing#history");
  });

  it("preserves preview revision IDs", () => {
    const revisionId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(
      replaceAdminLocalePrefix(
        `/ar/admin/preview/navigation/${revisionId}`,
        "en",
      ),
    ).toBe(`/en/admin/preview/navigation/${revisionId}`);
  });

  it("handles pathname without locale prefix", () => {
    expect(replaceAdminLocalePrefix("/admin/access/roles", "en")).toBe(
      "/en/admin/access/roles",
    );
  });
});
