import { hasLocale } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { getFormattingLocale, resolveRequestConfig } from "@/i18n/config";
import { getDirection, routing } from "@/i18n/routing";
import { PERMISSION_KEYS } from "@/modules/identity/domain/permissions";
import type { HomepageCompletenessIssueKey } from "@/modules/homepage";
import {
  collectHomepageCompletenessIssues,
  emptyHomepageDraft,
} from "@/modules/homepage";

function permissionLabel(catalog: typeof en, key: string): string | undefined {
  const labels = catalog.access.permissions;
  const node = key.split(".").reduce<unknown>((current, segment) => {
    if (
      current !== null &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, labels);
  return typeof node === "string" ? node : undefined;
}

const HOMEPAGE_COMPLETENESS_CODES = [
  "hero.title.bilingual",
  "hero.cta.labels.bilingual",
  "hero.cta.target",
  "news.heading.bilingual",
  "news.manual.required",
  "news.targets.unavailable",
] as const satisfies readonly HomepageCompletenessIssueKey[];

function nestedMessage(
  catalog: typeof en,
  root: "homepage",
  dottedKey: string,
): string | undefined {
  const node = dottedKey.split(".").reduce<unknown>((current, segment) => {
    if (
      current !== null &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, catalog[root].completeness);
  return typeof node === "string" ? node : undefined;
}

function assertNoDottedJsonKeys(value: unknown, path: string) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    expect(key, `${path}.${key}`).not.toMatch(/\./);
    assertNoDottedJsonKeys(child, `${path}.${key}`);
  }
}

function permissionGroupLabel(
  catalog: typeof en,
  prefix: string,
): string | undefined {
  const label =
    catalog.access.permissionGroups[
      prefix as keyof typeof catalog.access.permissionGroups
    ];
  return typeof label === "string" ? label : undefined;
}

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
  // Segment arrays — JSON keys may legitimately contain "." (e.g. the
  // access.permissions map keyed by dotted permission identifiers).
  const keyPaths = (value: unknown, prefix: string[] = []): string[][] =>
    Object.entries(value as Record<string, unknown>).flatMap(([key, v]) =>
      v !== null && typeof v === "object"
        ? keyPaths(v, [...prefix, key])
        : [[...prefix, key]],
    );

  it("ar and en catalogs expose identical key structure", () => {
    const printable = (paths: string[][]) =>
      paths.map((p) => p.join(" ")).sort();
    expect(printable(keyPaths(ar))).toEqual(printable(keyPaths(en)));
  });

  it("every catalog value is a non-empty string", () => {
    for (const catalog of [ar, en]) {
      for (const path of keyPaths(catalog)) {
        const value = path.reduce<unknown>(
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

  it("homepage completeness messages use nested keys (no literal dots)", () => {
    assertNoDottedJsonKeys(en.homepage.completeness, "homepage.completeness");
    assertNoDottedJsonKeys(ar.homepage.completeness, "homepage.completeness");
  });

  it("resolves every homepage completeness code in ar and en", () => {
    for (const code of HOMEPAGE_COMPLETENESS_CODES) {
      for (const catalog of [ar, en]) {
        const label = nestedMessage(catalog, "homepage", code);
        expect(label, code).toBeDefined();
        expect(label!.trim().length).toBeGreaterThan(0);
        expect(label).not.toBe(code);
      }
    }
  });

  it("maps incomplete homepage drafts to localized completeness messages", () => {
    const draft = emptyHomepageDraft();
    draft.sections[0]!.hero!.translations.ar.title = "ع";
    draft.sections[0]!.hero!.translations.en.title = "E";
    const issues = collectHomepageCompletenessIssues(draft);
    expect(issues).toContain("news.heading.bilingual");
    const enLabel = nestedMessage(en, "homepage", "news.heading.bilingual");
    expect(enLabel).toMatch(/News section heading/i);
    expect(collectHomepageCompletenessIssues(emptyHomepageDraft())).toContain(
      "hero.title.bilingual",
    );
  });

  it("localizes every seeded permission key for the roles admin UI", () => {
    for (const key of PERMISSION_KEYS) {
      const prefix = key.split(".")[0] ?? key;
      for (const catalog of [ar, en]) {
        expect(permissionLabel(catalog, key)).toBeDefined();
        expect(permissionLabel(catalog, key)).not.toBe(key);
        expect(permissionGroupLabel(catalog, prefix)).toBeDefined();
        expect(permissionGroupLabel(catalog, prefix)).not.toBe(prefix);
      }
    }
  });
});
