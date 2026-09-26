import { expect, test } from "@playwright/test";

/**
 * Production-build smoke journey (IMP-01):
 * application starts → root page responds → expected heading present.
 */
test("root page responds and renders the foundation heading", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Ministerial Committee Portal",
  );
});
