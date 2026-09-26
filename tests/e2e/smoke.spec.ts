import { expect, test } from "@playwright/test";

/**
 * Production-build smoke journey (IMP-01, updated by IMP-04):
 * application starts → root redirects to the Arabic default locale →
 * expected heading present.
 */
test("root redirects to /ar and renders the Arabic foundation heading", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "اللجنة الوزارية للسلامة المرورية",
  );
});
