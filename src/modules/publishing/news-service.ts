import type { Database } from "@/platform/database";
import {
  Prisma,
  type NewsRevision,
} from "@/platform/database/generated/client";
import { getRuntimeDatabase } from "@/platform/runtime";
import { PERMISSIONS, requireActorPermission } from "@/modules/identity";

import {
  NewsError,
  newsBodyText,
  readNewsBody,
  validateDraft,
  type NewsDraftInput,
  type NewsLocale,
} from "./news-rules";

const snapshot = { translations: true, categories: true } as const;
type Transaction = Prisma.TransactionClient;

async function lockedNews(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM "publishing"."news" WHERE id = ${id}::uuid FOR UPDATE`;
  const news = await tx.news.findUnique({ where: { id } });
  if (!news) throw new NewsError("NEWS_NOT_FOUND");
  return news;
}

async function active(tx: Transaction, newsId: string) {
  const news = await lockedNews(tx, newsId);
  if (!news.activeRevisionId) throw new NewsError("NO_ACTIVE_REVISION");
  const revision = await tx.newsRevision.findUniqueOrThrow({
    where: { id: news.activeRevisionId },
    include: snapshot,
  });
  return { news, revision };
}

function contentOf(revision: {
  translations: {
    locale: string;
    title: string;
    slug: string;
    summary: string | null;
    body: Prisma.JsonValue | null;
    seoTitle: string | null;
    seoDescription: string | null;
  }[];
  categories: { categoryId: string }[];
}): NewsDraftInput {
  return {
    translations: Object.fromEntries(
      revision.translations.map((t) => [
        t.locale,
        {
          title: t.title,
          slug: t.slug,
          summary: t.summary,
          body: readNewsBody(t.body),
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
        },
      ]),
    ) as NewsDraftInput["translations"],
    categoryIds: revision.categories.map((c) => c.categoryId),
  };
}

function translationRows(input: NewsDraftInput) {
  return Object.entries(input.translations).map(([locale, value]) => ({
    locale,
    title: value!.title,
    slug: value!.slug,
    summary: value!.summary ?? null,
    body: (value!.body ?? Prisma.JsonNull) as
      Prisma.InputJsonValue | typeof Prisma.JsonNull,
    seoTitle: value!.seoTitle ?? null,
    seoDescription: value!.seoDescription ?? null,
  }));
}

async function checkCategories(
  tx: Transaction,
  revisionId: string,
  categoryIds: string[],
) {
  if (!categoryIds.length) return;
  const existing = await tx.newsRevisionCategory.findMany({
    where: { revisionId },
    select: { categoryId: true },
  });
  const previouslyAssigned = new Set(existing.map((row) => row.categoryId));
  const categories = await tx.newsCategory.findMany({
    where: { id: { in: categoryIds } },
  });
  if (categories.length !== categoryIds.length) {
    throw new NewsError("INVALID_REFERENCE");
  }
  for (const category of categories) {
    if (!category.isActive && !previouslyAssigned.has(category.id)) {
      throw new NewsError("INACTIVE_CATEGORY");
    }
  }
}

async function clone(
  tx: Transaction,
  newsId: string,
  source: NewsRevision & Awaited<ReturnType<typeof loadSnapshot>>,
  actorId: string,
) {
  const last = await tx.newsRevision.findFirst({
    where: { newsId },
    orderBy: { revisionNumber: "desc" },
  });
  const revision = await tx.newsRevision.create({
    data: {
      newsId,
      revisionNumber: (last?.revisionNumber ?? 0) + 1,
      basedOnRevisionId: source.id,
      createdById: actorId,
      translations: { create: translationRows(contentOf(source)) },
      categories: {
        create: source.categories.map(({ categoryId }) => ({ categoryId })),
      },
    },
    include: snapshot,
  });
  await tx.news.update({
    where: { id: newsId },
    data: { activeRevisionId: revision.id },
  });
  return revision;
}

async function loadSnapshot(tx: Transaction, id: string) {
  return tx.newsRevision.findUniqueOrThrow({
    where: { id },
    include: snapshot,
  });
}

function requireState(actual: string, expected: string) {
  if (actual !== expected) throw new NewsError("INVALID_WORKFLOW_STATE");
}

export async function createNewsDraft(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_CREATE);
  return database.prisma.$transaction(async (tx) => {
    const news = await tx.news.create({ data: { createdById: actorId } });
    const revision = await tx.newsRevision.create({
      data: { newsId: news.id, revisionNumber: 1, createdById: actorId },
    });
    await tx.news.update({
      where: { id: news.id },
      data: { activeRevisionId: revision.id },
    });
    return {
      newsId: news.id,
      revisionId: revision.id,
      editVersion: revision.editVersion,
    };
  });
}

export async function saveNewsDraft(
  actorId: string,
  newsId: string,
  expectedVersion: number,
  input: NewsDraftInput,
  database: Database = getRuntimeDatabase(),
) {
  const draft = validateDraft(input);
  await requireActorPermission(actorId, PERMISSIONS.NEWS_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const { revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "EDITING");
    if (revision.editVersion !== expectedVersion)
      throw new NewsError("CONCURRENT_MODIFICATION");
    await checkCategories(tx, revision.id, draft.categoryIds);
    const changed = await tx.newsRevision.updateMany({
      where: {
        id: revision.id,
        workflowStatus: "EDITING",
        editVersion: expectedVersion,
      },
      data: { editVersion: { increment: 1 } },
    });
    if (!changed.count) throw new NewsError("CONCURRENT_MODIFICATION");
    await tx.newsRevisionTranslation.deleteMany({
      where: { revisionId: revision.id },
    });
    await tx.newsRevisionCategory.deleteMany({
      where: { revisionId: revision.id },
    });
    await tx.newsRevisionTranslation.createMany({
      data: translationRows(draft).map((row) => ({
        ...row,
        revisionId: revision.id,
      })),
    });
    await tx.newsRevisionCategory.createMany({
      data: draft.categoryIds.map((categoryId) => ({
        categoryId,
        revisionId: revision.id,
      })),
    });
    return { revisionId: revision.id, editVersion: expectedVersion + 1 };
  });
}

async function complete(revision: Awaited<ReturnType<typeof loadSnapshot>>) {
  return validateDraft(contentOf(revision), true);
}

async function transition(
  tx: Transaction,
  revision: NewsRevision,
  actorId: string,
  toStatus: "PENDING_REVIEW" | "APPROVED" | "RETURNED" | "ABANDONED",
  action: "SUBMIT" | "APPROVE" | "RETURN" | "ABANDON",
  comment?: string,
) {
  await tx.newsRevision.update({
    where: { id: revision.id },
    data: {
      workflowStatus: toStatus,
      ...(toStatus === "PENDING_REVIEW"
        ? { submittedAt: new Date(), submittedById: actorId }
        : {}),
      ...(toStatus === "APPROVED" || toStatus === "RETURNED"
        ? { reviewedAt: new Date(), reviewedById: actorId }
        : {}),
    },
  });
  await tx.newsWorkflowEvent.create({
    data: {
      newsId: revision.newsId,
      revisionId: revision.id,
      fromStatus: revision.workflowStatus,
      toStatus,
      action,
      actorId,
      comment,
    },
  });
}

export async function submitNews(
  actorId: string,
  newsId: string,
  expectedVersion: number,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const { revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "EDITING");
    if (revision.editVersion !== expectedVersion)
      throw new NewsError("CONCURRENT_MODIFICATION");
    await complete(revision);
    await transition(tx, revision, actorId, "PENDING_REVIEW", "SUBMIT");
    return revision.id;
  });
}

export async function approveNews(
  actorId: string,
  newsId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_REVIEW);
  return database.prisma.$transaction(async (tx) => {
    const { revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "PENDING_REVIEW");
    if (revision.submittedById === actorId)
      throw new NewsError("SELF_APPROVAL_FORBIDDEN");
    await complete(revision);
    await transition(tx, revision, actorId, "APPROVED", "APPROVE");
    return revision.id;
  });
}

export async function returnNews(
  actorId: string,
  newsId: string,
  comment: string,
  database: Database = getRuntimeDatabase(),
) {
  if (!comment?.trim()) throw new NewsError("RETURN_COMMENT_REQUIRED");
  await requireActorPermission(actorId, PERMISSIONS.NEWS_REVIEW);
  return database.prisma.$transaction(async (tx) => {
    const { revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "PENDING_REVIEW");
    await transition(
      tx,
      revision,
      actorId,
      "RETURNED",
      "RETURN",
      comment.trim(),
    );
    return clone(tx, newsId, revision, actorId);
  });
}

export async function restoreApprovedNews(
  actorId: string,
  newsId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const { revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "APPROVED");
    const draft = await clone(tx, newsId, revision, actorId);
    await tx.newsWorkflowEvent.create({
      data: {
        newsId,
        revisionId: draft.id,
        action: "RESTORE",
        fromStatus: "APPROVED",
        toStatus: "EDITING",
        actorId,
      },
    });
    return draft;
  });
}

export async function startEditingNews(
  actorId: string,
  newsId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const news = await lockedNews(tx, newsId);
    if (news.activeRevisionId) throw new NewsError("ACTIVE_REVISION_EXISTS");
    const source = news.liveRevisionId
      ? await loadSnapshot(tx, news.liveRevisionId)
      : await tx.newsRevision.findFirst({
          where: { newsId },
          orderBy: { revisionNumber: "desc" },
          include: snapshot,
        });
    if (!source) throw new NewsError("NO_REVISION");
    return clone(tx, newsId, source, actorId);
  });
}

export async function abandonNewsDraft(
  actorId: string,
  newsId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const { revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "EDITING");
    await transition(tx, revision, actorId, "ABANDONED", "ABANDON");
    await tx.news.update({
      where: { id: newsId },
      data: { activeRevisionId: null },
    });
  });
}

export async function publishNews(
  actorId: string,
  newsId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_PUBLISH);
  return database.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(90909)::text`;
    const { news, revision } = await active(tx, newsId);
    requireState(revision.workflowStatus, "APPROVED");
    await complete(revision);
    for (const t of revision.translations) {
      const reserved = await tx.newsSlugRedirect.findUnique({
        where: { locale_slug: { locale: t.locale, slug: t.slug } },
      });
      if (reserved && reserved.newsId !== newsId)
        throw new NewsError("SLUG_ALREADY_IN_USE");
      const collision = await tx.news.findFirst({
        where: {
          id: { not: newsId },
          publicationStatus: "PUBLISHED",
          liveRevision: {
            translations: { some: { locale: t.locale, slug: t.slug } },
          },
        },
      });
      if (collision) throw new NewsError("SLUG_ALREADY_IN_USE");
    }
    if (news.liveRevisionId && news.publicationStatus === "PUBLISHED") {
      const old = await loadSnapshot(tx, news.liveRevisionId);
      for (const t of old.translations) {
        if (
          revision.translations.some(
            (next) => next.locale === t.locale && next.slug === t.slug,
          )
        )
          continue;
        await tx.newsSlugRedirect.upsert({
          where: { locale_slug: { locale: t.locale, slug: t.slug } },
          create: { newsId, locale: t.locale, slug: t.slug },
          update: {},
        });
      }
    }
    for (const t of revision.translations) {
      await tx.newsSlugRedirect.deleteMany({
        where: { newsId, locale: t.locale, slug: t.slug },
      });
    }
    await tx.news.update({
      where: { id: newsId },
      data: {
        liveRevisionId: revision.id,
        activeRevisionId: null,
        publicationStatus: "PUBLISHED",
        publishedAt: new Date(),
        unpublishedAt: null,
      },
    });
    await tx.newsPublicationEvent.create({
      data: { newsId, revisionId: revision.id, action: "PUBLISH", actorId },
    });
    return revision.id;
  });
}

