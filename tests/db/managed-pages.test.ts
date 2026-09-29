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
  PERMISSIONS,
  assignRole,
  bootstrapFirstAdministrator,
  createCustomRole,
} from "@/modules/identity";
import {
  createAuth,
  type Auth,
} from "@/modules/identity/infrastructure/auth/auth";
import { ManagedPageError } from "@/modules/managed-pages";
import { createUuidV7 } from "@/modules/managed-pages/domain/ids";
import { richTextFromText } from "@/modules/managed-pages/domain/rich-text-document";
import type { ManagedPageContent } from "@/modules/managed-pages";
import {
  approveManagedPage,
  createManagedPage,
  getEditorialManagedPage,
  publishManagedPage,
  resolveManagedPagePreview,
  resolvePublishedManagedPageBySlug,
  restoreManagedPageRevision,
  returnManagedPage,
  saveManagedPageDraft,
  seedSystemManagedPages,
  startEditingManagedPage,
  submitManagedPage,
  unpublishManagedPage,
} from "@/modules/managed-pages";
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

let container: StartedPostgreSqlContainer;
let runtimeDatabase: Database;
let auth: Auth;
let adminId: string;
let counter = 0;
let previousDatabaseUrl: string | undefined;

function uriFor(user: string, password: string): string {
  const url = new URL(container.getConnectionUri());
  url.username = user;
  url.password = password;
  return url.toString();
}

const db = () => runtimeDatabase;

async function makeUser(): Promise<string> {
  counter += 1;
  const email = `managed-pages-${counter}@example.test`;
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email, name: email, emailVerified: true },
    { method: "email-password" },
  );
  return user.id;
}

async function permissionId(key: string): Promise<string> {
  const row = await runtimeDatabase.prisma.permission.findUniqueOrThrow({
    where: { key },
    select: { id: true },
  });
  return row.id;
}

async function grant(userId: string, keys: string[]) {
  counter += 1;
  const role = await createCustomRole(
    adminId,
    {
      name: `Managed Pages ${counter}`,
      description: null,
      permissionIds: await Promise.all(keys.map(permissionId)),
    },
    db(),
  );
  await assignRole(adminId, userId, role.id, db());
}

