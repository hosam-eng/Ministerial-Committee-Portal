import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapFirstAdministrator } from "@/modules/identity";
import {
  approveNews,
  createNewsDraft,
  getEditorialNews,
  listLatestPublishedNews,
  listPublishedNews,
  resolvePublishedNewsByIds,
  publishNews,
  restoreApprovedNews,
  returnNews,
  saveNewsDraft,
  startEditingNews,
  submitNews,
  unpublishNews,
  type NewsDraftInput,
} from "@/modules/publishing";
import { formatCalendarDateInput } from "@/modules/publishing/display-date";
import { resetServerConfigForTest } from "@/platform/config";
import { createDatabase, type Database } from "@/platform/database";
import { closeRuntimeDatabase } from "@/platform/runtime";

const IMAGE = "postgres:18.6";
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const PRISMA_CLI = path.join(REPO_ROOT, "node_modules/prisma/build/index.js");
const BOOTSTRAP_SQL = path.join(REPO_ROOT, "docker/postgres/sql/001-roles.sql");
const BOOTSTRAP_SH = path.join(
  REPO_ROOT,
  "docker/postgres/init/00-bootstrap.sh",
);
const execFileAsync = promisify(execFile);
const REVIEWER_ID = "00000000-0000-4000-8000-000000000099";

let container: StartedPostgreSqlContainer;
let runtimeDatabase: Database;
let adminId: string;
let previousDatabaseUrl: string | undefined;
let slugCounter = 0;

function uriFor(user: string, password: string): string {
  const url = new URL(container.getConnectionUri());
  url.username = user;
  url.password = password;
  return url.toString();
}

const db = () => runtimeDatabase;

function completeNewsDraft(displayDate: string): NewsDraftInput {
  slugCounter += 1;
  const slug = `news-${slugCounter}`;
  return {
    displayDate,
    categoryIds: [],
    translations: {
      ar: {
        title: `عنوان ${slug}`,
        slug: `${slug}-ar`,
        summary: "ملخص",
        body: { version: 1, type: "plainText", text: "نص" },
      },
      en: {
        title: `Title ${slug}`,
        slug: `${slug}-en`,
        summary: "Summary",
        body: { version: 1, type: "plainText", text: "Body" },
      },
    },
  };
}

async function approveActive(newsId: string) {
  const editorial = await getEditorialNews(adminId, newsId, db());
  await db().prisma.newsRevision.update({
    where: { id: editorial!.activeRevision!.id },
    data: { submittedById: REVIEWER_ID },
  });
  await approveNews(adminId, newsId, db());
}

async function publishWithDisplayDate(displayDate: string) {
  const { newsId, editVersion } = await createNewsDraft(adminId, db());
  const saved = await saveNewsDraft(
    adminId,
    newsId,
    editVersion,
    completeNewsDraft(displayDate),
    db(),
  );
  await submitNews(adminId, newsId, saved.editVersion, db());
  await approveActive(newsId);
  await publishNews(adminId, newsId, db());
  return newsId;
}

beforeAll(async () => {
  container = await new PostgreSqlContainer(IMAGE)
    .withDatabase("mcp_news_display_date")
    .withUsername("postgres")
    .withPassword("postgres_test_only")
    .withCopyFilesToContainer([
      { source: BOOTSTRAP_SQL, target: "/mcp-sql/001-roles.sql" },
      {
        source: BOOTSTRAP_SH,
        target: "/docker-entrypoint-initdb.d/00-bootstrap.sh",
      },
    ])
    .start();
  await execFileAsync(process.execPath, [PRISMA_CLI, "migrate", "deploy"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DATABASE_MIGRATION_URL: uriFor("mcp_migrate", "mcp_migrate_dev"),
    },
    timeout: 150_000,
  });
  runtimeDatabase = createDatabase({
    connectionString: uriFor("mcp_runtime", "mcp_runtime_dev"),
  });
  previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = uriFor("mcp_runtime", "mcp_runtime_dev");
  resetServerConfigForTest();
  await closeRuntimeDatabase();
  adminId = (
    await bootstrapFirstAdministrator(
      { email: "news-display-date@example.test", passwordHash: "hash" },
      db(),
    )
  ).userId;
}, 180_000);

afterAll(async () => {
  await runtimeDatabase?.close();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  resetServerConfigForTest();
  await closeRuntimeDatabase();
  await container?.stop();
});

describe("news displayDate migration", () => {
  it("backfills every revision with a calendar date", async () => {
    await createNewsDraft(adminId, db());
    const rows = await db().prisma.newsRevision.findMany({
      select: { displayDate: true },
    });
    expect(rows.every((row) => row.displayDate instanceof Date)).toBe(true);
  });
});

