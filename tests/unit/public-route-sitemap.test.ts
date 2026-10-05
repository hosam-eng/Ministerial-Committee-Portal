import { describe, expect, it } from "vitest";

import { listManagedPagePublicRoutePaths } from "@/modules/managed-pages/public-route-paths";
import { listNewsPublicRoutePaths } from "@/modules/publishing/public-route-paths";
import { staticPublicRoutePaths } from "@/platform/public-routes/static-contributor";
import { buildPublicSitemapEntries } from "@/platform/public-routes/sitemap";
import type { Database } from "@/platform/database";

const emptyDb = {
  prisma: {
    news: { findMany: async () => [] },
    managedPage: { findMany: async () => [] },
  },
} as unknown as Database;

describe("public route enumeration", () => {
  it("includes AR and EN static home and news list paths", () => {
    const paths = staticPublicRoutePaths();
    expect(paths.map((row) => row.pathname).sort()).toEqual(
      ["/ar", "/ar/news", "/en", "/en/news"].sort(),
    );
    expect(paths.every((row) => row.lastModified === undefined)).toBe(true);
  });

  it("static paths exclude admin and preview routes", () => {
    const paths = staticPublicRoutePaths();
    expect(paths.some((row) => row.pathname.includes("/admin"))).toBe(false);
  });

  it("includes live news translations without inventing missing locales", async () => {
    const db = {
      prisma: {
        news: {
          findMany: async () => [
            {
              publishedAt: new Date("2024-01-02T00:00:00.000Z"),
              liveRevision: {
                translations: [{ locale: "ar", slug: "only-ar" }],
              },
            },
          ],
        },
        managedPage: { findMany: async () => [] },
      },
    } as unknown as Database;
    const newsPaths = await listNewsPublicRoutePaths(db);
    expect(newsPaths).toHaveLength(1);
    expect(newsPaths[0]!.pathname).toBe("/ar/news/only-ar");
    expect(newsPaths[0]!.alternatePathnames).toEqual({});
  });

  it("maps sitemap alternates across different localized slugs for the same news", async () => {
    const db = {
      prisma: {
        news: {
          findMany: async () => [
            {
              publishedAt: new Date("2024-01-02T00:00:00.000Z"),
              liveRevision: {
                translations: [
                  { locale: "ar", slug: "التقرير-السنوي" },
                  { locale: "en", slug: "road-safety-annual-report" },
                ],
              },
            },
          ],
        },
        managedPage: { findMany: async () => [] },
      },
    } as unknown as Database;
    const newsPaths = await listNewsPublicRoutePaths(db);
    expect(newsPaths).toHaveLength(2);
    const ar = newsPaths.find((row) => row.locale === "ar")!;
    const en = newsPaths.find((row) => row.locale === "en")!;
    expect(ar.pathname).toBe("/ar/news/التقرير-السنوي");
    expect(ar.alternatePathnames.en).toBe("/en/news/road-safety-annual-report");
    expect(en.alternatePathnames.ar).toBe("/ar/news/التقرير-السنوي");

    const entries = buildPublicSitemapEntries(
      newsPaths,
      "https://portal.example.gov.sa",
    );
    const arEntry = entries.find((row) => row.url.includes("/ar/news/"));
    expect(arEntry?.alternates?.languages?.en).toBe(
      "https://portal.example.gov.sa/en/news/road-safety-annual-report",
    );
  });

  it("includes live managed page paths", async () => {
    const db = {
      prisma: {
        news: { findMany: async () => [] },
        managedPage: {
          findMany: async () => [
            {
              publishedAt: new Date("2024-03-01T00:00:00.000Z"),
              liveRevision: {
                translations: [
                  { locale: "en", slug: "about" },
                  { locale: "ar", slug: "about-ar" },
                ],
              },
            },
          ],
        },
      },
    } as unknown as Database;
    const pagePaths = await listManagedPagePublicRoutePaths(db);
    expect(pagePaths).toHaveLength(2);
  });

  it("returns no sitemap entries when PUBLIC_SITE_ORIGIN is absent", () => {
    const entries = buildPublicSitemapEntries(
      staticPublicRoutePaths(),
      undefined,
    );
    expect(entries).toEqual([]);
  });

  it("emits absolute sitemap URLs when origin is configured", () => {
    const entries = buildPublicSitemapEntries(
      staticPublicRoutePaths(),
      "https://portal.example.gov.sa",
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((row) => row.url.startsWith("https://"))).toBe(true);
    expect(entries.some((row) => row.url.endsWith("/en/news"))).toBe(true);
  });
});
