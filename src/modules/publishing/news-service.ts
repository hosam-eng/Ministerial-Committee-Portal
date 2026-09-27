import type { Database } from "@/platform/database";
import { Prisma, type NewsRevision } from "@/platform/database/generated/client";
import { getRuntimeDatabase } from "@/platform/runtime";
import { AccessDeniedError, PERMISSIONS, type PermissionKey } from "@/modules/identity";

import { NewsError, validateDraft, type NewsDraftInput, type NewsLocale } from "./news-rules";


const snapshot = { translations: true, categories: true } as const;
type Transaction = Prisma.TransactionClient;

async function authorize(tx: Transaction, actorId: string, permission: PermissionKey) {
  const roles = await tx.userRole.findMany({
    where: { userId: actorId, role: { isActive: true } },
    select: { role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } },
  });
  if (!roles.some(({ role }) => role.permissions.some(({ permission: item }) => item.key === permission))) {
    throw new AccessDeniedError(permission);
  }
}

async function lockedNews(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM "publishing"."news" WHERE id = ${id}::uuid FOR UPDATE`;
  const news = await tx.news.findUnique({ where: { id } });
  if (!news) throw new NewsError("NEWS_NOT_FOUND");
  return news;
}

async function active(tx: Transaction, newsId: string) {
  const news = await lockedNews(tx, newsId);
  if (!news.activeRevisionId) throw new NewsError("NO_ACTIVE_REVISION");
  const revision = await tx.newsRevision.findUniqueOrThrow({ where: { id: news.activeRevisionId }, include: snapshot });
  return { news, revision };
}

function contentOf(revision: { translations: { locale: string; title: string; slug: string; summary: string | null; body: Prisma.JsonValue | null; seoTitle: string | null; seoDescription: string | null }[]; categories: { categoryId: string }[] }): NewsDraftInput {
  return {
    translations: Object.fromEntries(revision.translations.map((t) => [t.locale, {
      title: t.title, slug: t.slug, summary: t.summary, body: t.body,
      seoTitle: t.seoTitle, seoDescription: t.seoDescription,
    }])) as NewsDraftInput["translations"],
    categoryIds: revision.categories.map((c) => c.categoryId),
  };
}

function translationRows(input: NewsDraftInput) {
  return Object.entries(input.translations).map(([locale, value]) => ({
    locale, title: value!.title, slug: value!.slug, summary: value!.summary ?? null,
    body: (value!.body ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
    seoTitle: value!.seoTitle ?? null, seoDescription: value!.seoDescription ?? null,
  }));
}

async function checkCategories(tx: Transaction, categoryIds: string[]) {
  if (!categoryIds.length) return;
  const count = await tx.newsCategory.count({ where: { id: { in: categoryIds } } });
  if (count !== categoryIds.length) throw new NewsError("INVALID_REFERENCE");
}

async function clone(tx: Transaction, newsId: string, source: NewsRevision & Awaited<ReturnType<typeof loadSnapshot>>, actorId: string) {
  const last = await tx.newsRevision.findFirst({ where: { newsId }, orderBy: { revisionNumber: "desc" } });
  const revision = await tx.newsRevision.create({
    data: {
      newsId, revisionNumber: (last?.revisionNumber ?? 0) + 1, basedOnRevisionId: source.id,
      createdById: actorId,
      translations: { create: translationRows(contentOf(source)) },
      categories: { create: source.categories.map(({ categoryId }) => ({ categoryId })) },
    },
    include: snapshot,
  });
  await tx.news.update({ where: { id: newsId }, data: { activeRevisionId: revision.id } });
  return revision;
}

async function loadSnapshot(tx: Transaction, id: string) {
  return tx.newsRevision.findUniqueOrThrow({ where: { id }, include: snapshot });
}

function requireState(actual: string, expected: string) {
  if (actual !== expected) throw new NewsError("INVALID_WORKFLOW_STATE");
}

export async function createNewsDraft(actorId: string, database: Database = getRuntimeDatabase()) {
  return database.prisma.$transaction(async (tx) => {
    await authorize(tx, actorId, PERMISSIONS.NEWS_CREATE);
    const news = await tx.news.create({ data: { createdById: actorId } });
    const revision = await tx.newsRevision.create({ data: { newsId: news.id, revisionNumber: 1, createdById: actorId } });
    await tx.news.update({ where: { id: news.id }, data: { activeRevisionId: revision.id } });
    return { newsId: news.id, revisionId: revision.id, editVersion: revision.editVersion };
  });
}

export async function saveNewsDraft(actorId: string, newsId: string, expectedVersion: number, input: NewsDraftInput, database: Database = getRuntimeDatabase()) {
  const draft = validateDraft(input);
  return database.prisma.$transaction(async (tx) => {
    await authorize(tx, actorId, PERMISSIONS.NEWS_EDIT);
    const { revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "EDITING");
    if (revision.editVersion !== expectedVersion) throw new NewsError("CONCURRENT_MODIFICATION");
    await checkCategories(tx, draft.categoryIds);
    const changed = await tx.newsRevision.updateMany({
      where: { id: revision.id, workflowStatus: "EDITING", editVersion: expectedVersion },
      data: { editVersion: { increment: 1 } },
    });
    if (!changed.count) throw new NewsError("CONCURRENT_MODIFICATION");
    await tx.newsRevisionTranslation.deleteMany({ where: { revisionId: revision.id } });
    await tx.newsRevisionCategory.deleteMany({ where: { revisionId: revision.id } });
    await tx.newsRevisionTranslation.createMany({ data: translationRows(draft).map((row) => ({ ...row, revisionId: revision.id })) });
    await tx.newsRevisionCategory.createMany({ data: draft.categoryIds.map((categoryId) => ({ categoryId, revisionId: revision.id })) });
    return { revisionId: revision.id, editVersion: expectedVersion + 1 };
  });
}

async function complete(revision: Awaited<ReturnType<typeof loadSnapshot>>) {
  return validateDraft(contentOf(revision), true);
}

async function transition(tx: Transaction, revision: NewsRevision, actorId: string, toStatus: "PENDING_REVIEW" | "APPROVED" | "RETURNED" | "ABANDONED", action: "SUBMIT" | "APPROVE" | "RETURN" | "ABANDON", comment?: string) {
  await tx.newsRevision.update({ where: { id: revision.id }, data: {
    workflowStatus: toStatus,
    ...(toStatus === "PENDING_REVIEW" ? { submittedAt: new Date(), submittedById: actorId } : {}),
    ...(toStatus === "APPROVED" || toStatus === "RETURNED" ? { reviewedAt: new Date(), reviewedById: actorId } : {}),
  } });
  await tx.newsWorkflowEvent.create({ data: {
    newsId: revision.newsId, revisionId: revision.id, fromStatus: revision.workflowStatus,
    toStatus, action, actorId, comment,
  } });
}

export async function submitNews(actorId: string, newsId: string, expectedVersion: number, database: Database = getRuntimeDatabase()) {
  return database.prisma.$transaction(async (tx) => {
    await authorize(tx, actorId, PERMISSIONS.NEWS_EDIT);
    const { revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "EDITING");
    if (revision.editVersion !== expectedVersion) throw new NewsError("CONCURRENT_MODIFICATION");
    await complete(revision);
    await transition(tx, revision, actorId, "PENDING_REVIEW", "SUBMIT");
    return revision.id;
  });
}

export async function approveNews(actorId: string, newsId: string, database: Database = getRuntimeDatabase()) {
  return database.prisma.$transaction(async (tx) => {
    await authorize(tx, actorId, PERMISSIONS.NEWS_REVIEW);
    const { revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "PENDING_REVIEW");
    if (revision.submittedById === actorId) throw new NewsError("SELF_APPROVAL_FORBIDDEN");
    await complete(revision);
    await transition(tx, revision, actorId, "APPROVED", "APPROVE");
    return revision.id;
  });
}

export async function returnNews(actorId: string, newsId: string, comment: string, database: Database = getRuntimeDatabase()) {
  if (!comment?.trim()) throw new NewsError("RETURN_COMMENT_REQUIRED");
  return database.prisma.$transaction(async (tx) => {
    await authorize(tx, actorId, PERMISSIONS.NEWS_REVIEW);
    const { revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "PENDING_REVIEW");
    await transition(tx, revision, actorId, "RETURNED", "RETURN", comment.trim());
    return clone(tx, newsId, revision, actorId);
  });
}

export async function startEditingNews(actorId: string, newsId: string, database: Database = getRuntimeDatabase()) {
  return database.prisma.$transaction(async (tx) => {
    await authorize(tx, actorId, PERMISSIONS.NEWS_EDIT);
    const news = await lockedNews(tx, newsId);
    if (news.activeRevisionId) throw new NewsError("ACTIVE_REVISION_EXISTS");
    const source = news.liveRevisionId
      ? await loadSnapshot(tx, news.liveRevisionId)
      : await tx.newsRevision.findFirst({ where: { newsId }, orderBy: { revisionNumber: "desc" }, include: snapshot });
    if (!source) throw new NewsError("NO_REVISION");
    return clone(tx, newsId, source, actorId);
  });
}

export async function abandonNewsDraft(actorId: string, newsId: string, database: Database = getRuntimeDatabase()) {
  return database.prisma.$transaction(async (tx) => {
    await authorize(tx, actorId, PERMISSIONS.NEWS_EDIT);
    const { revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "EDITING");
    await transition(tx, revision, actorId, "ABANDONED", "ABANDON");
    await tx.news.update({ where: { id: newsId }, data: { activeRevisionId: null } });
  });
}

export async function publishNews(actorId: string, newsId: string, database: Database = getRuntimeDatabase()) {
  return database.prisma.$transaction(async (tx) => {
    await authorize(tx, actorId, PERMISSIONS.NEWS_PUBLISH);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(90909)::text`;
    const { news, revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "APPROVED");
    await complete(revision);
    for (const t of revision.translations) {
      const reserved = await tx.newsSlugRedirect.findUnique({ where: { locale_slug: { locale: t.locale, slug: t.slug } } });
      if (reserved && reserved.newsId !== newsId) throw new NewsError("SLUG_ALREADY_IN_USE");
      const collision = await tx.news.findFirst({ where: {
        id: { not: newsId }, publicationStatus: "PUBLISHED",
        liveRevision: { translations: { some: { locale: t.locale, slug: t.slug } } },
      } });
      if (collision) throw new NewsError("SLUG_ALREADY_IN_USE");
    }
    if (news.liveRevisionId && news.publicationStatus === "PUBLISHED") {
      const old = await loadSnapshot(tx, news.liveRevisionId);
      for (const t of old.translations) {
        if (revision.translations.some((next) => next.locale === t.locale && next.slug === t.slug)) continue;
        await tx.newsSlugRedirect.upsert({
          where: { locale_slug: { locale: t.locale, slug: t.slug } },
          create: { newsId, locale: t.locale, slug: t.slug }, update: {},
        });
      }
    }
    for (const t of revision.translations) {
      await tx.newsSlugRedirect.deleteMany({ where: { newsId, locale: t.locale, slug: t.slug } });
    }
    await tx.news.update({ where: { id: newsId }, data: {
      liveRevisionId: revision.id, activeRevisionId: null, publicationStatus: "PUBLISHED",
      publishedAt: new Date(), unpublishedAt: null,
    } });
    await tx.newsPublicationEvent.create({ data: { newsId, revisionId: revision.id, action: "PUBLISH", actorId } });
    return revision.id;
  });
}

