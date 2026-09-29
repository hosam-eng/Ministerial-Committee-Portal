import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("portal brand tokens", () => {
  const css = readFileSync("src/styles/globals.css", "utf8");

  it("defines Committee brand tokens and does not use DGA green as identity", () => {
    expect(css).toContain("--brand-primary: #106484");
    expect(css).toContain("--brand-primary-hover: #0d5369");
    expect(css).toContain("--brand-accent: #0eb2de");
    expect(css).toContain("--portal-identity: var(--brand-primary)");
    expect(css).not.toContain(
      "--portal-identity: var(--colors-primary-sa-flag-600-primary)",
    );
    expect(css).toMatch(
      /\.managed-callout-institutional\s*\{[^}]*brand-accent/,
    );
  });
});
