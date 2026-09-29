import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import {
  completeMfaEnrollment,
  hasDatabase,
  seedE2eUser,
  submitSignIn,
} from "./support/auth";

const USER = {
  email: "e2e.corr2@example.test",
  name: "E2E CORR2",
  password: "e2e-corr2-password-1234",
} as const;

const EVIDENCE = path.resolve(
  import.meta.dirname,
  "../../docs/implementation/evidence/IMP-13/corr-2-phase-a",
);

async function measurePublic(page: Page) {
  return page.evaluate(() => {
    const pick = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        width: r.width,
        height: r.height,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        maxWidth: cs.maxWidth,
      };
    };
    const root = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    return {
      htmlFont: root.fontSize,
      bodyFont: body.fontSize,
      bodyLineHeight: body.lineHeight,
      headerInner: pick(".public-shell .shell-header-inner"),
      main: pick(".public-shell .shell-main"),
      logo: pick(".public-shell .shell-logo img"),
      h1: pick(".public-shell h1, .public-news h1"),
      nav: pick(".public-shell .shell-main-nav .shell-nav-link"),
      lang: pick(".public-shell .shell-lang"),
    };
  });
}

async function measureAdmin(page: Page) {
  return page.evaluate(() => {
    const pick = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        width: r.width,
        height: r.height,
        fontSize: cs.fontSize,
        maxWidth: cs.maxWidth,
      };
    };
    return {
      workspace: pick(".admin-shell-workspace"),
      main: pick(".admin-shell-main"),
      nav: pick(".admin-shell-sidebar .admin-shell-nav-link"),
      h1: pick(".admin-page-header h1, .admin-home h1"),
      input: pick(".ui-input"),
      button: pick(".ui-button-primary"),
    };
  });
}

async function measureAuth(page: Page) {
  return page.evaluate(() => {
    const pick = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height, fontSize: cs.fontSize };
    };
    return {
      card: pick(".auth-card"),
      input: pick(".ui-input"),
      button: pick(".ui-button-primary"),
      h1: pick(".auth-card h1"),
    };
  });
}

test.use({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000",
});

test.describe("CORR-2 Phase A evidence", () => {
  test.beforeAll(async () => {
    test.skip(!hasDatabase(), "CORR-2 evidence requires DATABASE_URL");
    await seedE2eUser(USER);
  });

  test("captures public, auth, and admin reference screenshots", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    mkdirSync(EVIDENCE, { recursive: true });
    const after: Record<string, unknown> = {};

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ar/news");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    after.publicNews1440 = await measurePublic(page);
    await page.screenshot({
      path: path.join(EVIDENCE, "public-news-ar-1440.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/ar/news");
    await page.screenshot({
      path: path.join(EVIDENCE, "public-news-ar-1920.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ar/news");
    await page.screenshot({
      path: path.join(EVIDENCE, "public-news-ar-390.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ar");
    await page.screenshot({
      path: path.join(EVIDENCE, "public-home-ar-1440.png"),
      fullPage: true,
    });

    await page.goto("/en/news");
    await page.screenshot({
      path: path.join(EVIDENCE, "public-news-en-1440.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ar/admin/login");
    after.login1440 = await measureAuth(page);
    await page.screenshot({
      path: path.join(EVIDENCE, "admin-login-ar-1440.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/ar/admin/login");
    await page.screenshot({
      path: path.join(EVIDENCE, "admin-login-ar-1920.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ar/admin/login");
    await submitSignIn(
      page,
      {
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        submit: "تسجيل الدخول",
      },
      USER,
    );
    await expect(page).toHaveURL(/\/ar\/admin\/mfa\/setup$/);
    await completeMfaEnrollment(
      page,
      {
        password: "كلمة المرور",
        continue: "متابعة",
        code: "رمز تطبيق المصادقة",
        submit: "تحقق",
      },
      USER.password,
    );
    await expect(page).toHaveURL(/\/ar\/admin$/);
    await expect(page.locator(".admin-home h1")).toBeVisible();
    after.adminHome1440 = await measureAdmin(page);
    await page.screenshot({
      path: path.join(EVIDENCE, "admin-home-ar-1440.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/ar/admin");
    await page.screenshot({
      path: path.join(EVIDENCE, "admin-home-ar-1920.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en/admin");
    await page.screenshot({
      path: path.join(EVIDENCE, "admin-home-en-1440.png"),
      fullPage: true,
    });

    await page.goto("/ar/admin/content/news");
    after.adminNews1440 = await measureAdmin(page);
    await page.screenshot({
      path: path.join(EVIDENCE, "admin-news-list-ar-1440.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/ar/admin/content/news");
    await page.screenshot({
      path: path.join(EVIDENCE, "admin-news-list-ar-1920.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ar/admin/content/news");
    await page.screenshot({
      path: path.join(EVIDENCE, "admin-news-list-ar-390.png"),
      fullPage: true,
    });

    writeFileSync(
      path.join(EVIDENCE, "computed-audit-after.json"),
      JSON.stringify(after, null, 2),
      "utf8",
    );
  });
});
