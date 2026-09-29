import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isPreviewPath,
  PREVIEW_CACHE_CONTROL,
  PREVIEW_ROBOTS_TAG,
  previewRobots,
} from "@/shared/preview/safety";

const root = path.resolve(import.meta.dirname, "../..");

describe("preview safety seam", () => {
  it("marks preview responses private, uncached, and noindex", () => {
    expect(PREVIEW_CACHE_CONTROL).toContain("private");
    expect(PREVIEW_CACHE_CONTROL).toContain("no-store");
    expect(PREVIEW_ROBOTS_TAG).toBe("noindex, nofollow");
    expect(previewRobots.index).toBe(false);
    expect(previewRobots.follow).toBe(false);
    expect(isPreviewPath("/ar/admin/preview/managed-pages/abc")).toBe(true);
    expect(isPreviewPath("/ar/pages/about")).toBe(false);
  });

  it("uses one content renderer for preview and the live public page", () => {
    const preview = readFileSync(
      path.join(
        root,
        "src/app/[locale]/admin/preview/managed-pages/[revisionId]/page.tsx",
      ),
      "utf8",
    );
    const live = readFileSync(
      path.join(root, "src/app/[locale]/pages/[slug]/page.tsx"),
      "utf8",
    );
    expect(preview).toContain("ManagedPagePublicContent");
    expect(live).toContain("ManagedPagePublicContent");
    expect(preview).toContain("previewRobots");
    expect(preview).toContain("requireBackoffice");
    expect(live).not.toContain("admin/preview");
    expect(live).not.toContain("@tiptap/react");
    expect(preview).not.toContain("dangerouslySetInnerHTML");
    expect(live).not.toContain("dangerouslySetInnerHTML");
  });
});