describe("news displayDate workflow", () => {
  it("allows draft save without displayDate and blocks submit", async () => {
    const { newsId, editVersion } = await createNewsDraft(adminId, db());
    await saveNewsDraft(
      adminId,
      newsId,
      editVersion,
      { translations: {}, categoryIds: [], displayDate: null },
      db(),
    );
    const cleared = await saveNewsDraft(
      adminId,
      newsId,
      editVersion + 1,
      { translations: {}, categoryIds: [], displayDate: "" },
      db(),
    );
    await expect(
      submitNews(adminId, newsId, cleared.editVersion, db()),
    ).rejects.toMatchObject({ code: "DISPLAY_DATE_REQUIRED" });
  });

  it("preserves displayDate through return, restore, and edit-published flows", async () => {
    const { newsId, editVersion } = await createNewsDraft(adminId, db());
    const saved = await saveNewsDraft(
      adminId,
      newsId,
      editVersion,
      completeNewsDraft("2025-05-01"),
      db(),
    );
    await submitNews(adminId, newsId, saved.editVersion, db());
    const returned = await returnNews(adminId, newsId, "adjust", db());
    expect(formatCalendarDateInput(returned.displayDate!)).toBe("2025-05-01");

    const resubmit = await saveNewsDraft(
      adminId,
      newsId,
      returned.editVersion,
      completeNewsDraft("2025-05-01"),
      db(),
    );
    await submitNews(adminId, newsId, resubmit.editVersion, db());
    await approveActive(newsId);

    const restored = await restoreApprovedNews(adminId, newsId, db());
    expect(formatCalendarDateInput(restored.displayDate!)).toBe("2025-05-01");

    const republishDraft = await saveNewsDraft(
      adminId,
      newsId,
      restored.editVersion,
      completeNewsDraft("2025-05-01"),
      db(),
    );
    await submitNews(adminId, newsId, republishDraft.editVersion, db());
    await approveActive(newsId);
    await publishNews(adminId, newsId, db());

    const editing = await startEditingNews(adminId, newsId, db());
    expect(formatCalendarDateInput(editing.displayDate!)).toBe("2025-05-01");
  });

  it("does not change the live public date until replacement publish", async () => {
    const newsId = await publishWithDisplayDate("2024-01-10");
    const editing = await startEditingNews(adminId, newsId, db());
    const saved = await saveNewsDraft(
      adminId,
      newsId,
      editing.editVersion,
      completeNewsDraft("2026-09-01"),
      db(),
    );
    const live = await resolvePublishedNewsByIds("en", [newsId], db());
    expect(formatCalendarDateInput(live[0]!.displayDate)).toBe("2024-01-10");

    await submitNews(adminId, newsId, saved.editVersion, db());
    await approveActive(newsId);
    await publishNews(adminId, newsId, db());
    const updated = await resolvePublishedNewsByIds("en", [newsId], db());
    expect(formatCalendarDateInput(updated[0]!.displayDate)).toBe("2026-09-01");
  });

  it("breaks equal displayDate ties by publishedAt then id", async () => {
    const first = await publishWithDisplayDate("2025-01-01");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await publishWithDisplayDate("2025-01-01");
    const listed = await listPublishedNews("en", db());
    const sameDate = listed.filter(
      (item) => formatCalendarDateInput(item.displayDate) === "2025-01-01",
    );
    expect(sameDate.length).toBeGreaterThanOrEqual(2);
    const firstIndex = listed.findIndex((item) => item.newsId === first);
    const secondIndex = listed.findIndex((item) => item.newsId === second);
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeLessThan(firstIndex);
  });

  it("orders public and homepage automatic lists by displayDate", async () => {
    const idA = await publishWithDisplayDate("2024-01-10");
    const idB = await publishWithDisplayDate("2026-05-05");
    const idC = await publishWithDisplayDate("2025-08-20");

    const listed = await listPublishedNews("en", db());
    const order = listed.map((item) => item.newsId);
    expect(order.indexOf(idB)).toBeLessThan(order.indexOf(idC));
    expect(order.indexOf(idC)).toBeLessThan(order.indexOf(idA));

    const latest = await listLatestPublishedNews("en", 10, db());
    const latestOrder = latest.map((item) => item.newsId);
    expect(latestOrder.indexOf(idB)).toBeLessThan(latestOrder.indexOf(idC));
    expect(latestOrder.indexOf(idC)).toBeLessThan(latestOrder.indexOf(idA));

    const ar = await resolvePublishedNewsByIds("ar", [idB], db());
    const en = await resolvePublishedNewsByIds("en", [idB], db());
    expect(formatCalendarDateInput(ar[0]!.displayDate)).toBe(
      formatCalendarDateInput(en[0]!.displayDate),
    );
  });

  it("leaves unpublish behavior unchanged", async () => {
    const newsId = await publishWithDisplayDate("2024-06-01");
    await unpublishNews(adminId, newsId, "validation", db());
    expect(await resolvePublishedNewsByIds("en", [newsId], db())).toHaveLength(
      0,
    );
    const row = await db().prisma.news.findUniqueOrThrow({
      where: { id: newsId },
      select: {
        publicationStatus: true,
        unpublishedAt: true,
        publishedAt: true,
      },
    });
    expect(row.publicationStatus).toBe("UNPUBLISHED");
    expect(row.unpublishedAt).toBeInstanceOf(Date);
    expect(row.publishedAt).toBeInstanceOf(Date);
  });
});
