import { expect, test } from "@playwright/test";

import {
  completeMfaEnrollment,
  E2E_USER,
  hasDatabase,
  seedE2eUser,
  submitSignIn,
} from "./support/auth";

const AR = {
  signIn: {
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    submit: "تسجيل الدخول",
  },
  mfa: {
    password: "كلمة المرور",
    continue: "متابعة",
    code: "رمز تطبيق المصادقة",
    submit: "تحقق",
  },
} as const;

/**
 * IMP-08 shell smoke — semantic landmarks, locale switch, dir, and the
 * AdminShell chrome on authorized pages. Public routes are checked in
 * both directions; the authenticated leg runs the real IMP-05/06 flow.
 */
test.describe("public shell", () => {
  for (const [locale, dir, other, otherHref] of [
    ["ar", "rtl", "English", "/en"],
    ["en", "ltr", "العربية", "/ar"],
  ] as const) {
    test(`/${locale} renders landmarks + ${dir} + locale switch`, async ({
      page,
    }) => {
      // IBM Plex Sans Arabic ships inside @platformscode/core — the
      // core.css @font-face URL must resolve through the bundler.
      const fontResponse = page
        .waitForResponse(
          (res) => res.url().includes("IBMPlexSansArabic") && res.ok(),
          { timeout: 15_000 },
        )
        .catch(() => null);
      await page.goto(`/${locale}`);
      expect(await fontResponse).not.toBeNull();
      await expect(page.locator("html")).toHaveAttribute("dir", dir);
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: other })).toHaveAttribute(
        "href",
        otherHref,
      );
      // Skip link is the first focusable element and targets <main>.
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", {
        name: /main content|المحتوى الرئيسي/,
      });
      await expect(skip).toBeFocused();
      await expect(skip).toHaveAttribute("href", "#main-content");
      await skip.press("Enter");
      await expect(page.locator("#main-content")).toBeVisible();
    });
  }

  test("no horizontal overflow at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ar");
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});

test.describe("admin shell", () => {
  test("authenticated admin sees shell chrome on /admin + access page", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    test.skip(!hasDatabase(), "shell e2e requires DATABASE_URL");
    await seedE2eUser(E2E_USER);

    await page.goto("/ar/admin/login");
    await submitSignIn(page, AR.signIn, E2E_USER);
    await expect(page).toHaveURL(/\/ar\/admin\/mfa\/setup$/);
    await completeMfaEnrollment(page, AR.mfa, E2E_USER.password);
    await expect(page).toHaveURL(/\/ar\/admin$/);

    // Shell chrome: banner, main, permission-aware nav, email, switch.
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "إدارة الأدوار" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "إدارة المستخدمين" }),
    ).toBeVisible();
    await expect(
      page.getByText(`البريد الإلكتروني: ${E2E_USER.email}`),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "English" })).toBeVisible();

    // Roles page inside the shell; Administrator shows localized
    // description, not the stored English DB text.
    await page.goto("/ar/admin/access/roles");
    await expect(
      page.getByRole("heading", { level: 1, name: "الأدوار" }),
    ).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(
      page.getByText("دور النظام الذي يمنح كتالوج الصلاحيات الإدارية كاملاً."),
    ).toBeVisible();
    await expect(
      page.getByText("Built-in system role holding every defined permission."),
    ).toHaveCount(0);

    // DGA button element upgrades and performs logout.
    await page.goto("/ar/admin");
    const logout = page.locator("dga-button-v2.hydrated");
    await expect(logout).toBeVisible();
    await expect(
      logout.getByRole("button", { name: "تسجيل الخروج" }),
    ).toBeVisible();
    await logout.getByRole("button").first().click();
    await expect(page).toHaveURL(/\/ar\/admin\/login$/);
  });

  test("admin shell renders LTR in English", async ({ page }) => {
    test.setTimeout(240_000);
    test.skip(!hasDatabase(), "shell e2e requires DATABASE_URL");
    await seedE2eUser(E2E_USER);

    await page.goto("/en/admin/login");
    await submitSignIn(
      page,
      { email: "Email address", password: "Password", submit: "Sign in" },
      E2E_USER,
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
      E2E_USER.password,
    );
    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manage roles" }),
    ).toBeVisible();
    await expect(page.getByText(`Email: ${E2E_USER.email}`)).toBeVisible();
  });
});