export async function unpublishNews(actorId: string, newsId: string, reason: string, database: Database = getRuntimeDatabase()) {
  if (!reason?.trim()) throw new NewsError("UNPUBLISH_REASON_REQUIRED");
  return database.prisma.$transaction(async (tx) => {
    await authorize(tx, actorId, PERMISSIONS.NEWS_PUBLISH);
    const news = await lockedNews(tx, newsId);
    if (news.publicationStatus !== "PUBLISHED" || !news.liveRevisionId) throw new NewsError("NOT_PUBLISHED");
    await tx.news.update({ where: { id: newsId }, data: {
      publicationStatus: "UNPUBLISHED", liveRevisionId: null, unpublishedAt: new Date(),
    } });
    await tx.newsPublicationEvent.create({ data: { newsId, revisionId: news.liveRevisionId, action: "UNPUBLISH", reason: reason.trim(), actorId } });
  });
}

export async function getEditorialNews(actorId: string, newsId: string, database: Database = getRuntimeDatabase()) {
  await database.prisma.$transaction((tx) => authorize(tx, actorId, PERMISSIONS.NEWS_READ));
  return database.prisma.news.findUnique({ where: { id: newsId }, include: { activeRevision: { include: snapshot } } });
}

export async function listEditorialNews(actorId: string, database: Database = getRuntimeDatabase()) {
  await database.prisma.$transaction((tx) => authorize(tx, actorId, PERMISSIONS.NEWS_READ));
  return database.prisma.news.findMany({ include: { activeRevision: { include: snapshot } }, orderBy: { createdAt: "desc" } });
}

export async function getPublishedNews(database: Database = getRuntimeDatabase()) {
  return database.prisma.news.findMany({
    where: { publicationStatus: "PUBLISHED", liveRevisionId: { not: null } },
    include: { liveRevision: { include: snapshot } }, orderBy: { publishedAt: "desc" },
  });
}

export async function getPublishedNewsBySlug(locale: NewsLocale, slug: string, database: Database = getRuntimeDatabase()) {
  const normalized = validateDraft({ translations: { [locale]: { title: "", slug } }, categoryIds: [] }).translations[locale]!.slug;
  return database.prisma.news.findFirst({
    where: { publicationStatus: "PUBLISHED", liveRevisionId: { not: null }, liveRevision: { translations: { some: { locale, slug: normalized } } } },
    include: { liveRevision: { include: snapshot } },
  });
}
