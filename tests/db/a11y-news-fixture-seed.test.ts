import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  approveNews,
  createNewsDraft,
  getEditorialNews,
  publishNews,
  saveNewsDraft,
  submitNews,
} from "@/modules/publishing";
import { resetServerConfigForTest } from "@/platform/config";
import { createDatabase, type Database } from "@/platform/database";
import { closeRuntimeDatabase } from "@/platform/runtime";

const REVIEWER_ID = "00000000-0000-4000-8000-000000000099";
const USER_EMAIL = "e2e.a11y.news@example.test";
export const A11Y_NEWS_SLUGS = {
  ar: "a11y-news-live-ar",
  en: "a11y-news-live-en",
} as const;

const ARTIFACT = path.resolve(
  import.meta.dirname,
  "../e2e/.cache/a11y-news-fixture.json",
);

let runtimeDatabase: Database;

async function approveActive(actorId: string, newsId: string) {
  const editorial = await getEditorialNews(actorId, newsId, runtimeDatabase);
  await runtimeDatabase.prisma.newsRevision.update({
    where: { id: editorial!.activeRevision!.id },
    data: { submittedById: REVIEWER_ID },
  });
  await approveNews(actorId, newsId, runtimeDatabase);
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  resetServerConfigForTest();
  await closeRuntimeDatabase();
  runtimeDatabase = createDatabase({
    connectionString: process.env.DATABASE_URL,
  });
}, 60_000);

afterAll(async () => {
  await runtimeDatabase?.close();
});

/** Invoked from Playwright via `vitest run` (server modules are not Playwright-safe). */
describe("a11y news fixture seed", () => {
  it("writes published News ids for axe E2E", async () => {
    if (!process.env.DATABASE_URL) return;
    const connectionString = process.env.DATABASE_URL;
    const client = new pg.Client({ connectionString });
    await client.connect();
    let fixture: { newsId: string; revisionId: string };
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(50506)");
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM identity."user" WHERE email = $1`,
        [USER_EMAIL],
      );
      const actorId = rows[0]?.id;
      if (!actorId) {
        throw new Error(
          `Missing ${USER_EMAIL} — call seedE2eUser(A11Y_NEWS_USER) before News a11y tests.`,
        );
      }

      const existing = await runtimeDatabase.prisma.news.findFirst({
        where: {
          publicationStatus: "PUBLISHED",
          liveRevision: {
            translations: {
              some: { locale: "ar", slug: A11Y_NEWS_SLUGS.ar },
            },
          },
        },
        select: { id: true, liveRevisionId: true },
      });
      if (existing?.liveRevisionId) {
        fixture = { newsId: existing.id, revisionId: existing.liveRevisionId };
      } else {
        const { newsId, editVersion } = await createNewsDraft(
          actorId,
          runtimeDatabase,
        );
        const saved = await saveNewsDraft(
          actorId,
          newsId,
          editVersion,
          {
            displayDate: "2024-06-01",
            categoryIds: [],
            translations: {
              ar: {
                title: "خبر إتاحة",
                slug: A11Y_NEWS_SLUGS.ar,
                summary: "ملخص",
                body: { version: 1, type: "plainText", text: "نص" },
              },
              en: {
                title: "A11y News",
                slug: A11Y_NEWS_SLUGS.en,
                summary: "Summary",
                body: { version: 1, type: "plainText", text: "Body" },
              },
            },
          },
          runtimeDatabase,
        );
        await submitNews(actorId, newsId, saved.editVersion, runtimeDatabase);
        await approveActive(actorId, newsId);
        await publishNews(actorId, newsId, runtimeDatabase);
        const published = await runtimeDatabase.prisma.news.findUniqueOrThrow({
          where: { id: newsId },
          select: { id: true, liveRevisionId: true },
        });
        expect(published.liveRevisionId).toBeTruthy();
        fixture = {
          newsId: published.id,
          revisionId: published.liveRevisionId!,
        };
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      await client.end();
    }
    mkdirSync(path.dirname(ARTIFACT), { recursive: true });
    writeFileSync(ARTIFACT, JSON.stringify(fixture), "utf8");
  });
});
