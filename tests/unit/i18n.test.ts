import { hasLocale } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { getFormattingLocale, resolveRequestConfig } from "@/i18n/config";
import { getDirection, routing } from "@/i18n/routing";

describe("localization routing config", () => {
  it("supports exactly ar and en with ar as default", () => {
    expect(routing.locales).toEqual(["ar", "en"]);
    expect(routing.defaultLocale).toBe("ar");
    expect(routing.localePrefix).toBe("always");
    expect(routing.localeDetection).toBe(false);
  });

  it("validates only supported locales", () => {
    expect(hasLocale(routing.locales, "ar")).toBe(true);
    expect(hasLocale(routing.locales, "en")).toBe(true);
    expect(hasLocale(routing.locales, "fr")).toBe(false);
    expect(hasLocale(routing.locales, "ar-sa")).toBe(false);
    expect(hasLocale(routing.locales, undefined)).toBe(false);
    expect(hasLocale(routing.locales, "../en")).toBe(false);
  });

  it("maps ar to rtl and en to ltr", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
  });

  it("maps route locales to Saudi formatting locales", () => {
    expect(getFormattingLocale("ar")).toBe("ar-SA");
    expect(getFormattingLocale("en")).toBe("en-SA");
    // Formatting locales are never public route locales.
    for (const formatting of [
      getFormattingLocale("ar"),
      getFormattingLocale("en"),
    ]) {
      expect(hasLocale(routing.locales, formatting)).toBe(false);
    }
  });
});

describe("request configuration", () => {
  it("ar → ar-SA formatting locale, Asia/Riyadh, Arabic catalog", async () => {
    const config = await resolveRequestConfig("ar");
    expect(config.locale).toBe("ar-SA");
    expect(config.timeZone).toBe("Asia/Riyadh");
    expect(config.messages?.home?.title).toBe(ar.home.title);
  });

  it("en → en-SA formatting locale, Asia/Riyadh, English catalog", async () => {
    const config = await resolveRequestConfig("en");
    expect(config.locale).toBe("en-SA");
    expect(config.timeZone).toBe("Asia/Riyadh");
    expect(config.messages?.home?.title).toBe(en.home.title);
  });

  it("rejects an unsupported locale to the default at config level", async () => {
    const config = await resolveRequestConfig("fr");
    expect(config.locale).toBe("ar-SA");
    expect(config.messages?.home?.title).toBe(ar.home.title);
  });
});

describe("message catalog alignment", () => {
  const keyPaths = (value: unknown, prefix = ""): string[] =>
    Object.entries(value as Record<string, unknown>).flatMap(([key, v]) =>
      v !== null && typeof v === "object"
        ? keyPaths(v, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );

  it("ar and en catalogs expose identical key structure", () => {
    expect(keyPaths(ar).sort()).toEqual(keyPaths(en).sort());
  });

  it("every catalog value is a non-empty string", () => {
    for (const catalog of [ar, en]) {
      for (const path of keyPaths(catalog)) {
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, segment) => (node as Record<string, unknown>)[segment],
            catalog,
          );
        expect(typeof value).toBe("string");
        expect((value as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("language-switch labels point at the other language", () => {
    expect(ar.home.switchToLanguage).toBe("English");
    expect(en.home.switchToLanguage).toBe("العربية");
  });
});
