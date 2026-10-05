import { createOTP } from "@better-auth/utils/otp";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  A11Y_DENIED_USER,
  A11Y_NEWS_USER,
  A11Y_USER,
  completeMfaEnrollment,
  hasDatabase,
  seedE2eUser,
  submitMfaEnable,
  submitMfaVerify,
  submitSignIn,
} from "./support/auth";
import {
  A11Y_NEWS_SLUGS,
  ensureA11yNewsFixture,
} from "./support/news-a11y-fixture";

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

async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
}

/**
 * IMP-06: the new backoffice pages (admin landing, roles, users) for a
 * fully authenticated Administrator, plus the localized access-denied
 * page for a zero-role user. English only — markup is shared.
 */
test("@a11y /en/admin access pages have no serious or critical axe violations", async ({
  page,
}) => {
  test.setTimeout(180_000);
  test.skip(!hasDatabase(), "rbac a11y requires DATABASE_URL");
  await seedE2eUser(A11Y_USER); // Administrator membership

  await page.goto("/en/admin/login");
  await submitSignIn(
    page,
    { email: "Email address", password: "Password", submit: "Sign in" },
    A11Y_USER,
  );
  await expect(page).toHaveURL(/\/en\/admin\/mfa\/setup$/);
  await completeMfaEnrollment(
    page,
    {
      password: "Password",
      continue: "Continue",
      code: "Authenticator app code",
      submit: "Verify",
    },
    A11Y_USER.password,
  );
  await expect(page).toHaveURL(/\/en\/admin$/);
  await expect(page).toHaveTitle(/.+/);
  await expectNoSeriousViolations(page);

  await page.goto("/en/admin/access/roles");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.goto("/en/admin/access/users");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("@a11y /en/admin access-denied has no serious or critical axe violations", async ({
  page,
}) => {
  test.setTimeout(180_000);
  test.skip(!hasDatabase(), "rbac a11y requires DATABASE_URL");
  await seedE2eUser(A11Y_DENIED_USER, { admin: false });

  await page.goto("/en/admin/login");
  await submitSignIn(
    page,
    { email: "Email address", password: "Password", submit: "Sign in" },
    A11Y_DENIED_USER,
  );
  await expect(page).toHaveURL(/\/en\/admin\/mfa\/setup$/);
  await completeMfaEnrollment(
    page,
    {
      password: "Password",
      continue: "Continue",
      code: "Authenticator app code",
      submit: "Verify",
    },
    A11Y_DENIED_USER.password,
  );
  // Zero roles → /en/admin renders the denied experience, not a crash.
  await expect(page).toHaveURL(/\/en\/admin$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Access denied" }),
  ).toBeVisible();
  await expectNoSeriousViolations(page);
});

const SIGN_IN_LABELS = {
  ar: {
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    submit: "تسجيل الدخول",
  },
  en: {
    email: "Email address",
    password: "Password",
    submit: "Sign in",
  },
} as const;

const MFA_LABELS = {
  ar: {
    password: "كلمة المرور",
    continue: "متابعة",
    code: "رمز تطبيق المصادقة",
    submit: "تحقق",
  },
  en: {
    password: "Password",
    continue: "Continue",
    code: "Authenticator app code",
    submit: "Verify",
  },
} as const;

let a11yNewsMfaSecret: string | undefined;

async function ensureA11yNewsAdminSession(
  page: Page,
  locale: "ar" | "en",
): Promise<void> {
  await page.goto(`/${locale}/admin/login`);
  await submitSignIn(page, SIGN_IN_LABELS[locale], A11Y_NEWS_USER);
  if (page.url().includes("/mfa/setup")) {
    a11yNewsMfaSecret = await completeMfaEnrollment(
      page,
      MFA_LABELS[locale],
      A11Y_NEWS_USER.password,
    );
    await expect(page).toHaveURL(new RegExp(`\\/${locale}\\/admin`));
    return;
  }
  if (page.url().includes("/mfa")) {
    if (!a11yNewsMfaSecret) {
      throw new Error(
        "MFA secret missing — complete Arabic admin enrollment first in this serial suite.",
      );
    }
    const code = await createOTP(a11yNewsMfaSecret).totp();
    await submitMfaVerify(page, MFA_LABELS[locale], code);
    await expect(page).toHaveURL(new RegExp(`\\/${locale}\\/admin`));
  }
}

/** TB-IMP-05: four News surfaces × AR/EN (list uses empty or shared fixture). */
test.describe("News surfaces a11y", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    test.skip(!hasDatabase(), "News a11y requires DATABASE_URL");
    await seedE2eUser(A11Y_NEWS_USER);
    await ensureA11yNewsFixture();
  });

  for (const locale of ["ar", "en"] as const) {
    test(`@a11y /${locale}/news list has no serious or critical axe violations`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/news`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`@a11y /${locale}/news detail has no serious or critical axe violations`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.goto(`/${locale}/news/${A11Y_NEWS_SLUGS[locale]}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`@a11y /${locale}/admin/content/news editor has no serious or critical axe violations`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      const fixture = await ensureA11yNewsFixture();
      await ensureA11yNewsAdminSession(page, locale);
      await page.goto(`/${locale}/admin/content/news/${fixture.newsId}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousViolations(page);
    });

    test(`@a11y /${locale}/admin/preview/news explicit revision has no serious or critical axe violations`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      const fixture = await ensureA11yNewsFixture();
      await ensureA11yNewsAdminSession(page, locale);
      await page.goto(`/${locale}/admin/preview/news/${fixture.revisionId}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSeriousViolations(page);
    });
  }
});
