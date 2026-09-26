import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  A11Y_USER,
  hasDatabase,
  seedE2eUser,
  submitMfaEnable,
  submitSignIn,
} from "./support/auth";

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

/**
 * IMP-05: targeted axe on the new authentication pages only. Login is
 * unauthenticated; the MFA setup and admin placeholder are checked in a
 * real authenticated flow (English only — the markup is shared).
 */
for (const locale of ["ar", "en"]) {
  test(`@a11y /${locale}/admin/login has no serious or critical axe violations`, async ({
    page,
  }) => {
    test.skip(!hasDatabase(), "auth a11y requires DATABASE_URL");
    await page.goto(`/${locale}/admin/login`);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
}

test("@a11y /en/admin/mfa/setup and /en/admin have no serious or critical axe violations", async ({
  page,
}) => {
  test.setTimeout(120_000);
  test.skip(!hasDatabase(), "auth a11y requires DATABASE_URL");
  await seedE2eUser(A11Y_USER);

  await page.goto("/en/admin/login");
  await submitSignIn(
    page,
    { email: "Email address", password: "Password", submit: "Sign in" },
    A11Y_USER,
  );
  await expect(page).toHaveURL(/\/en\/admin\/mfa\/setup$/);
  // Client-side navigation: wait until the streamed head/title and the
  // page content have landed before analyzing.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/.+/);

  let results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);

  await submitMfaEnable(
    page,
    { password: "Password", submit: "Continue" },
    A11Y_USER.password,
  );
  await expect(page.locator(".auth-secret")).toBeVisible();
  results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
});