function textDocument(text: string, targetId?: string) {
  if (!targetId) return richTextFromText(text);
  return {
    schemaVersion: 1,
    engine: "tiptap",
    engineVersion: "3.31.3",
    document: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text,
              marks: [
                {
                  type: "link",
                  attrs: {
                    linkKind: "internal",
                    href: null,
                    targetRef: targetId,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

function completeDraft(
  slugAr: string,
  slugEn: string,
  titleAr = "صفحة اللجنة",
  titleEn = "Committee page",
  targetId?: string,
) {
  const itemId = createUuidV7();
  const linkItem = targetId
    ? { id: itemId, kind: "internal" as const, targetRef: targetId, href: null }
    : {
        id: itemId,
        kind: "external" as const,
        targetRef: null,
        href: "https://example.com/committee",
      };
  return {
    translations: {
      ar: {
        title: titleAr,
        slug: slugAr,
        intro: "مقدمة",
        seoTitle: null,
        seoDescription: null,
      },
      en: {
        title: titleEn,
        slug: slugEn,
        intro: "Introduction",
        seoTitle: null,
        seoDescription: null,
      },
    },
    blocks: [
      {
        id: createUuidV7(),
        type: "RICHTEXT",
        calloutVariant: null,
        linkItems: [],
        content: {
          ar: { document: textDocument(titleAr, targetId) },
          en: { document: textDocument(titleEn, targetId) },
        },
      },
      {
        id: createUuidV7(),
        type: "CALLOUT",
        calloutVariant: "institutional",
        linkItems: [],
        content: {
          ar: { title: "تنبيه", body: "نص التنبيه" },
          en: { title: "Note", body: "Institutional note" },
        },
      },
      {
        id: createUuidV7(),
        type: "LINK_LIST",
        calloutVariant: null,
        linkItems: [linkItem],
        content: {
          ar: { heading: "روابط", labels: { [itemId]: "الوجهة" } },
          en: { heading: "Links", labels: { [itemId]: "Destination" } },
        },
      },
    ],
  };
}

async function publishNew(
  slugAr: string,
  slugEn: string,
  titleAr?: string,
  titleEn?: string,
  targetId?: string,
) {
  const created = await createManagedPage(adminId, db());
  const saved = await saveManagedPageDraft(
    adminId,
    created.pageId,
    created.editVersion,
    completeDraft(slugAr, slugEn, titleAr, titleEn, targetId),
    db(),
  );
  await submitManagedPage(adminId, created.pageId, saved.editVersion, db());
  await approveManagedPage(adminId, created.pageId, db());
  await publishManagedPage(adminId, created.pageId, db());
  return created.pageId;
}

function asPage(
  value: Awaited<ReturnType<typeof resolvePublishedManagedPageBySlug>>,
) {
  expect(value?.kind).toBe("page");
  if (value?.kind !== "page") throw new Error("expected a public page");
  return value.page;
}

function hrefs(content: ManagedPageContent) {
  return content.blocks.flatMap((block) => {
    if (block.type === "LINK_LIST") return block.items.map((item) => item.href);
    if (block.type === "RICHTEXT") return Object.values(block.internalHrefs);
    return [];
  });
}

beforeAll(async () => {
  container = await new PostgreSqlContainer(IMAGE)
    .withDatabase("mcp_test")
    .withUsername("postgres")
    .withPassword("postgres_test_only")
    .withEnvironment({ TZ: "UTC" })
    .withCommand([
      "postgres",
      "-c",
      "timezone=Etc/UTC",
      "-c",
      "log_timezone=Etc/UTC",
    ])
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
  auth = createAuth(runtimeDatabase);
  previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = uriFor("mcp_runtime", "mcp_runtime_dev");
  resetServerConfigForTest();
  await closeRuntimeDatabase();
  adminId = (
    await bootstrapFirstAdministrator(
      { email: "managed-pages-admin@example.test", passwordHash: "hash" },
      db(),
    )
  ).userId;
}, 300_000);

afterAll(async () => {
  await closeRuntimeDatabase();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  resetServerConfigForTest();
  await runtimeDatabase?.close();
  await container?.stop();
});

describe("managed page lifecycle", () => {
  it("creates a normal draft that is not public and rejects a stale edit version", async () => {
    const created = await createManagedPage(adminId, db());
    const row = await runtimeDatabase.prisma.managedPage.findUniqueOrThrow({
      where: { id: created.pageId },
      include: { activeRevision: { include: { translations: true } } },
    });
    expect(row.systemKey).toBeNull();
    expect(row.publicationStatus).toBe("NEVER_PUBLISHED");
    expect(row.liveRevisionId).toBeNull();
    expect(row.activeRevision?.revisionNumber).toBe(1);
    expect(row.activeRevision?.workflowStatus).toBe("EDITING");
    expect(
      row.activeRevision?.translations.map((item) => item.locale).sort(),
    ).toEqual(["ar", "en"]);
    expect(
      await resolvePublishedManagedPageBySlug("ar", "draft-ar", db()),
    ).toBeNull();

    const saved = await saveManagedPageDraft(
      adminId,
      created.pageId,
      created.editVersion,
      completeDraft("draft-ar", "draft-en"),
      db(),
    );
    expect(saved.editVersion).toBe(1);
    await expect(
      saveManagedPageDraft(
        adminId,
        created.pageId,
        created.editVersion,
        completeDraft("draft-ar", "draft-en"),
        db(),
      ),
    ).rejects.toBeInstanceOf(ManagedPageError);
    await expect(
      saveManagedPageDraft(
        adminId,
        created.pageId,
        0,
        completeDraft("draft-ar", "draft-en"),
        db(),
      ),
    ).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
    expect(
      await resolvePublishedManagedPageBySlug("ar", "draft-ar", db()),
    ).toBeNull();
  });

  it("seeds a system page once and refuses a duplicate system key", async () => {
    const first = await seedSystemManagedPages(
      adminId,
      ["legal.privacy"],
      db(),
    );
    const second = await seedSystemManagedPages(
      adminId,
      ["legal.privacy"],
      db(),
    );
    expect(first.created).toHaveLength(1);
    expect(second.created).toEqual([]);
    expect(second.existing).toEqual(first.created);
    const row = await runtimeDatabase.prisma.managedPage.findUniqueOrThrow({
      where: { systemKey: "legal.privacy" },
    });
    expect(row.publicationStatus).toBe("NEVER_PUBLISHED");
    expect(row.liveRevisionId).toBeNull();
    await expect(
      runtimeDatabase.prisma.managedPage.create({
        data: { systemKey: "legal.privacy", createdById: adminId },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("requires bilingual content, freezes submit, and lets the same actor approve", async () => {
    const created = await createManagedPage(adminId, db());
    await expect(
      submitManagedPage(adminId, created.pageId, 0, db()),
    ).rejects.toMatchObject({
      code: "TRANSLATION_INCOMPLETE",
    });
    const saved = await saveManagedPageDraft(
      adminId,
      created.pageId,
      0,
      completeDraft("review-ar", "review-en", "مراجعة", "Review"),
      db(),
    );
    const block =
      await runtimeDatabase.prisma.managedPageRevisionBlock.findFirstOrThrow({
        where: { revisionId: saved.revisionId, blockType: "CALLOUT" },
      });
    await runtimeDatabase.prisma.managedPageRevisionBlockTranslation.deleteMany(
      {
        where: { blockId: block.id, locale: "en" },
      },
    );
    await expect(
      submitManagedPage(adminId, created.pageId, saved.editVersion, db()),
    ).rejects.toMatchObject({
      code: "TRANSLATION_INCOMPLETE",
    });
    await saveManagedPageDraft(
      adminId,
      created.pageId,
      saved.editVersion,
      completeDraft("review-ar", "review-en", "مراجعة", "Review"),
      db(),
    );
    const revisionId = await submitManagedPage(
      adminId,
      created.pageId,
      saved.editVersion + 1,
      db(),
    );
    await expect(
      saveManagedPageDraft(
        adminId,
        created.pageId,
        saved.editVersion + 1,
        completeDraft("review-ar", "review-en"),
        db(),
      ),
    ).rejects.toMatchObject({ code: "INVALID_WORKFLOW_STATE" });
    expect(
      await resolvePublishedManagedPageBySlug("ar", "review-ar", db()),
    ).toBeNull();
    await approveManagedPage(adminId, created.pageId, db());
    const approved =
      await runtimeDatabase.prisma.managedPageRevision.findUniqueOrThrow({
        where: { id: revisionId },
      });
    expect(approved.workflowStatus).toBe("APPROVED");
    expect(approved.submittedById).toBe(adminId);
    expect(approved.reviewedById).toBe(adminId);
    expect(
      await resolvePublishedManagedPageBySlug("en", "review-en", db()),
    ).toBeNull();
  });

  it("returns a pending revision into a new editing revision", async () => {
    const created = await createManagedPage(adminId, db());
    const saved = await saveManagedPageDraft(
      adminId,
      created.pageId,
      0,
      completeDraft("return-ar", "return-en"),
      db(),
    );
    await submitManagedPage(adminId, created.pageId, saved.editVersion, db());
    await expect(
      returnManagedPage(adminId, created.pageId, "  ", db()),
    ).rejects.toMatchObject({
      code: "RETURN_COMMENT_REQUIRED",
    });
    const restored = await returnManagedPage(
      adminId,
      created.pageId,
      "Please revise the introduction",
      db(),
    );
    expect(restored.workflowStatus).toBe("EDITING");
    expect(restored.revisionNumber).toBe(2);
    const editorial = await getEditorialManagedPage(
      adminId,
      created.pageId,
      "en",
      db(),
    );
    expect(editorial?.workflowEvents[0]?.action).toBe("RETURN");
    expect(editorial?.workflowEvents[0]?.comment).toBe(
      "Please revise the introduction",
    );
    const returned =
      await runtimeDatabase.prisma.managedPageRevision.findFirstOrThrow({
        where: { managedPageId: created.pageId, revisionNumber: 1 },
      });
    expect(returned.workflowStatus).toBe("RETURNED");
  });

  it("publishes only the live revision, redirects a historical slug, restores without publishing, then unpublishes", async () => {
    const pageId = await publishNew(
      "live-ar",
      "live-en",
      "النسخة الأولى",
      "First live",
    );
    const live = asPage(
      await resolvePublishedManagedPageBySlug("ar", "live-ar", db()),
    );
    expect(live.title).toBe("النسخة الأولى");
    expect(JSON.stringify(live)).not.toContain("admin/preview");
    expect(
      await resolvePublishedManagedPageBySlug("en", "live-ar", db()),
    ).toBeNull();

    await startEditingManagedPage(adminId, pageId, db());
    const editing = await getEditorialManagedPage(adminId, pageId, "ar", db());
    expect(editing?.active?.revisionNumber).toBe(2);
    expect(editing?.liveRevisionId).toBe(live.revisionId);
    const nextDraft = structuredClone(editing!.active!.draft);
    nextDraft.translations.ar = {
      ...nextDraft.translations.ar!,
      title: "النسخة الثانية",
      slug: "live-ar-next",
    };
    nextDraft.translations.en = {
      ...nextDraft.translations.en!,
      title: "Second live",
      slug: "live-en",
    };
    const saved = await saveManagedPageDraft(
      adminId,
      pageId,
      editing!.active!.editVersion,
      nextDraft,
      db(),
    );
    expect(
      asPage(await resolvePublishedManagedPageBySlug("ar", "live-ar", db()))
        .title,
    ).toBe("النسخة الأولى");
    await submitManagedPage(adminId, pageId, saved.editVersion, db());
    await approveManagedPage(adminId, pageId, db());
    await publishManagedPage(adminId, pageId, db());

    expect(
      asPage(
        await resolvePublishedManagedPageBySlug("ar", "live-ar-next", db()),
      ).title,
    ).toBe("النسخة الثانية");
    expect(
      await resolvePublishedManagedPageBySlug("ar", "live-ar", db()),
    ).toEqual({
      kind: "redirect",
      slug: "live-ar-next",
    });

    const historical =
      await runtimeDatabase.prisma.managedPageRevision.findFirstOrThrow({
        where: { managedPageId: pageId, revisionNumber: 1 },
        include: { translations: true },
      });
    const before = historical.translations.map((row) => ({
      locale: row.locale,
      title: row.title,
      slug: row.slug,
    }));
    const restored = await restoreManagedPageRevision(
      adminId,
      pageId,
      historical.id,
      db(),
    );
    expect(restored.workflowStatus).toBe("EDITING");
    expect(restored.revisionNumber).toBe(3);
    expect(restored.basedOnRevisionId).toBe(historical.id);
    const after =
      await runtimeDatabase.prisma.managedPageRevisionTranslation.findMany({
        where: { revisionId: historical.id },
        select: { locale: true, title: true, slug: true },
      });
    expect(after).toEqual(expect.arrayContaining(before));
    const published =
      await runtimeDatabase.prisma.managedPage.findUniqueOrThrow({
        where: { id: pageId },
      });
    expect(published.liveRevisionId).not.toBe(restored.id);
    expect(published.publicationStatus).toBe("PUBLISHED");
    expect(
      asPage(
        await resolvePublishedManagedPageBySlug("ar", "live-ar-next", db()),
      ).revisionId,
    ).not.toBe(restored.id);
    await expect(
      restoreManagedPageRevision(adminId, pageId, historical.id, db()),
    ).rejects.toMatchObject({
      code: "ACTIVE_EDITING_EXISTS",
    });
    await expect(
      startEditingManagedPage(adminId, pageId, db()),
    ).rejects.toMatchObject({
      code: "ACTIVE_REVISION_EXISTS",
    });

    const preview = await resolveManagedPagePreview(
      adminId,
      historical.id,
      "ar",
      db(),
    );
    expect(preview?.content.title).toBe("النسخة الأولى");
    expect(preview?.revisionId).toBe(historical.id);
    const versionAfterPreview =
      await runtimeDatabase.prisma.managedPageRevision.findUniqueOrThrow({
        where: { id: historical.id },
        select: { editVersion: true, workflowStatus: true },
      });
    expect(versionAfterPreview).toEqual({
      editVersion: historical.editVersion,
      workflowStatus: historical.workflowStatus,
    });

    await expect(
      unpublishManagedPage(adminId, pageId, " ", db()),
    ).rejects.toMatchObject({
      code: "UNPUBLISH_REASON_REQUIRED",
    });
    await unpublishManagedPage(
      adminId,
      pageId,
      "Withdrawn for correction",
      db(),
    );
    expect(
      await resolvePublishedManagedPageBySlug("ar", "live-ar-next", db()),
    ).toBeNull();
    expect(
      await resolvePublishedManagedPageBySlug("en", "live-en", db()),
    ).toBeNull();
    expect(
      await resolvePublishedManagedPageBySlug("ar", "live-ar", db()),
    ).toBeNull();
    const hidden = await runtimeDatabase.prisma.managedPage.findUniqueOrThrow({
      where: { id: pageId },
    });
    expect(hidden.publicationStatus).toBe("UNPUBLISHED");
    expect(hidden.liveRevisionId).toBeNull();
  });

  it("rejects a colliding slug and does not leak an unpublished internal target", async () => {
    const targetId = await publishNew(
      "target-ar",
      "target-en",
      "الخصوصية",
      "Privacy",
    );
    const sourceId = await publishNew(
      "source-ar",
      "source-en",
      "المصدر",
      "Source",
      targetId,
    );
    const source = asPage(
      await resolvePublishedManagedPageBySlug("ar", "source-ar", db()),
    );
    expect(hrefs(source.content)).toContain("/ar/pages/target-ar");
    const targetView = await getEditorialManagedPage(
      adminId,
      targetId,
      "ar",
      db(),
    );
    const sourceView = await getEditorialManagedPage(
      adminId,
      sourceId,
      "ar",
      db(),
    );
    expect(targetView?.incomingCount).toBeGreaterThan(0);
    expect(sourceView?.outgoingTargets).toContain(targetId);

    await unpublishManagedPage(adminId, targetId, "Target withdrawn", db());
    const degraded = asPage(
      await resolvePublishedManagedPageBySlug("ar", "source-ar", db()),
    );
    expect(
      hrefs(degraded.content).every(
        (href) => href == null || !href.includes("target-ar"),
      ),
    ).toBe(true);
    expect(JSON.stringify(degraded)).not.toContain("target-ar");

    const other = await createManagedPage(adminId, db());
    const saved = await saveManagedPageDraft(
      adminId,
      other.pageId,
      0,
      completeDraft("source-ar", "other-en"),
      db(),
    );
    await submitManagedPage(adminId, other.pageId, saved.editVersion, db());
    await approveManagedPage(adminId, other.pageId, db());
    await expect(
      publishManagedPage(adminId, other.pageId, db()),
    ).rejects.toMatchObject({
      code: "SLUG_ALREADY_IN_USE",
    });
  });

  it("returns not found when the requested locale translation is missing", async () => {
    const pageId = await publishNew("only-ar", "only-en");
    const live = await runtimeDatabase.prisma.managedPage.findUniqueOrThrow({
      where: { id: pageId },
    });
    await runtimeDatabase.prisma.managedPageRevisionTranslation.deleteMany({
      where: { revisionId: live.liveRevisionId!, locale: "en" },
    });
    expect(
      await resolvePublishedManagedPageBySlug("en", "only-en", db()),
    ).toBeNull();
    expect(
      asPage(await resolvePublishedManagedPageBySlug("ar", "only-ar", db()))
        .title,
    ).toBe("صفحة اللجنة");
  });

  it("rejects unsafe external links and corrupted stored content", async () => {
    const created = await createManagedPage(adminId, db());
    const unsafe = completeDraft("unsafe-ar", "unsafe-en");
    unsafe.blocks[2]!.linkItems = [
      {
        id: createUuidV7(),
        kind: "external",
        targetRef: null,
        href: "javascript:alert(1)",
      },
    ];
    await expect(
      saveManagedPageDraft(adminId, created.pageId, 0, unsafe, db()),
    ).rejects.toMatchObject({
      code: "INVALID_LINK",
    });
    const saved = await saveManagedPageDraft(
      adminId,
      created.pageId,
      0,
      completeDraft("unsafe-ar", "unsafe-en"),
      db(),
    );
    await runtimeDatabase.prisma.managedPageRevisionTranslation.updateMany({
      where: { revisionId: saved.revisionId, locale: "ar" },
      data: { title: "<script>alert(1)</script>" },
    });
    await expect(
      submitManagedPage(adminId, created.pageId, saved.editVersion, db()),
    ).rejects.toMatchObject({
      code: "INVALID_BLOCK",
    });
    await saveManagedPageDraft(
      adminId,
      created.pageId,
      saved.editVersion,
      completeDraft("unsafe-ar", "unsafe-en"),
      db(),
    );
    const rich =
      await runtimeDatabase.prisma.managedPageRevisionBlock.findFirstOrThrow({
        where: { revisionId: saved.revisionId, blockType: "RICHTEXT" },
      });
    await runtimeDatabase.prisma.managedPageRevisionBlockTranslation.updateMany(
      {
        where: { blockId: rich.id, locale: "en" },
        data: {
          payload: {
            schemaVersion: 1,
            engine: "tiptap",
            engineVersion: "3.31.3",
            document: { type: "doc", content: [{ type: "iframe" }] },
          },
        },
      },
    );
    await expect(
      submitManagedPage(adminId, created.pageId, saved.editVersion + 1, db()),
    ).rejects.toMatchObject({
      code: "INVALID_RICH_TEXT",
    });
  });
});

describe("managed page authorization and preview", () => {
  it("enforces each managed-page permission on its own use case", async () => {
    const reader = await makeUser();
    const creator = await makeUser();
    const editor = await makeUser();
    const reviewer = await makeUser();
    const publisher = await makeUser();
    const stranger = await makeUser();
    await grant(reader, [PERMISSIONS.MANAGED_PAGES_READ]);
    await grant(creator, [PERMISSIONS.MANAGED_PAGES_CREATE]);
    await grant(editor, [PERMISSIONS.MANAGED_PAGES_EDIT]);
    await grant(reviewer, [PERMISSIONS.MANAGED_PAGES_REVIEW]);
    await grant(publisher, [PERMISSIONS.MANAGED_PAGES_PUBLISH]);

    await expect(createManagedPage(stranger, db())).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    await expect(createManagedPage(reader, db())).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    const createdByCreator = await createManagedPage(creator, db());
    await expect(
      saveManagedPageDraft(
        creator,
        createdByCreator.pageId,
        0,
        completeDraft("perm-ar", "perm-en"),
        db(),
      ),
    ).rejects.toBeInstanceOf(AccessDeniedError);

    const created = await createManagedPage(adminId, db());
    await expect(
      getEditorialManagedPage(editor, created.pageId, "ar", db()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    const saved = await saveManagedPageDraft(
      editor,
      created.pageId,
      0,
      completeDraft("perm-ar", "perm-en"),
      db(),
    );
    await expect(
      submitManagedPage(reader, created.pageId, saved.editVersion, db()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await submitManagedPage(editor, created.pageId, saved.editVersion, db());
    await expect(
      approveManagedPage(editor, created.pageId, db()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      publishManagedPage(reviewer, created.pageId, db()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await approveManagedPage(reviewer, created.pageId, db());
    await expect(
      publishManagedPage(reviewer, created.pageId, db()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await publishManagedPage(publisher, created.pageId, db());
    expect(
      asPage(await resolvePublishedManagedPageBySlug("en", "perm-en", db()))
        .pageId,
    ).toBe(created.pageId);

    await expect(
      resolveManagedPagePreview(stranger, saved.revisionId, "ar", db()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    const preview = await resolveManagedPagePreview(
      reader,
      saved.revisionId,
      "en",
      db(),
    );
    expect(preview?.content.title).toBe("Committee page");
    expect(JSON.stringify(preview)).not.toContain("admin/preview");
  });
});
