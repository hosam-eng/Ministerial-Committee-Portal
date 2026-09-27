import { expect, test } from "@playwright/test";

/**
 * IMP-04 localization journeys: explicit /ar + /en routes, server-rendered
 * lang/dir, language switch, safe handling of unsupported locales, and
 * API routes staying outside locale routing.
 */

test.describe("locale routing", () => {
  test("/ redirects to the Arabic default locale", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/ar$/);
  });

  test("/ar renders Arabic with server-rendered lang=ar dir=rtl", async ({
    page,
  }) => {
    await page.goto("/ar");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "اللجنة الوزارية للسلامة المرورية",
    );
    await expect(
      page.getByText("البوابة الرقمية للجنة الوزارية للسلامة المرورية."),
    ).toBeVisible();
  });

  test("/en renders English with server-rendered lang=en dir=ltr", async ({
    page,
  }) => {
    await page.goto("/en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Ministerial Committee for Traffic Safety",
    );
    await expect(
      page.getByText(
        "The digital portal of the Ministerial Committee for Traffic Safety.",
      ),
    ).toBeVisible();
  });

  test("language switch navigates /ar → /en → /ar", async ({ page }) => {
    await page.goto("/ar");

    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await page.getByRole("link", { name: "العربية" }).click();
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("language switch is keyboard reachable", async ({ page }) => {
    await page.goto("/ar");
    // Focus order: skip link → identity → language switch (IMP-08 shell).
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "التخطي إلى المحتوى الرئيسي" }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "English" })).toBeFocused();
  });

  test("unsupported locale does not silently render a supported locale", async ({
    page,
  }) => {
    const response = await page.goto("/fr");
    expect(response?.status()).toBe(404);
    // "/fr" has no valid locale prefix; the proxy redirects it under the
    // default locale, where the catch-all renders the localized 404 —
    // never a silent homepage.
    await expect(page).toHaveURL(/\/ar\/fr$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "الصفحة غير موجودة",
    );
  });

  test("/ar/anything-unknown renders the localized not-found page", async ({
    page,
  }) => {
    const response = await page.goto("/ar/anything-unknown");
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "الصفحة غير موجودة",
    );
  });
});

test.describe("API routes stay outside locale routing", () => {
  test("/api/health/live responds unlocalized with x-request-id", async ({
    request,
  }) => {
    const response = await request.get("/api/health/live");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers()["x-request-id"]).toBeTruthy();
  });

  test("localized API path does not exist", async ({ request }) => {
    const response = await request.get("/ar/api/health/live");
    expect(response.status()).toBe(404);
  });
});
