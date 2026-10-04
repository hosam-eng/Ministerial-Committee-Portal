import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  AccessDeniedError,
  bootstrapFirstAdministrator,
} from "@/modules/identity";
import {
  approveNews,
  createNewsDraft,
  getEditorialNews,
  publishNews,
  resolveNewsPreview,
  resolvePublishedNewsBySlug,
  saveNewsDraft,
  startEditingNews,
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

function uriFor(user: string, password: string): string {
  const url = new URL(container.getConnectionUri());
  url.username = user;
  url.password = password;
  return url.toString();
}

const db = () => runtimeDatabase;

function draft(slug: string, title: string): NewsDraftInput {
  return {
    displayDate: "2024-03-15",
    categoryIds: [],
    translations: {
      ar: {
        title: `عنوان ${title}`,
        slug: `${slug}-ar`,
        summary: "ملخص",
        body: { version: 1, type: "plainText", text: "نص" },
      },
      en: {
        title,
        slug: `${slug}-en`,
        summary: "Summary",
        body: { version: 1, type: "plainText", text: "Body" },
      },
    },
  };
}

async function pointer(newsId: string) {
  return db().prisma.news.findUniqueOrThrow({
    where: { id: newsId },
    select: {
      publicationStatus: true,
      liveRevisionId: true,
      activeRevisionId: true,
    },
  });
}

async function approveActive(newsId: string) {
  const editorial = await getEditorialNews(adminId, newsId, db());
  await db().prisma.newsRevision.update({
    where: { id: editorial!.activeRevision!.id },
    data: { submittedById: REVIEWER_ID },
  });
  await approveNews(adminId, newsId, db());
}

beforeAll(async () => {
  container = await new PostgreSqlContainer(IMAGE)
    .withDatabase("mcp_news_preview")
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
      { email: "news-preview@example.test", passwordHash: "hash" },
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

describe("news explicit-revision preview", () => {
  it("resolves a non-live revision in the requested locale only", async () => {
    const created = await createNewsDraft(adminId, db());
    await saveNewsDraft(
      adminId,
      created.newsId,
      created.editVersion,
      {
        displayDate: "2024-03-15",
        categoryIds: [],
        translations: {
          ar: {
            title: "مسودة عربية",
            slug: "preview-draft-ar",
            summary: "ملخص المسودة",
            body: { version: 1, type: "plainText", text: "متن المسودة" },
          },
        },
      },
      db(),
    );
    const before = await pointer(created.newsId);
    const preview = await resolveNewsPreview(
      adminId,
      created.revisionId,
      "ar",
      db(),
    );
    expect(preview?.revisionId).toBe(created.revisionId);
    expect(preview?.article.title).toBe("مسودة عربية");
    expect(preview?.incomplete).toBe(false);
    expect(
      await resolveNewsPreview(adminId, created.revisionId, "en", db()),
    ).toBeNull();
    expect(await pointer(created.newsId)).toEqual(before);
    expect(before.publicationStatus).toBe("NEVER_PUBLISHED");
    expect(before.liveRevisionId).toBeNull();
    expect(
      await resolvePublishedNewsBySlug("ar", "preview-draft-ar", db()),
    ).toBeNull();
  });

  it("previews a historical revision without changing the live page", async () => {
    const created = await createNewsDraft(adminId, db());
    const saved = await saveNewsDraft(
      adminId,
      created.newsId,
      created.editVersion,
      draft("preview-live", "Live title"),
      db(),
    );
    await submitNews(adminId, created.newsId, saved.editVersion, db());
    await approveActive(created.newsId);
    await publishNews(adminId, created.newsId, db());
    const editing = await startEditingNews(adminId, created.newsId, db());
    await saveNewsDraft(
      adminId,
      created.newsId,
      editing.editVersion,
      draft("preview-draft-next", "Draft title"),
      db(),
    );
    const before = await pointer(created.newsId);
    const historical = await resolveNewsPreview(
      adminId,
      created.revisionId,
      "en",
      db(),
    );
    const draftPreview = await resolveNewsPreview(
      adminId,
      editing.id,
      "en",
      db(),
    );
    expect(historical?.revisionId).toBe(created.revisionId);
    expect(historical?.article.title).toBe("Live title");
    expect(draftPreview?.revisionId).toBe(editing.id);
    expect(draftPreview?.article.title).toBe("Draft title");
    expect(await pointer(created.newsId)).toEqual(before);
    const live = await resolvePublishedNewsBySlug(
      "en",
      "preview-live-en",
      db(),
    );
    expect(live?.kind).toBe("news");
    if (live?.kind === "news") expect(live.news.title).toBe("Live title");
  });

  it("denies preview to an actor without News read permission", async () => {
    const created = await createNewsDraft(adminId, db());
    const before = await pointer(created.newsId);
    await expect(
      resolveNewsPreview(OUTSIDER_ID, created.revisionId, "ar", db()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    expect(await pointer(created.newsId)).toEqual(before);
  });
});
