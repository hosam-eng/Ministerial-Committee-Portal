import { createOTP } from "@better-auth/utils/otp";
import { expect, test } from "@playwright/test";

import {
  E2E_USER,
  hasDatabase,
  seedE2eUser,
  submitMfaVerify,
  submitSignIn,
} from "./support/auth";

const AR_MFA = {
  totp: "رمز تطبيق المصادقة",
  backup: "رمز النسخ الاحتياطي",
  submit: "تحقق",
} as const;

const AR_SIGN_IN = {
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  submit: "تسجيل الدخول",
} as const;

/**
 * The enrollment URI carries a base32-encoded secret while
 * `createOTP`/`verify` operate on the raw secret string — decode back
 * to raw bytes before generating codes. Minimal RFC 4648 decoder
 * (unpadded, as emitted by the enrollment URI).
 */
function base32DecodeToRawSecret(encoded: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = encoded
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "")
    .split("")
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return String.fromCharCode(...bytes);
}

/**
 * IMP-05 authentication journeys against the production build.
 *
 * Requires DATABASE_URL (PostgreSQL 18 with applied migrations). The
 * Arabic spec runs the representative full journey; the English spec
 * only proves English/LTR rendering and /en-scoped redirects — the
 * journey itself is not duplicated per the task.
 */

// The whole file shares one fixture user — serial within the file.
test.describe.configure({ mode: "serial" });

