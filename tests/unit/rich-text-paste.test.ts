/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { normalizePastedHtml } from "@/modules/managed-pages/presentation/rich-text/rich-text-project";

describe("rich text paste normalization", () => {
  it("keeps plain text inside the allowed schema", () => {
    const document = normalizePastedHtml("Plain committee text");
    expect(JSON.stringify(document)).toContain("Plain committee text");
    expect(JSON.stringify(document)).not.toContain("script");
  });

  it("normalizes Word-like HTML and drops script, iframe, and style", () => {
    const html =
      '<p style="color:red"><b>Bold</b> and <i>italic</i></p><ul><li>One</li></ul><script>alert(1)</script><iframe src="https://evil.example"></iframe>';
    const document = normalizePastedHtml(html);
    const serialized = JSON.stringify(document);
    expect(serialized).toContain("Bold");
    expect(serialized).toContain("italic");
    expect(serialized).not.toContain("iframe");
    expect(serialized).not.toContain("script");
    expect(serialized).not.toContain("color:red");
    expect(serialized).not.toContain("onerror");
  });
});
