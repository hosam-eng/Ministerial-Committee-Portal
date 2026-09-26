import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated accessibility smoke check (IMP-01). Fails on serious/critical
 * violations; this does not replace the manual accessibility reviews
 * required by B2.
 */
test("@a11y foundation page has no serious or critical axe violations", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking).toEqual([]);
});