test.describe("admin auth journey (ar)", () => {
  test.beforeAll(async () => {
    test.skip(!hasDatabase(), "auth e2e requires DATABASE_URL");
    await seedE2eUser();
  });

  test("unauthenticated /ar/admin redirects to /ar/admin/login", async ({
    page,
  }) => {
    await page.goto("/ar/admin");
    await expect(page).toHaveURL(/\/ar\/admin\/login$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("password → mandatory MFA setup → challenge → backup code → logout", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    // 1. /ar/admin/login renders Arabic RTL.
    await page.goto("/ar/admin/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // 2. Wrong credentials → generic error, stays on login.
    await submitSignIn(page, AR_SIGN_IN, {
      email: E2E_USER.email,
      password: "wrong-password-9999",
    });
    await expect(page.locator(".auth-error")).toHaveText(
      "بيانات الدخول غير صحيحة.",
    );

    // 3. Correct credentials → session created, MFA not enrolled →
    //    forwarded to mandatory setup.
    await submitSignIn(page, AR_SIGN_IN, E2E_USER);
    await expect(page).toHaveURL(/\/ar\/admin\/mfa\/setup$/);

    // 4. Enrollment requires the password, then shows the TOTP URI
    //    and single-use backup codes exactly once.
    await page.getByLabel("كلمة المرور").fill(E2E_USER.password);
    await page.getByRole("button", { name: "متابعة" }).click();
    const uri = await page.locator(".auth-secret").innerText();
    const encodedSecret = new URL(uri).searchParams.get("secret");
    expect(encodedSecret).toBeTruthy();
    const secret = base32DecodeToRawSecret(encodedSecret!);
    const backupCodes = await page
      .locator(".auth-backup-codes li code")
      .allInnerTexts();
    expect(backupCodes.length).toBe(10);

    // 5. Enrollment activates only after a valid TOTP code.
    const code = await createOTP(secret).totp();
    await submitMfaVerify(
      page,
      { code: AR_MFA.totp, submit: AR_MFA.submit },
      code,
    );
    await expect(page).toHaveURL(/\/ar\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "تم تسجيل الدخول بنجاح",
    );
    await expect(
      page.getByText(`البريد الإلكتروني: ${E2E_USER.email}`),
    ).toBeVisible();

    // 6. Logout revokes the session → back to login; /admin redirects.
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL(/\/ar\/admin\/login$/);
    await page.goto("/ar/admin");
    await expect(page).toHaveURL(/\/ar\/admin\/login$/);

    // 7. Password alone no longer completes login — TOTP challenge.
    await submitSignIn(page, AR_SIGN_IN, E2E_USER);
    await expect(page).toHaveURL(/\/ar\/admin\/mfa$/);
    await expect(page.locator(".auth-error")).toHaveCount(0);

    // A code for the current step could equal the consumed enrollment
    // code — use the next step's code (still inside the ±1 window) if so.
    const otp = createOTP(secret);
    let challengeCode = await otp.totp();
    if (challengeCode === code) {
      challengeCode = await otp.hotp(Math.floor(Date.now() / 30_000) + 1);
    }
    await submitMfaVerify(
      page,
      { code: AR_MFA.totp, submit: AR_MFA.submit },
      challengeCode,
    );
    await expect(page).toHaveURL(/\/ar\/admin$/);

    // 7b. IMP-05 replay correction: an accepted TOTP is one-time
    //     material. Re-submitting it on a fresh login inside its
    //     validity window is rejected with the generic failure.
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL(/\/ar\/admin\/login$/);
    await submitSignIn(page, AR_SIGN_IN, E2E_USER);
    await expect(page).toHaveURL(/\/ar\/admin\/mfa$/);
    await submitMfaVerify(
      page,
      { code: AR_MFA.totp, submit: AR_MFA.submit },
      challengeCode,
    );
    await expect(page.locator(".auth-error")).toHaveText(
      "الرمز غير صالح أو منتهي الصلاحية.",
    );
    await expect(page).toHaveURL(/\/ar\/admin\/mfa$/);

    // 7c. A fresh TOTP generated for a later time step still succeeds.
    //     Wait until the current-step code differs from BOTH codes this
    //     session already consumed (enrollment `code` and `challengeCode`)
    //     — same-step timing can make totp() equal the enrollment code.
    let freshCode = challengeCode;
    while (freshCode === challengeCode || freshCode === code) {
      await page.waitForTimeout(1_000);
      freshCode = await otp.totp();
    }
    await submitMfaVerify(
      page,
      { code: AR_MFA.totp, submit: AR_MFA.submit },
      freshCode,
    );
    await expect(page).toHaveURL(/\/ar\/admin$/);

    // 8. Backup-code recovery path.
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL(/\/ar\/admin\/login$/);
    await submitSignIn(page, AR_SIGN_IN, E2E_USER);
    await expect(page).toHaveURL(/\/ar\/admin\/mfa$/);
    await page
      .getByRole("button", { name: "استخدام رمز نسخ احتياطي بدلاً من ذلك" })
      .click();
    await submitMfaVerify(
      page,
      { code: AR_MFA.backup, submit: AR_MFA.submit },
      backupCodes[0],
    );
    await expect(page).toHaveURL(/\/ar\/admin$/);
  });
});

test.describe("auth API routing (IMP-05 regression)", () => {
  test("/api/auth/* is unlocalized and carries x-request-id", async ({
    request,
  }) => {
    test.skip(!hasDatabase(), "auth api check requires DATABASE_URL");
    const response = await request.get("/api/auth/get-session");
    expect(response.status()).toBe(200);
    expect(await response.json()).toBeNull();
    // The proxy request-id header still flows on auth API traffic.
    expect(response.headers()["x-request-id"]).toBeTruthy();
  });

  test("/ar/api/auth/* is not an auth endpoint", async ({ request }) => {
    const response = await request.get("/ar/api/auth/get-session");
    expect(response.status()).toBe(404);
  });
});

test.describe("admin auth (en)", () => {
  test.beforeAll(async () => {
    test.skip(!hasDatabase(), "auth e2e requires DATABASE_URL");
    await seedE2eUser();
  });

  test("unauthenticated /en/admin redirects under /en and renders LTR", async ({
    page,
  }) => {
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en\/admin\/login$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Sign in to the admin console",
      }),
    ).toBeVisible();
  });
});
