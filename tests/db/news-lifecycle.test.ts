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
  createNewsDraft,
  getEditorialNews,
  listPublishedNews,
  publishNews,
  republishNews,
  resolveNewsPreview,
  restoreApprovedNews,
  restoreNewsRevision,
  returnNews,
  saveNewsDraft,
  startEditingNews,
  submitNews,
  unpublishNews,
  abandonNewsDraft,
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
const OUTSIDER_ID = "00000000-0000-4000-8000-000000000077";

let container: StartedPostgreSqlContainer;
let runtimeDatabase: Database;
let adminId: string;
let previousDatabaseUrl: string | undefined;
let slugCounter = 0;
let categoryId: string;

function uriFor(user: string, password: string): string {
  const url = new URL(container.getConnectionUri());
  url.username = user;
  url.password = password;
  return url.toString();
}

const db = () => runtimeDatabase;

function draft(slug: string, title: string, displayDate = "2024-06-01"): NewsDraftInput {
  slugCounter += 1;
  const unique = `${slug}-${slugCounter}`;
  return {
    displayDate,
    categoryIds: categoryId ? [categoryId] : [],
    translations: {
      ar: {
        title: `عنوان ${title}`,
        slug: `${unique}-ar`,
        summary: "ملخص",
        body: { version: 1, type: "plainText", text: "نص" },
        seoTitle: "SEO AR",
        seoDescription: "Desc AR",
      },
      en: {
        title: `Title ${title}`,
        slug: `${unique}-en`,
        summary: "Summary",
        body: { version: 1, type: "plainText", text: "Body" },
        seoTitle: "SEO EN",
        seoDescription: "Desc EN",
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

async function seedPublished(label: string) {
  const { newsId, editVersion } = await createNewsDraft(adminId, db());
  const saved = await saveNewsDraft(
    adminId,
    newsId,
    editVersion,
    draft(label, label),
    db(),
  );
  await submitNews(adminId, newsId, saved.editVersion, db());
  await approveActive(newsId);
  await publishNews(adminId, newsId, db());
  return newsId;
}

async function pointer(newsId: string) {
  return db().prisma.news.findUniqueOrThrow({
    where: { id: newsId },
    select: {
      publicationStatus: true,
      liveRevisionId: true,
      activeRevisionId: true,
      publishedAt: true,
      unpublishedAt: true,
    },
  });
}

beforeAll(async () => {
  container = await new PostgreSqlContainer(IMAGE)
    .withDatabase("mcp_news_lifecycle")
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
      { email: "news-lifecycle@example.test", passwordHash: "hash" },
      db(),
    )
  ).userId;
  const category = await db().prisma.newsCategory.create({
    data: { nameAr: "تصنيف", nameEn: "Category" },
  });
  categoryId = category.id;
}, 240_000);

afterAll(async () => {
  await runtimeDatabase?.close();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  resetServerConfigForTest();
  await container?.stop();
});

describe("news historical restore", () => {
  it("creates a new EDITING revision from an older APPROVED revision", async () => {
    const newsId = await seedPublished("restore-approved");
    const firstLive = (await pointer(newsId)).liveRevisionId!;
    await startEditingNews(adminId, newsId, db());
    const editorial = await getEditorialNews(adminId, newsId, db());
    const saved = await saveNewsDraft(
      adminId,
      newsId,
      editorial!.activeRevision!.editVersion,
      draft("restore-approved-v2", "V2"),
      db(),
    );
    await submitNews(adminId, newsId, saved.editVersion, db());
    await approveActive(newsId);
    await publishNews(adminId, newsId, db());
    const before = await pointer(newsId);
    const historical = await db().prisma.newsRevision.findFirstOrThrow({
      where: { newsId, id: firstLive, workflowStatus: "APPROVED" },
    });
    const restored = await restoreNewsRevision(
      adminId,
      newsId,
      historical.id,
      db(),
    );
    expect(restored.workflowStatus).toBe("EDITING");
    expect(restored.basedOnRevisionId).toBe(historical.id);
    const after = await pointer(newsId);
    expect(after.liveRevisionId).toBe(before.liveRevisionId);
    expect(after.publicationStatus).toBe("PUBLISHED");
  });

  it("restores a RETURNED revision", async () => {
    const { newsId, editVersion } = await createNewsDraft(adminId, db());
    await saveNewsDraft(adminId, newsId, editVersion, draft("returned", "Returned"), db());
    await submitNews(adminId, newsId, 1, db());
    const returned = await returnNews(adminId, newsId, "fix copy", db());
    const returnedRevision = await db().prisma.newsRevision.findFirstOrThrow({
      where: { newsId, workflowStatus: "RETURNED" },
    });
    expect(returned.workflowStatus).toBe("EDITING");
    await abandonNewsDraft(adminId, newsId, db());
    await restoreNewsRevision(adminId, newsId, returnedRevision.id, db());
    const editorial = await getEditorialNews(adminId, newsId, db());
    expect(editorial?.activeRevision?.workflowStatus).toBe("EDITING");
    expect(editorial?.activeRevision?.basedOnRevisionId).toBe(returnedRevision.id);
  });

  it.each(["EDITING", "PENDING_REVIEW", "ABANDONED", "READY"] as const)(
    "rejects restore from %s source",
    async (status) => {
    const { newsId, editVersion } = await createNewsDraft(adminId, db());
    await saveNewsDraft(adminId, newsId, editVersion, draft("bad-src", status), db());
    const source = await db().prisma.newsRevision.findFirstOrThrow({
      where: { newsId },
    });
    await db().prisma.newsRevision.update({
      where: { id: source.id },
      data: { workflowStatus: status },
    });
    await db().prisma.news.update({
      where: { id: newsId },
      data: { activeRevisionId: null },
    });
    await expect(
      restoreNewsRevision(adminId, newsId, source.id, db()),
    ).rejects.toMatchObject({ code: "SOURCE_NOT_RESTORABLE" });
  });

  it("rejects restore while another EDITING revision is active", async () => {
    const { newsId, editVersion } = await createNewsDraft(adminId, db());
    await saveNewsDraft(adminId, newsId, editVersion, draft("open-edit", "Open"), db());
    const approved = await db().prisma.newsRevision.create({
      data: {
        newsId,
        revisionNumber: 2,
        workflowStatus: "APPROVED",
        createdById: adminId,
      },
    });
    await expect(
      restoreNewsRevision(adminId, newsId, approved.id, db()),
    ).rejects.toMatchObject({ code: "ACTIVE_EDITING_EXISTS" });
  });

  it("rejects restore while PENDING_REVIEW is active", async () => {
    const { newsId, editVersion } = await createNewsDraft(adminId, db());
    await saveNewsDraft(adminId, newsId, editVersion, draft("pending", "Pending"), db());
    await submitNews(adminId, newsId, 1, db());
    const approved = await db().prisma.newsRevision.create({
      data: {
        newsId,
        revisionNumber: 2,
        workflowStatus: "APPROVED",
        createdById: adminId,
      },
    });
    await expect(
      restoreNewsRevision(adminId, newsId, approved.id, db()),
    ).rejects.toMatchObject({ code: "ACTIVE_REVISION_EXISTS" });
  });

  it("keeps source immutable and copies editorial fields", async () => {
    const newsId = await seedPublished("copy-fields");
    const source = await db().prisma.newsRevision.findFirstOrThrow({
      where: { newsId, workflowStatus: "APPROVED" },
      include: { translations: true, categories: true },
    });
    await db().prisma.news.update({
      where: { id: newsId },
      data: { activeRevisionId: null },
    });
    const beforeSource = JSON.stringify({
      displayDate: source.displayDate,
      translations: source.translations,
      categories: source.categories,
    });
    const restored = await restoreNewsRevision(adminId, newsId, source.id, db());
    const sourceAfter = await db().prisma.newsRevision.findFirstOrThrow({
      where: { id: source.id },
      include: { translations: true, categories: true },
    });
    expect(JSON.stringify({
      displayDate: sourceAfter.displayDate,
      translations: sourceAfter.translations,
      categories: sourceAfter.categories,
    })).toBe(beforeSource);
    expect(restored.basedOnRevisionId).toBe(source.id);
    expect(formatCalendarDateInput(restored.displayDate!)).toBe(
      formatCalendarDateInput(source.displayDate!),
    );
    const restoredFull = await db().prisma.newsRevision.findFirstOrThrow({
      where: { id: restored.id },
      include: { translations: true, categories: true },
    });
    expect(restoredFull.categories.map((c) => c.categoryId)).toEqual(
      source.categories.map((c) => c.categoryId),
    );
    expect(restoredFull.translations).toHaveLength(2);
    const event = await db().prisma.newsWorkflowEvent.findFirst({
      where: { newsId, action: "RESTORE", revisionId: restored.id },
    });
    expect(event).toBeTruthy();
  });

  it("routes active-approved restore through restoreNewsRevision", async () => {
    const { newsId, editVersion } = await createNewsDraft(adminId, db());
    await saveNewsDraft(adminId, newsId, editVersion, draft("active-restore", "Active"), db());
    await submitNews(adminId, newsId, 1, db());
    await approveActive(newsId);
    const liveBefore = (await pointer(newsId)).liveRevisionId;
    const restored = await restoreApprovedNews(adminId, newsId, db());
    expect(restored.workflowStatus).toBe("EDITING");
    expect((await pointer(newsId)).liveRevisionId).toBe(liveBefore);
  });

  it("denies restore without NEWS_EDIT", async () => {
    const newsId = await seedPublished("auth-restore");
    const source = await db().prisma.newsRevision.findFirstOrThrow({
      where: { newsId, workflowStatus: "APPROVED" },
    });
    await db().prisma.news.update({
      where: { id: newsId },
      data: { activeRevisionId: null },
    });
    await expect(
      restoreNewsRevision(OUTSIDER_ID, newsId, source.id, db()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
});

describe("news unchanged republish", () => {
  it("republish after unpublish without creating a revision", async () => {
    const newsId = await seedPublished("republish-basic");
    const revisionCountBefore = await db().prisma.newsRevision.count({
      where: { newsId },
    });
    const liveId = (await pointer(newsId)).liveRevisionId!;
    const displayDate = (
      await db().prisma.newsRevision.findUniqueOrThrow({ where: { id: liveId } })
    ).displayDate;
    await unpublishNews(adminId, newsId, "review republish", db());
    const mid = await pointer(newsId);
    expect(mid.publicationStatus).toBe("UNPUBLISHED");
    expect(mid.activeRevisionId).toBeNull();
    expect(mid.liveRevisionId).toBeNull();
    const result = await republishNews(adminId, newsId, db());
    expect(result.revisionId).toBe(liveId);
    const after = await pointer(newsId);
    expect(after.publicationStatus).toBe("PUBLISHED");
    expect(after.liveRevisionId).toBe(liveId);
    expect(after.activeRevisionId).toBeNull();
    expect(after.unpublishedAt).toBeNull();
    expect(after.publishedAt).not.toBeNull();
    const revisionCountAfter = await db().prisma.newsRevision.count({
      where: { newsId },
    });
    expect(revisionCountAfter).toBe(revisionCountBefore);
    const liveAfter = await db().prisma.newsRevision.findUniqueOrThrow({
      where: { id: liveId },
    });
    expect(liveAfter.displayDate?.getTime()).toBe(displayDate?.getTime());
    const event = await db().prisma.newsPublicationEvent.findFirst({
      where: { newsId, action: "REPUBLISH" },
      orderBy: { createdAt: "desc" },
    });
    expect(event?.revisionId).toBe(liveId);
    expect((await listPublishedNews("en", db())).some((n) => n.newsId === newsId)).toBe(
      true,
    );
  });

  it("selects the latest PUBLISH event revision", async () => {
    const newsId = await seedPublished("multi-publish");
    const firstLive = (await pointer(newsId)).liveRevisionId!;
    await startEditingNews(adminId, newsId, db());
    const editorial = await getEditorialNews(adminId, newsId, db());
    const saved = await saveNewsDraft(
      adminId,
      newsId,
      editorial!.activeRevision!.editVersion,
      draft("multi-publish-v2", "V2"),
      db(),
    );
    await submitNews(adminId, newsId, saved.editVersion, db());
    await approveActive(newsId);
    await publishNews(adminId, newsId, db());
    const secondLive = (await pointer(newsId)).liveRevisionId!;
    expect(secondLive).not.toBe(firstLive);
    await unpublishNews(adminId, newsId, "cycle", db());
    const result = await republishNews(adminId, newsId, db());
    expect(result.revisionId).toBe(secondLive);
  });

  it.each([
    ["NEVER_PUBLISHED", async (id: string) => id],
    ["PUBLISHED", async (id: string) => {
      await unpublishNews(adminId, id, "temp", db());
      await republishNews(adminId, id, db());
      return id;
    }],
  ])("rejects republish when status is %s", async (label, setup) => {
    let newsId: string;
    if (label === "NEVER_PUBLISHED") {
      ({ newsId } = await createNewsDraft(adminId, db()));
    } else {
      newsId = await seedPublished(`reject-${label}`);
      newsId = await setup(newsId);
    }
    await expect(republishNews(adminId, newsId, db())).rejects.toMatchObject({
      code: label === "NEVER_PUBLISHED" ? "NEVER_PUBLISHED" : "REPUBLISH_NOT_ELIGIBLE",
    });
  });

  it("rejects republish when a newer APPROVED editorial revision exists", async () => {
    const newsId = await seedPublished("republish-active-approved");
    await unpublishNews(adminId, newsId, "offline", db());
    await startApprovedEditorialFromLive(newsId);
    await expect(republishNews(adminId, newsId, db())).rejects.toMatchObject({
      code: "REPUBLISH_NOT_ELIGIBLE",
    });
  });

  it("rejects republish on slug collision", async () => {
    const first = await seedPublished("slug-a");
    const firstLive = await db().prisma.news.findUniqueOrThrow({
      where: { id: first },
      include: { liveRevision: { include: { translations: true } } },
    });
    const enSlug = firstLive.liveRevision!.translations.find(
      (t) => t.locale === "en",
    )!.slug;
    await unpublishNews(adminId, first, "collision setup", db());
    const { newsId: second, editVersion } = await createNewsDraft(adminId, db());
    await saveNewsDraft(
      adminId,
      second,
      editVersion,
      {
        ...draft("slug-b", "B"),
        translations: {
          ...draft("slug-b", "B").translations,
          en: {
            ...draft("slug-b", "B").translations.en!,
            slug: enSlug,
          },
        },
      },
      db(),
    );
    await submitNews(adminId, second, 1, db());
    await approveActive(second);
    await publishNews(adminId, second, db());
    await expect(republishNews(adminId, first, db())).rejects.toMatchObject({
      code: "SLUG_ALREADY_IN_USE",
    });
  });

  it("denies republish without NEWS_PUBLISH", async () => {
    const newsId = await seedPublished("auth-republish");
    await unpublishNews(adminId, newsId, "auth", db());
    await expect(republishNews(OUTSIDER_ID, newsId, db())).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });
});

describe("news lifecycle regression", () => {
  it("still resolves preview after lifecycle changes", async () => {
    const newsId = await seedPublished("preview-regression");
    const liveId = (await pointer(newsId)).liveRevisionId!;
    const preview = await resolveNewsPreview(adminId, liveId, "en", db());
    expect(preview?.article.title).toContain("Title");
  });

  it("still publishes a normal replacement revision", async () => {
    const newsId = await seedPublished("normal-publish");
    const liveBefore = (await pointer(newsId)).liveRevisionId;
    await startEditingNews(adminId, newsId, db());
    const editorial = await getEditorialNews(adminId, newsId, db());
    const saved = await saveNewsDraft(
      adminId,
      newsId,
      editorial!.activeRevision!.editVersion,
      draft("normal-publish-v2", "Replacement"),
      db(),
    );
    await submitNews(adminId, newsId, saved.editVersion, db());
    await approveActive(newsId);
    await publishNews(adminId, newsId, db());
    const liveAfter = (await pointer(newsId)).liveRevisionId;
    expect(liveAfter).not.toBe(liveBefore);
    expect((await pointer(newsId)).publicationStatus).toBe("PUBLISHED");
  });
});

async function startApprovedEditorialFromLive(newsId: string) {
  const lastPublish = await db().prisma.newsPublicationEvent.findFirstOrThrow({
    where: { newsId, action: "PUBLISH" },
    orderBy: { createdAt: "desc" },
  });
  const source = await db().prisma.newsRevision.findUniqueOrThrow({
    where: { id: lastPublish.revisionId },
    include: { translations: true, categories: true },
  });
  const last = await db().prisma.newsRevision.findFirst({
    where: { newsId },
    orderBy: { revisionNumber: "desc" },
  });
  const revision = await db().prisma.newsRevision.create({
    data: {
      newsId,
      revisionNumber: (last?.revisionNumber ?? 0) + 1,
      workflowStatus: "APPROVED",
      basedOnRevisionId: source.id,
      createdById: adminId,
      displayDate: source.displayDate,
      translations: {
        create: source.translations.map((t) => ({
          locale: t.locale,
          title: t.title,
          slug: t.slug,
          summary: t.summary,
          body: t.body ?? undefined,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
        })),
      },
      categories: {
        create: source.categories.map((c) => ({ categoryId: c.categoryId })),
      },
    },
  });
  await db().prisma.news.update({
    where: { id: newsId },
    data: { activeRevisionId: revision.id },
  });
}
