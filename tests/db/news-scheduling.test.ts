import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AccessDeniedError, bootstrapFirstAdministrator } from "@/modules/identity";
import {
  approveNews,
  cancelScheduledNewsPublication,
  createNewsDraft,
  executeDueNewsPublication,
  getEditorialNews,
  listPublishedNews,
  publishNews,
  rescheduleNewsPublication,
  saveNewsDraft,
  scheduleNewsPublication,
  submitNews,
  type NewsDraftInput,
} from "@/modules/publishing";
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
const OUTSIDER_ID = "00000000-0000-4000-8000-000000000077";

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

function draft(slug: string): NewsDraftInput {
  slugCounter += 1;
  const unique = `${slug}-${slugCounter}`;
  return {
    displayDate: "2024-06-01",
    categoryIds: [],
    translations: {
      ar: {
        title: `عنوان ${unique}`,
        slug: `${unique}-ar`,
        summary: "ملخص",
        body: { version: 1, type: "plainText", text: "نص" },
      },
      en: {
        title: `Title ${unique}`,
        slug: `${unique}-en`,
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

async function approvedNews(label: string) {
  const { newsId, editVersion } = await createNewsDraft(adminId, db());
  const saved = await saveNewsDraft(
    adminId,
    newsId,
    editVersion,
    draft(label),
    db(),
  );
  await submitNews(adminId, newsId, saved.editVersion, db());
  await approveActive(newsId);
  const editorial = await getEditorialNews(adminId, newsId, db());
  return { newsId, revisionId: editorial!.activeRevision!.id };
}

async function makeDue(instructionId: string) {
  await db().prisma.newsPublicationInstruction.update({
    where: { id: instructionId },
    data: { publishAt: new Date(Date.now() - 60_000) },
  });
}

beforeAll(async () => {
  container = await new PostgreSqlContainer(IMAGE)
    .withDatabase("mcp_news_scheduling")
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
      { email: "news-scheduling@example.test", passwordHash: "hash" },
      db(),
    )
  ).userId;
}, 240_000);

afterAll(async () => {
  await runtimeDatabase?.close();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  resetServerConfigForTest();
  await container?.stop();
});

describe("News publication scheduling contract", () => {
  it("creates a valid future schedule", async () => {
    const { newsId, revisionId } = await approvedNews("sched-create");
    const publishAt = new Date(Date.now() + 86_400_000);
    const instruction = await scheduleNewsPublication(
      adminId,
      newsId,
      revisionId,
      publishAt,
      db(),
    );
    expect(instruction.status).toBe("SCHEDULED");
    const editorial = await getEditorialNews(adminId, newsId, db());
    expect(editorial!.liveRevisionId).toBeNull();
  });

  it("rejects duplicate SCHEDULED instruction", async () => {
    const { newsId, revisionId } = await approvedNews("sched-dup");
    const publishAt = new Date(Date.now() + 86_400_000);
    await scheduleNewsPublication(adminId, newsId, revisionId, publishAt, db());
    await expect(
      scheduleNewsPublication(
        adminId,
        newsId,
        revisionId,
        new Date(Date.now() + 172_800_000),
        db(),
      ),
    ).rejects.toMatchObject({ code: "SCHEDULE_ALREADY_EXISTS" });
  });

  it("reschedules via cancel + create", async () => {
    const { newsId, revisionId } = await approvedNews("sched-resched");
    const first = await scheduleNewsPublication(
      adminId,
      newsId,
      revisionId,
      new Date(Date.now() + 86_400_000),
      db(),
    );
    const second = await rescheduleNewsPublication(
      adminId,
      first.id,
      new Date(Date.now() + 172_800_000),
      db(),
    );
    expect(second.status).toBe("SCHEDULED");
    expect(second.version).toBe(first.version + 1);
    const cancelled = await db().prisma.newsPublicationInstruction.findUnique({
      where: { id: first.id },
    });
    expect(cancelled!.status).toBe("CANCELLED");
  });

  it("cancels SCHEDULED instruction", async () => {
    const { newsId, revisionId } = await approvedNews("sched-cancel");
    const instruction = await scheduleNewsPublication(
      adminId,
      newsId,
      revisionId,
      new Date(Date.now() + 86_400_000),
      db(),
    );
    const cancelled = await cancelScheduledNewsPublication(
      adminId,
      instruction.id,
      db(),
    );
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("does not publish before due", async () => {
    const { newsId, revisionId } = await approvedNews("sched-early");
    const instruction = await scheduleNewsPublication(
      adminId,
      newsId,
      revisionId,
      new Date(Date.now() + 86_400_000),
      db(),
    );
    expect(await executeDueNewsPublication(instruction.id, db())).toBe("not_due");
    expect(await listPublishedNews("en", db())).toHaveLength(0);
  });

  it("publishes eligible revision when due", async () => {
    const { newsId, revisionId } = await approvedNews("sched-due");
    const instruction = await scheduleNewsPublication(
      adminId,
      newsId,
      revisionId,
      new Date(Date.now() + 86_400_000),
      db(),
    );
    await makeDue(instruction.id);
    expect(await executeDueNewsPublication(instruction.id, db())).toBe(
      "published",
    );
    const listed = await listPublishedNews("en", db());
    expect(listed.some((row) => row.newsId === newsId)).toBe(true);
    const events = await db().prisma.newsPublicationEvent.findMany({
      where: { newsId, action: "PUBLISH" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.actorId).toBeNull();
  });

  it("is idempotent on repeated due execution", async () => {
    const { newsId, revisionId } = await approvedNews("sched-idem");
    const instruction = await scheduleNewsPublication(
      adminId,
      newsId,
      revisionId,
      new Date(Date.now() + 86_400_000),
      db(),
    );
    await makeDue(instruction.id);
    await executeDueNewsPublication(instruction.id, db());
    expect(await executeDueNewsPublication(instruction.id, db())).toBe(
      "terminal",
    );
    const events = await db().prisma.newsPublicationEvent.count({
      where: { newsId, action: "PUBLISH" },
    });
    expect(events).toBe(1);
  });

  it("manual publish before due marks EXECUTED without duplicate event", async () => {
    const { newsId, revisionId } = await approvedNews("sched-manual");
    const instruction = await scheduleNewsPublication(
      adminId,
      newsId,
      revisionId,
      new Date(Date.now() + 86_400_000),
      db(),
    );
    await publishNews(adminId, newsId, db());
    const row = await db().prisma.newsPublicationInstruction.findUnique({
      where: { id: instruction.id },
    });
    expect(row!.status).toBe("EXECUTED");
    const events = await db().prisma.newsPublicationEvent.count({
      where: { newsId, action: "PUBLISH" },
    });
    expect(events).toBe(1);
  });

  it("marks INELIGIBLE when editorial cycle blocks execution", async () => {
    const { newsId, revisionId } = await approvedNews("sched-inelig");
    const instruction = await scheduleNewsPublication(
      adminId,
      newsId,
      revisionId,
      new Date(Date.now() + 86_400_000),
      db(),
    );
    const editorial = await getEditorialNews(adminId, newsId, db());
    await db().prisma.newsRevision.update({
      where: { id: editorial!.activeRevision!.id },
      data: { workflowStatus: "EDITING" },
    });
    await makeDue(instruction.id);
    expect(await executeDueNewsPublication(instruction.id, db())).toBe(
      "terminal",
    );
    const row = await db().prisma.newsPublicationInstruction.findUnique({
      where: { id: instruction.id },
    });
    expect(row!.status).toBe("INELIGIBLE");
    expect(row!.ineligibleReason).toBe("ACTIVE_EDITORIAL_CYCLE");
  });

  it("requires NEWS_PUBLISH for user schedule operations", async () => {
    const { newsId, revisionId } = await approvedNews("sched-perm");
    await expect(
      scheduleNewsPublication(
        OUTSIDER_ID,
        newsId,
        revisionId,
        new Date(Date.now() + 86_400_000),
        db(),
      ),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
});
