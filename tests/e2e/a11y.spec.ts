import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated accessibility checks for the IMP-04 localized bootstrap pages.
 * Fails on serious/critical violations; this does not replace the manual
 * accessibility reviews required by B2.
 */
for (const locale of ["ar", "en"]) {
  test(`@a11y /${locale} bootstrap page has no serious or critical axe violations`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
}