export async function unpublishNews(
  actorId: string,
  newsId: string,
  reason: string,
  database: Database = getRuntimeDatabase(),
) {
  if (!reason?.trim()) throw new NewsError("UNPUBLISH_REASON_REQUIRED");
  await requireActorPermission(actorId, PERMISSIONS.NEWS_PUBLISH);
  return database.prisma.$transaction(async (tx) => {
    const news = await lockedNews(tx, newsId);
    if (news.publicationStatus !== "PUBLISHED" || !news.liveRevisionId)
      throw new NewsError("NOT_PUBLISHED");
    await tx.news.update({
      where: { id: newsId },
      data: {
        publicationStatus: "UNPUBLISHED",
        liveRevisionId: null,
        unpublishedAt: new Date(),
      },
    });
    await tx.newsPublicationEvent.create({
      data: {
        newsId,
        revisionId: news.liveRevisionId,
        action: "UNPUBLISH",
        reason: reason.trim(),
        actorId,
      },
    });
  });
}

export async function getEditorialNews(
  actorId: string,
  newsId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_READ);
  return database.prisma.news.findUnique({
    where: { id: newsId },
    include: {
      activeRevision: { include: snapshot },
      liveRevision: { include: snapshot },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        include: { translations: true },
      },
      workflowEvents: { orderBy: { createdAt: "desc" } },
      publicationEvents: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listEditorialNews(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_READ);
  return database.prisma.news.findMany({
    include: {
      activeRevision: { include: snapshot },
      liveRevision: { include: snapshot },
      revisions: {
        take: 1,
        orderBy: { revisionNumber: "desc" },
        include: { translations: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export interface PublicNews {
  newsId: string;
  revisionId: string;
  locale: NewsLocale;
  title: string;
  summary: string;
  bodyText: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date;
  counterpartSlug: string | null;
}

const publicNewsSelection = {
  id: true,
  publishedAt: true,
  liveRevision: {
    select: {
      id: true,
      translations: {
        select: {
          locale: true,
          title: true,
          summary: true,
          body: true,
          slug: true,
          seoTitle: true,
          seoDescription: true,
        },
      },
    },
  },
} as const;

type PublicNewsRow = Prisma.NewsGetPayload<{
  select: typeof publicNewsSelection;
}>;
type PublicTranslation = NonNullable<
  PublicNewsRow["liveRevision"]
>["translations"][number];

function publicTranslation(translation: PublicTranslation | undefined) {
  const summary = translation?.summary;
  if (!translation?.title.trim() || !translation.slug || !summary?.trim())
    return null;
  try {
    const bodyText = newsBodyText(translation.body);
    return bodyText.trim() ? { ...translation, summary, bodyText } : null;
  } catch (error) {
    if (error instanceof NewsError && error.code === "INVALID_BODY")
      return null;
    throw error;
  }
}

function toPublicNews(
  row: PublicNewsRow,
  locale: NewsLocale,
): PublicNews | null {
  const revision = row.liveRevision;
  if (!revision || !row.publishedAt) return null;
  const translation = publicTranslation(
    revision.translations.find((item) => item.locale === locale),
  );
  if (!translation) return null;
  const counterpart = publicTranslation(
    revision.translations.find(
      (item) => item.locale === (locale === "ar" ? "en" : "ar"),
    ),
  );
  return {
    newsId: row.id,
    revisionId: revision.id,
    locale,
    title: translation.title,
    summary: translation.summary,
    bodyText: translation.bodyText,
    slug: translation.slug,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    publishedAt: row.publishedAt,
    counterpartSlug: counterpart?.slug ?? null,
  };
}

export async function listPublishedNews(
  locale: NewsLocale,
  database: Database = getRuntimeDatabase(),
): Promise<PublicNews[]> {
  const rows = await database.prisma.news.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      liveRevisionId: { not: null },
      liveRevision: { translations: { some: { locale } } },
    },
    select: publicNewsSelection,
    orderBy: { publishedAt: "desc" },
  });
  return rows.flatMap((row) => {
    const item = toPublicNews(row, locale);
    return item ? [item] : [];
  });
}

export type PublishedNewsResolution =
  { kind: "news"; news: PublicNews } | { kind: "redirect"; slug: string };

export async function resolvePublishedNewsBySlug(
  locale: NewsLocale,
  slug: string,
  database: Database = getRuntimeDatabase(),
): Promise<PublishedNewsResolution | null> {
  const current = await database.prisma.news.findFirst({
    where: {
      publicationStatus: "PUBLISHED",
      liveRevisionId: { not: null },
      liveRevision: { translations: { some: { locale, slug } } },
    },
    select: publicNewsSelection,
  });
  if (current) {
    const news = toPublicNews(current, locale);
    return news ? { kind: "news", news } : null;
  }

  const historical = await database.prisma.newsSlugRedirect.findUnique({
    where: { locale_slug: { locale, slug } },
    select: {
      news: {
        select: {
          ...publicNewsSelection,
          publicationStatus: true,
          liveRevisionId: true,
        },
      },
    },
  });
  const target = historical?.news;
  if (
    !target ||
    target.publicationStatus !== "PUBLISHED" ||
    !target.liveRevisionId
  )
    return null;
  const news = toPublicNews(target, locale);
  return news && news.slug !== slug
    ? { kind: "redirect", slug: news.slug }
    : null;
}
