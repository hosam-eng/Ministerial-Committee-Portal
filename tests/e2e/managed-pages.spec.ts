import path from "node:path";

import { createOTP } from "@better-auth/utils/otp";
import { expect, test } from "@playwright/test";

import {
  hasDatabase,
  seedE2eUser,
  submitMfaEnable,
  submitMfaVerify,
  submitSignIn,
} from "./support/auth";

const USER = {
  email: "e2e.pages@example.test",
  name: "E2E Pages",
  password: "e2e-pages-password-1234",
} as const;

const EVIDENCE = path.resolve(
  import.meta.dirname,
  "../../../docs/implementation/evidence/IMP-13",
);

test.use({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000",
});

test.describe("managed pages acceptance", () => {
  test.beforeAll(async () => {
    test.skip(!hasDatabase(), "managed pages e2e requires DATABASE_URL");
    await seedE2eUser(USER);
  });

  test("creates, previews, publishes, redirects, restores, and unpublishes", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const stamp = Date.now().toString(36);
    const arSlug = `lajna-${stamp}`;
    const enSlug = `committee-${stamp}`;
    const arSlugNext = `${arSlug}-2`;
    const enSlugNext = `${enSlug}-2`;

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ar/admin/login");
    await expect(
      page.getByRole("heading", { name: "تسجيل الدخول إلى لوحة الإدارة" }),
    ).toBeVisible();
    await submitSignIn(
      page,
      {
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        submit: "تسجيل الدخول",
      },
      USER,
    );
    if (await page.locator(".auth-error").isVisible()) {
      throw new Error(
        `sign-in stayed on login: ${await page.locator(".auth-error").innerText()}`,
      );
    }
    await expect(page).toHaveURL(/\/ar\/admin\/mfa\/setup$/, {
      timeout: 45_000,
    });
    await submitMfaEnable(
      page,
      { password: "كلمة المرور", submit: "متابعة" },
      USER.password,
    );
    const uri = await page.locator(".auth-secret").innerText();
    const encodedSecret = new URL(uri).searchParams.get("secret");
    if (!encodedSecret) throw new Error("enrollment URI missing secret");
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const bits = encodedSecret
      .toUpperCase()
      .replace(/[^A-Z2-7]/g, "")
      .split("")
      .map((character) =>
        alphabet.indexOf(character).toString(2).padStart(5, "0"),
      )
      .join("");
    const bytes: number[] = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) {
      bytes.push(parseInt(bits.slice(index, index + 8), 2));
    }
    const code = await createOTP(String.fromCharCode(...bytes)).totp();
    await submitMfaVerify(
      page,
      { code: "رمز تطبيق المصادقة", submit: "تحقق" },
      code,
    );
    await expect(page).toHaveURL(/\/ar\/admin$/);

    await page.goto("/ar/admin/content/pages");
    await expect(
      page.getByRole("heading", { level: 1, name: "الصفحات المُدارة" }),
    ).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE, "managed-pages-admin-list-ar.png"),
      fullPage: true,
    });

    await page.getByRole("link", { name: "إنشاء صفحة" }).click();
    await page.getByRole("button", { name: "إنشاء مسودة" }).click();
    await expect(page).toHaveURL(/\/ar\/admin\/content\/pages\/[0-9a-f-]+$/i);
    const editorUrl = page.url();

    await page.getByRole("button", { name: "إضافة نص منسق" }).click();
    await page.getByRole("button", { name: "إضافة تنبيه" }).click();
    await page.getByRole("button", { name: "إضافة قائمة روابط" }).click();
    await page.getByRole("button", { name: "إضافة رابط" }).click();
    await page.getByLabel("عنوان خارجي").fill("https://example.com/committee");

    await page.locator("#title_ar").fill("عن اللجنة");
    await page.locator("#intro_ar").fill("مقدمة عن عمل اللجنة الوزارية.");
    await page.locator("#slug_ar").fill(arSlug);
    await page.locator("#seoTitle_ar").fill("عن اللجنة");
    await page.locator("#seoDescription_ar").fill("وصف الصفحة العربية.");
    await page
      .locator("[id^='callout_body_'][id$='_ar']")
      .fill("تنبيه مؤسسي للعربية.");
    await page
      .locator("[id^='link_heading_'][id$='_ar']")
      .fill("روابط ذات صلة");
    await page.locator("[id^='link_label_'][id$='_ar']").fill("موقع اللجنة");
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("نص عربي منشور");
    await page.screenshot({
      path: path.join(EVIDENCE, "managed-page-editor-ar-1440.png"),
      fullPage: true,
    });

    await page.getByRole("tab", { name: "المحتوى الإنجليزي" }).click();
    await page.locator("#title_en").fill("About the committee");
    await page.locator("#intro_en").fill("An introduction to the committee.");
    await page.locator("#slug_en").fill(enSlug);
    await page.locator("#seoTitle_en").fill("About the committee");
    await page.locator("#seoDescription_en").fill("English page description.");
    await page
      .locator("[id^='callout_body_'][id$='_en']")
      .fill("Institutional callout.");
    await page
      .locator("[id^='link_heading_'][id$='_en']")
      .fill("Related links");
    await page
      .locator("[id^='link_label_'][id$='_en']")
      .fill("Committee website");
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("Published English text");
    await page.screenshot({
      path: path.join(EVIDENCE, "managed-page-editor-en-1440.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "حفظ المسودة" }).click();
    await expect(page.getByText("حُفظت المسودة.")).toBeVisible();
    await page.getByRole("button", { name: "إرسال للمراجعة" }).click();
    await expect(page.getByText("أُرسلت للمراجعة.")).toBeVisible();

    const preview = page.getByRole("link", { name: "معاينة العربية" }).first();
    const previewHref = await preview.getAttribute("href");
    if (!previewHref) throw new Error("missing Arabic preview link");
    const anonymous = await request.get(previewHref, { maxRedirects: 0 });
    expect(anonymous.status()).not.toBe(200);
    const previewResponse = await page.goto(previewHref);
    const cacheControl = previewResponse?.headers()["cache-control"] ?? "";
    expect(cacheControl).toMatch(/no-store|no-cache/u);
    expect(previewResponse?.headers()["x-robots-tag"] ?? "").toContain(
      "noindex",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/u,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "عن اللجنة" }),
    ).toBeVisible();
    await expect(page.getByText("نص عربي منشور")).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE, "managed-page-preview-ar-1440.png"),
      fullPage: true,
    });
    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/preview\/managed-pages\//u);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByText("Published English text")).toBeVisible();

    await page.goto(editorUrl);
    await page.getByRole("button", { name: "اعتماد" }).click();
    await expect(page.getByText("اعتُمدت ولم تُنشر بعد.")).toBeVisible();
    const liveBeforePublish = await request.get(`/ar/pages/${arSlug}`, {
      maxRedirects: 0,
    });
    expect(liveBeforePublish.status()).toBe(404);
    await page.getByRole("button", { name: "نشر", exact: true }).click();
    await expect(
      page.getByText("نُشرت وأصبحت المراجعة المعتمدة هي الظاهرة."),
    ).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/ar/pages/${arSlug}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: "عن اللجنة" }),
    ).toBeVisible();
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(canonical).toContain(`/ar/pages/${arSlug}`);
    const alternate = page.locator('link[rel="alternate"][hreflang="en"]');
    await expect(alternate).toHaveAttribute(
      "href",
      new RegExp(`/en/pages/${enSlug}$`, "u"),
    );
    const language = page.getByRole("link", { name: "English" });
    await expect(language).toHaveAttribute("href", `/en/pages/${enSlug}`);
    await page.screenshot({
      path: path.join(EVIDENCE, "managed-page-public-ar-1440.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(EVIDENCE, "managed-page-public-ar-390.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/en/pages/${enSlug}`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(
      page.getByRole("heading", { level: 1, name: "About the committee" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "العربية" })).toHaveAttribute(
      "href",
      `/ar/pages/${arSlug}`,
    );
    await page.screenshot({
      path: path.join(EVIDENCE, "managed-page-public-en-1440.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(EVIDENCE, "managed-page-public-en-390.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(editorUrl);
    await page.getByRole("button", { name: "تحرير الصفحة المنشورة" }).click();
    await expect(
      page.getByText("أُنشئت مراجعة تحريرية جديدة دون تغيير النسخة المنشورة."),
    ).toBeVisible();
    const unchanged = await request.get(`/ar/pages/${arSlug}`);
    expect(unchanged.status()).toBe(200);
    await page.locator("#slug_ar").fill(arSlugNext);
    await page.getByRole("tab", { name: "المحتوى الإنجليزي" }).click();
    await page.locator("#slug_en").fill(enSlugNext);
    await page.getByRole("button", { name: "حفظ المسودة" }).click();
    await expect(page.getByText("حُفظت المسودة.")).toBeVisible();
    await page.getByRole("button", { name: "إرسال للمراجعة" }).click();
    await expect(page.getByText("أُرسلت للمراجعة.")).toBeVisible();
    await page.getByRole("button", { name: "اعتماد" }).click();
    await expect(page.getByText("اعتُمدت ولم تُنشر بعد.")).toBeVisible();
    await page.getByRole("button", { name: "نشر", exact: true }).click();
    await expect(
      page.getByText("نُشرت وأصبحت المراجعة المعتمدة هي الظاهرة."),
    ).toBeVisible();

    const redirect = await request.get(`/ar/pages/${arSlug}`, {
      maxRedirects: 0,
    });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location ?? "").toContain(
      `/ar/pages/${arSlugNext}`,
    );
    await page.goto(`/ar/pages/${arSlug}`);
    await expect(page).toHaveURL(new RegExp(`/ar/pages/${arSlugNext}$`, "u"));

    await page.goto(editorUrl);
    await page.getByRole("button", { name: "استعادة كمسودة" }).last().click();
    await expect(
      page.getByText(
        "استُعيدت مراجعة تاريخية كمسودة جديدة دون تغيير النسخة المنشورة.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "حفظ المسودة" }),
    ).toBeVisible();

    await page.locator("#unpublish-reason").fill("Withdrawn for acceptance");
    await page.getByRole("button", { name: "إلغاء النشر" }).click();
    await expect(
      page.getByText("أُلغي النشر مع الاحتفاظ بالمراجعات والسجل."),
    ).toBeVisible();
    const hidden = await request.get(`/ar/pages/${arSlugNext}`, {
      maxRedirects: 0,
    });
    expect(hidden.status()).toBe(404);
    const historical = await request.get(`/ar/pages/${arSlug}`, {
      maxRedirects: 0,
    });
    expect(historical.status()).toBe(404);
  });
});
