import { expect, test } from "@playwright/test";

import { getAdminNavigation } from "./support/admin-nav";
import {
  completeMfaEnrollment,
  hasDatabase,
  resetCustomRoles,
  seedE2eUser,
  submitSignIn,
} from "./support/auth";

const AR_SIGN_IN = {
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  submit: "تسجيل الدخول",
} as const;

const AR_SETUP = {
  password: "كلمة المرور",
  continue: "متابعة",
  code: "رمز تطبيق المصادقة",
  submit: "تحقق",
} as const;

const EN_SETUP = {
  password: "Password",
  continue: "Continue",
  code: "Authenticator app code",
  submit: "Verify",
} as const;

const EN_SIGN_IN = {
  email: "Email address",
  password: "Password",
  submit: "Sign in",
} as const;

const ACCESS_ADMIN = {
  email: "e2e.rbac.admin@example.test",
  name: "E2E RBAC Admin",
  password: "e2e-rbac-admin-1234",
} as const;

const ACCESS_STAFF = {
  email: "e2e.rbac.staff@example.test",
  name: "E2E RBAC Staff",
  password: "e2e-rbac-staff-1234",
} as const;

const ACCESS_DENIED = {
  email: "e2e.rbac.denied@example.test",
  name: "E2E RBAC Denied",
  password: "e2e-rbac-denied-1234",
} as const;

const CUSTOM_ROLE = "فريق البوابة";

/**
 * IMP-06 granular authorization journey (Arabic = representative full
 * flow). An Administrator creates a custom role holding only
 * {backoffice.access, identity.users.read}, assigns it to a second
 * user, and the second user proves exactly the scoped access: /admin
 * allowed, users page allowed, roles page denied. Deactivating the
 * role revokes access on the next request — no re-login. English runs
 * only the localized/LTR smoke leg.
 */
test.describe.configure({ mode: "serial" });

test.describe("backoffice RBAC journey (ar)", () => {
  test("admin scopes a custom role; user gets exactly those permissions; deactivation revokes live", async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    test.skip(!hasDatabase(), "rbac e2e requires DATABASE_URL");
    // Clean slate: prior runs leave deactivated custom roles behind.
    await resetCustomRoles();
    await seedE2eUser(ACCESS_ADMIN);
    await seedE2eUser(ACCESS_STAFF, { admin: false });

    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    const staffContext = await browser.newContext();
    const staff = await staffContext.newPage();
    try {
      // 1. Administrator completes the full IMP-05 auth flow.
      await admin.goto("/ar/admin/login");
      await submitSignIn(admin, AR_SIGN_IN, ACCESS_ADMIN);
      await expect(admin).toHaveURL(/\/ar\/admin\/mfa\/setup$/);
      await completeMfaEnrollment(admin, AR_SETUP, ACCESS_ADMIN.password);
      await expect(admin).toHaveURL(/\/ar\/admin$/);
      const adminNav = getAdminNavigation(admin, "ar");
      await expect(
        adminNav.getByRole("link", { name: "إدارة الأدوار" }),
      ).toBeVisible();
      await expect(
        adminNav.getByRole("link", { name: "إدارة المستخدمين" }),
      ).toBeVisible();

      // 2. Create the custom role: backoffice.access + users.read only.
      await admin.goto("/ar/admin/access/roles");
      await expect(
        admin.getByRole("heading", { level: 1, name: "الأدوار" }),
      ).toBeVisible();
      await admin.getByRole("button", { name: "إنشاء دور" }).click();
      const createPanel = admin.locator(".admin-roles-detail");
      await createPanel.getByLabel("اسم الدور").fill(CUSTOM_ROLE);
      await createPanel.getByLabel("الوصول إلى لوحة الإدارة").check();
      await createPanel.getByLabel("عرض المستخدمين").check();
      await createPanel.getByRole("button", { name: "إنشاء دور" }).click();
      await admin.getByRole("button", { name: CUSTOM_ROLE }).click();
      const roleDetail = admin.locator(".admin-roles-detail");
      await expect(roleDetail).toContainText(CUSTOM_ROLE);

      // 3. Assign it to the staff user via the users page.
      await admin.goto("/ar/admin/access/users");
      await expect(
        admin.getByRole("heading", { level: 1, name: "المستخدمون" }),
      ).toBeVisible();
      const staffRow = admin.locator(".admin-users-row", {
        hasText: ACCESS_STAFF.email,
      });
      await staffRow
        .getByLabel("تعيين دور")
        .selectOption({ label: CUSTOM_ROLE }, { timeout: 15_000 });
      await staffRow.getByRole("button", { name: "تعيين" }).click();
      await expect(staffRow).toContainText(CUSTOM_ROLE);

      // 4. Staff authenticates → exactly the granted scope.
      await staff.goto("/ar/admin/login");
      await submitSignIn(staff, AR_SIGN_IN, ACCESS_STAFF);
      await expect(staff).toHaveURL(/\/ar\/admin\/mfa\/setup$/);
      await completeMfaEnrollment(staff, AR_SETUP, ACCESS_STAFF.password);
      await expect(staff).toHaveURL(/\/ar\/admin$/);
      const staffNav = getAdminNavigation(staff, "ar");
      await expect(
        staffNav.getByRole("link", { name: "إدارة المستخدمين" }),
      ).toBeVisible();
      await expect(
        staffNav.getByRole("link", { name: "إدارة الأدوار" }),
      ).toHaveCount(0);

      await staff.goto("/ar/admin/access/users");
      await expect(
        staff.getByRole("heading", { level: 1, name: "المستخدمون" }),
      ).toBeVisible();

      await staff.goto("/ar/admin/access/roles");
      await expect(
        staff.getByRole("heading", { level: 1, name: "تم رفض الوصول" }),
      ).toBeVisible();

      // 5. Deactivate the granting role — next request is denied,
      //    the staff session itself is untouched (no re-login).
      await admin.goto("/ar/admin/access/roles");
      await admin.getByRole("button", { name: CUSTOM_ROLE }).click();
      const roleDetailAfterDeactivate = admin.locator(".admin-roles-detail");
      await roleDetailAfterDeactivate
        .getByRole("button", { name: "إلغاء التنشيط" })
        .click();
      await expect(
        admin
          .locator(".admin-roles-list")
          .getByRole("button", { name: CUSTOM_ROLE }),
      ).toContainText("غير نشط");

      await staff.goto("/ar/admin");
      await expect(
        staff.getByRole("heading", { level: 1, name: "تم رفض الوصول" }),
      ).toBeVisible();
      await staff.goto("/ar/admin/access/users");
      await expect(
        staff.getByRole("heading", { level: 1, name: "تم رفض الوصول" }),
      ).toBeVisible();
    } finally {
      await adminContext.close();
      await staffContext.close();
    }
  });
});

test.describe("backoffice RBAC (en smoke)", () => {
  test("denied user gets the localized access-denied page under /en; zero-role user is denied", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    test.skip(!hasDatabase(), "rbac e2e requires DATABASE_URL");
    // Zero roles → even /en/admin is denied (no backoffice.access).
    await seedE2eUser(ACCESS_DENIED, { admin: false });

    await page.goto("/en/admin/login");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await submitSignIn(page, EN_SIGN_IN, ACCESS_DENIED);
    await expect(page).toHaveURL(/\/en\/admin\/mfa\/setup$/);
    await completeMfaEnrollment(page, EN_SETUP, ACCESS_DENIED.password);
    await expect(page).toHaveURL(/\/en\/admin$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Access denied" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    // Unauthenticated redirect still preserves the locale.
    await page.goto("/en/admin/access/roles");
    // Authenticated but unauthorized — denied page, not a login redirect.
    await expect(
      page.getByRole("heading", { level: 1, name: "Access denied" }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/login/);
  });
});
