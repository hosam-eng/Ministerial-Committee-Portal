import "server-only";

import { PERMISSIONS, requireActorPermission } from "@/modules/identity";
import type { Database } from "@/platform/database";
import { Prisma } from "@/platform/database/generated/client";
import { getRuntimeDatabase } from "@/platform/runtime";

import { isPublishedAggregate } from "../application/lifecycle";
import type {
  ManagedPageContent,
  ManagedPageContentBlock,
} from "../domain/content";
import {
  collectDraftReferences,
  validateManagedPageDraft,
  type BlockLocaleContent,
  type BlockType,
  type CalloutVariant,
  type ManagedPageDraft,
} from "../domain/draft";
import { ManagedPageError } from "../domain/errors";
import { createUuidV7 } from "../domain/ids";
import type { ManagedPageLocale } from "../domain/locales";
import {
  collectRichTextReferences,
  readRichTextDocument,
} from "../domain/rich-text-document";
import { normalizeSystemKey } from "../domain/system-key";

const snapshot = {
  translations: true,
  blocks: {
    orderBy: { position: "asc" as const },
    include: { translations: true },
  },
  references: true,
} as const;

type Transaction = Prisma.TransactionClient;
type Snapshot = Prisma.ManagedPageRevisionGetPayload<{
  include: typeof snapshot;
}>;

const CALLOUT_TO_DB = {
  institutional: "INSTITUTIONAL",
  info: "INFO",
  success: "SUCCESS",
  warning: "WARNING",
  error: "ERROR",
} as const;

const CALLOUT_FROM_DB: Record<string, CalloutVariant> = {
  INSTITUTIONAL: "institutional",
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
};

export type EditorialManagedPage = {
  id: string;
  systemKey: string | null;
  publicationStatus: "NEVER_PUBLISHED" | "PUBLISHED" | "UNPUBLISHED";
  publishedAt: Date | null;
  liveRevisionId: string | null;
  liveRevisionNumber: number | null;
  active: {
    id: string;
    revisionNumber: number;
    workflowStatus: "EDITING" | "PENDING_REVIEW" | "APPROVED" | "RETURNED";
    editVersion: number;
    submittedById: string | null;
    draft: ManagedPageDraft;
  } | null;
  revisions: {
    id: string;
    revisionNumber: number;
    workflowStatus: string;
    createdAt: Date;
  }[];
  workflowEvents: { action: string; comment: string | null; createdAt: Date }[];
  publicationEvents: {
    action: string;
    reason: string | null;
    createdAt: Date;
  }[];
  outgoingTargets: string[];
  incomingCount: number;
  linkOptions: { id: string; label: string }[];
};

export type ManagedPageListItem = {
  id: string;
  systemKey: string | null;
  publicationStatus: "NEVER_PUBLISHED" | "PUBLISHED" | "UNPUBLISHED";
  updatedAt: Date;
  publishedAt: Date | null;
  title: string;
  workflowStatus: string | null;
};

export type PublicManagedPage = {
  pageId: string;
  revisionId: string;
  locale: ManagedPageLocale;
  title: string;
  intro: string | null;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date;
  counterpartSlug: string | null;
  content: ManagedPageContent;
};

export type PublishedManagedPageResolution =
  | { kind: "page"; page: PublicManagedPage }
  | { kind: "redirect"; slug: string };

export type ManagedPagePreview = {
  pageId: string;
  revisionId: string;
  locale: ManagedPageLocale;
  incomplete: boolean;
  content: ManagedPageContent;
};

function shellTranslations() {
  return [
    { locale: "ar", title: "", slug: "" },
    { locale: "en", title: "", slug: "" },
  ];
}

async function lockedPage(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM "publishing"."managed_page" WHERE id = ${id}::uuid FOR UPDATE`;
  const page = await tx.managedPage.findUnique({ where: { id } });
  if (!page) throw new ManagedPageError("PAGE_NOT_FOUND");
  return page;
}

async function loadSnapshot(tx: Transaction, id: string) {
  return tx.managedPageRevision.findUniqueOrThrow({
    where: { id },
    include: snapshot,
  });
}

function payloadInput(
  type: BlockType,
  content: BlockLocaleContent,
): Prisma.InputJsonValue {
  if (type === "RICHTEXT")
    return (content.document ?? { type: "doc" }) as Prisma.InputJsonValue;
  if (type === "CALLOUT") {
    return { schemaVersion: 1, title: content.title, body: content.body ?? "" };
  }
  return { schemaVersion: 1, heading: content.heading, labels: content.labels };
}

function contentInput(type: string, payload: Prisma.JsonValue): unknown {
  if (type === "RICHTEXT") return { document: payload };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ManagedPageError("INVALID_BLOCK");
  }
  return payload;
}

function snapshotToDraft(revision: Snapshot): ManagedPageDraft {
  const translations: Record<string, unknown> = {};
  for (const row of revision.translations) {
    translations[row.locale] = {
      title: row.title,
      slug: row.slug,
      intro: row.intro,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
    };
  }
  const blocks = [...revision.blocks]
    .sort((a, b) => a.position - b.position)
    .map((block) => ({
      id: block.id,
      type: block.blockType,
      calloutVariant: block.calloutVariant
        ? CALLOUT_FROM_DB[block.calloutVariant]
        : null,
      linkItems: block.linkItems ?? [],
      content: Object.fromEntries(
        block.translations.map((row) => [
          row.locale,
          contentInput(block.blockType, row.payload),
        ]),
      ),
    }));
  return validateManagedPageDraft({ translations, blocks });
}

function retargetDraft(draft: ManagedPageDraft): ManagedPageDraft {
  return validateManagedPageDraft({
    translations: draft.translations,
    blocks: draft.blocks.map((block) => ({ ...block, id: createUuidV7() })),
  });
}

async function writeDraft(
  tx: Transaction,
  revisionId: string,
  draft: ManagedPageDraft,
) {
  await tx.managedPageRevisionTranslation.deleteMany({ where: { revisionId } });
  await tx.managedPageRevisionBlock.deleteMany({ where: { revisionId } });
  if (Object.keys(draft.translations).length) {
    await tx.managedPageRevisionTranslation.createMany({
      data: Object.entries(draft.translations).map(([locale, value]) => ({
        revisionId,
        locale,
        title: value!.title,
        slug: value!.slug,
        intro: value!.intro,
        seoTitle: value!.seoTitle,
        seoDescription: value!.seoDescription,
      })),
    });
  }
  for (const [position, block] of draft.blocks.entries()) {
    await tx.managedPageRevisionBlock.create({
      data: {
        id: block.id,
        revisionId,
        position,
        blockType: block.type,
        schemaVersion: 1,
        calloutVariant: block.calloutVariant
          ? CALLOUT_TO_DB[block.calloutVariant]
          : null,
        linkItems:
          block.type === "LINK_LIST"
            ? (block.linkItems as Prisma.InputJsonValue)
            : undefined,
        translations: {
          create: Object.entries(block.content).map(([locale, content]) => ({
            locale,
            payload: payloadInput(block.type, content!),
          })),
        },
      },
    });
  }
  const references = collectDraftReferences(draft);
  if (!references.length) return;
  const ids = [
    ...new Set(references.map((reference) => reference.targetPageId)),
  ];
  const found = await tx.managedPage.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new ManagedPageError("INVALID_REFERENCE");
  await tx.managedPageReference.createMany({
    data: references.map((reference) => ({
      sourceRevisionId: revisionId,
      sourceBlockId: reference.blockId,
      targetPageId: reference.targetPageId,
      locale: reference.locale,
      origin: reference.origin,
      itemKey: reference.itemKey,
    })),
  });
}

async function cloneRevision(
  tx: Transaction,
  pageId: string,
  source: Snapshot,
  actorId: string,
) {
  const last = await tx.managedPageRevision.findFirst({
    where: { managedPageId: pageId },
    orderBy: { revisionNumber: "desc" },
  });
  const draft = retargetDraft(snapshotToDraft(source));
  const revision = await tx.managedPageRevision.create({
    data: {
      managedPageId: pageId,
      revisionNumber: (last?.revisionNumber ?? 0) + 1,
      basedOnRevisionId: source.id,
      createdById: actorId,
    },
  });
  await writeDraft(tx, revision.id, draft);
  await tx.managedPage.update({
    where: { id: pageId },
    data: { activeRevisionId: revision.id },
  });
  return loadSnapshot(tx, revision.id);
}

async function active(tx: Transaction, pageId: string) {
  const page = await lockedPage(tx, pageId);
  if (!page.activeRevisionId) throw new ManagedPageError("NO_ACTIVE_REVISION");
  const revision = await loadSnapshot(tx, page.activeRevisionId);
  if (revision.managedPageId !== pageId)
    throw new ManagedPageError("NO_ACTIVE_REVISION");
  return { page, revision };
}

async function openPage(
  tx: Transaction,
  actorId: string,
  systemKey: string | null,
) {
  const page = await tx.managedPage.create({
    data: { systemKey, createdById: actorId },
  });
  const revision = await tx.managedPageRevision.create({
    data: {
      managedPageId: page.id,
      revisionNumber: 1,
      createdById: actorId,
      translations: { create: shellTranslations() },
    },
  });
  await tx.managedPage.update({
    where: { id: page.id },
    data: { activeRevisionId: revision.id },
  });
  return {
    pageId: page.id,
    revisionId: revision.id,
    editVersion: revision.editVersion,
  };
}

export async function createManagedPage(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_CREATE);
  return database.prisma.$transaction((tx) => openPage(tx, actorId, null));
}

export async function seedSystemManagedPages(
  actorId: string,
  systemKeys: readonly string[],
  database: Database = getRuntimeDatabase(),
) {
  const keys = [...new Set(systemKeys.map(normalizeSystemKey))];
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_CREATE);
  return database.prisma.$transaction(async (tx) => {
    const created: string[] = [];
    const existing: string[] = [];
    for (const systemKey of keys) {
      const found = await tx.managedPage.findUnique({ where: { systemKey } });
      if (found) {
        existing.push(found.id);
        continue;
      }
      try {
        const page = await openPage(tx, actorId, systemKey);
        created.push(page.pageId);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const raced = await tx.managedPage.findUnique({
            where: { systemKey },
          });
          if (raced) existing.push(raced.id);
          else throw error;
        } else throw error;
      }
    }
    return { created, existing };
  });
}

export async function saveManagedPageDraft(
  actorId: string,
  pageId: string,
  expectedVersion: number,
  input: unknown,
  database: Database = getRuntimeDatabase(),
) {
  const draft = validateManagedPageDraft(input);
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const { revision } = await active(tx, pageId);
    if (revision.workflowStatus !== "EDITING") {
      throw new ManagedPageError("INVALID_WORKFLOW_STATE");
    }
    if (revision.editVersion !== expectedVersion) {
      throw new ManagedPageError("CONCURRENT_MODIFICATION");
    }
    const changed = await tx.managedPageRevision.updateMany({
      where: {
        id: revision.id,
        workflowStatus: "EDITING",
        editVersion: expectedVersion,
      },
      data: { editVersion: { increment: 1 } },
    });
    if (!changed.count) throw new ManagedPageError("CONCURRENT_MODIFICATION");
    await writeDraft(tx, revision.id, draft);
    return { revisionId: revision.id, editVersion: expectedVersion + 1 };
  });
}

async function completeSnapshot(revision: Snapshot) {
  return validateManagedPageDraft(
    {
      translations: Object.fromEntries(
        revision.translations.map((row) => [
          row.locale,
          {
            title: row.title,
            slug: row.slug,
            intro: row.intro,
            seoTitle: row.seoTitle,
            seoDescription: row.seoDescription,
          },
        ]),
      ),
      blocks: snapshotToDraft(revision).blocks,
    },
    true,
  );
}

async function transition(
  tx: Transaction,
  revision: Snapshot,
  actorId: string,
  toStatus: "PENDING_REVIEW" | "APPROVED" | "RETURNED",
  action: "SUBMIT" | "APPROVE" | "RETURN",
  comment?: string,
) {
  await tx.managedPageRevision.update({
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
  await tx.managedPageWorkflowEvent.create({
    data: {
      managedPageId: revision.managedPageId,
      revisionId: revision.id,
      fromStatus: revision.workflowStatus,
      toStatus,
      action,
      actorId,
      comment,
    },
  });
}

export async function submitManagedPage(
  actorId: string,
  pageId: string,
  expectedVersion: number,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const { revision } = await active(tx, pageId);
    if (revision.workflowStatus !== "EDITING") {
      throw new ManagedPageError("INVALID_WORKFLOW_STATE");
    }
    if (revision.editVersion !== expectedVersion) {
      throw new ManagedPageError("CONCURRENT_MODIFICATION");
    }
    await completeSnapshot(revision);
    await transition(tx, revision, actorId, "PENDING_REVIEW", "SUBMIT");
    return revision.id;
  });
}

export async function approveManagedPage(
  actorId: string,
  pageId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_REVIEW);
  return database.prisma.$transaction(async (tx) => {
    const { revision } = await active(tx, pageId);
    if (revision.workflowStatus !== "PENDING_REVIEW") {
      throw new ManagedPageError("INVALID_WORKFLOW_STATE");
    }
    await completeSnapshot(revision);
    await transition(tx, revision, actorId, "APPROVED", "APPROVE");
    return revision.id;
  });
}

export async function returnManagedPage(
  actorId: string,
  pageId: string,
  comment: string,
  database: Database = getRuntimeDatabase(),
) {
  if (!comment?.trim()) throw new ManagedPageError("RETURN_COMMENT_REQUIRED");
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_REVIEW);
  return database.prisma.$transaction(async (tx) => {
    const { revision } = await active(tx, pageId);
    if (revision.workflowStatus !== "PENDING_REVIEW") {
      throw new ManagedPageError("INVALID_WORKFLOW_STATE");
    }
    await transition(
      tx,
      revision,
      actorId,
      "RETURNED",
      "RETURN",
      comment.trim(),
    );
    return cloneRevision(tx, pageId, revision, actorId);
  });
}

export async function startEditingManagedPage(
  actorId: string,
  pageId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const page = await lockedPage(tx, pageId);
    if (page.activeRevisionId)
      throw new ManagedPageError("ACTIVE_REVISION_EXISTS");
    const source = page.liveRevisionId
      ? await loadSnapshot(tx, page.liveRevisionId)
      : await tx.managedPageRevision.findFirst({
          where: { managedPageId: pageId },
          orderBy: { revisionNumber: "desc" },
          include: snapshot,
        });
    if (!source) throw new ManagedPageError("NO_REVISION");
    return cloneRevision(tx, pageId, source, actorId);
  });
}

export async function restoreManagedPageRevision(
  actorId: string,
  pageId: string,
  sourceRevisionId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const page = await lockedPage(tx, pageId);
    if (page.activeRevisionId) {
      const current = await tx.managedPageRevision.findUnique({
        where: { id: page.activeRevisionId },
      });
      if (current?.workflowStatus === "EDITING") {
        throw new ManagedPageError("ACTIVE_EDITING_EXISTS");
      }
      if (current?.workflowStatus === "PENDING_REVIEW") {
        throw new ManagedPageError("ACTIVE_REVISION_EXISTS");
      }
    }
    const source = await loadSnapshot(tx, sourceRevisionId);
    if (source.managedPageId !== pageId)
      throw new ManagedPageError("REVISION_NOT_FOUND");
    const before = snapshotToDraft(source);
    const draft = await cloneRevision(tx, pageId, source, actorId);
    const after = snapshotToDraft(await loadSnapshot(tx, source.id));
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new ManagedPageError("INVALID_WORKFLOW_STATE");
    }
    const live = await tx.managedPage.findUnique({ where: { id: pageId } });
    if (live?.liveRevisionId !== page.liveRevisionId) {
      throw new ManagedPageError("INVALID_WORKFLOW_STATE");
    }
    await tx.managedPageWorkflowEvent.create({
      data: {
        managedPageId: pageId,
        revisionId: draft.id,
        action: "RESTORE",
        fromStatus: source.workflowStatus,
        toStatus: "EDITING",
        actorId,
      },
    });
    return draft;
  });
}

export async function publishManagedPage(
  actorId: string,
  pageId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_PUBLISH);
  return database.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(90913)::text`;
    const { page, revision } = await active(tx, pageId);
    if (revision.workflowStatus !== "APPROVED") {
      throw new ManagedPageError("INVALID_WORKFLOW_STATE");
    }
    const draft = await completeSnapshot(revision);
    const references = collectDraftReferences(draft);
    if (references.length) {
      const ids = [
        ...new Set(references.map((reference) => reference.targetPageId)),
      ];
      const found = await tx.managedPage.count({ where: { id: { in: ids } } });
      if (found !== ids.length) throw new ManagedPageError("INVALID_REFERENCE");
    }
    for (const translation of revision.translations) {
      const reserved = await tx.managedPageSlugRedirect.findUnique({
        where: {
          locale_slug: { locale: translation.locale, slug: translation.slug },
        },
      });
      if (reserved && reserved.managedPageId !== pageId) {
        throw new ManagedPageError("SLUG_ALREADY_IN_USE");
      }
      const collision = await tx.managedPage.findFirst({
        where: {
          id: { not: pageId },
          publicationStatus: "PUBLISHED",
          liveRevision: {
            translations: {
              some: { locale: translation.locale, slug: translation.slug },
            },
          },
        },
      });
      if (collision) throw new ManagedPageError("SLUG_ALREADY_IN_USE");
    }
    if (page.liveRevisionId && page.publicationStatus === "PUBLISHED") {
      const old = await loadSnapshot(tx, page.liveRevisionId);
      for (const previous of old.translations) {
        if (
          revision.translations.some(
            (next) =>
              next.locale === previous.locale && next.slug === previous.slug,
          )
        ) {
          continue;
        }
        const existingRedirect = await tx.managedPageSlugRedirect.findUnique({
          where: {
            locale_slug: { locale: previous.locale, slug: previous.slug },
          },
        });
        if (existingRedirect && existingRedirect.managedPageId !== pageId) {
          throw new ManagedPageError("SLUG_ALREADY_IN_USE");
        }
        await tx.managedPageSlugRedirect.upsert({
          where: {
            locale_slug: { locale: previous.locale, slug: previous.slug },
          },
          create: {
            managedPageId: pageId,
            locale: previous.locale,
            slug: previous.slug,
          },
          update: {},
        });
      }
    }
    for (const translation of revision.translations) {
      await tx.managedPageSlugRedirect.deleteMany({
        where: {
          managedPageId: pageId,
          locale: translation.locale,
          slug: translation.slug,
        },
      });
    }
    await tx.managedPage.update({
      where: { id: pageId },
      data: {
        liveRevisionId: revision.id,
        activeRevisionId: null,
        publicationStatus: "PUBLISHED",
        publishedAt: new Date(),
        unpublishedAt: null,
      },
    });
    await tx.managedPagePublicationEvent.create({
      data: {
        managedPageId: pageId,
        revisionId: revision.id,
        action: "PUBLISH",
        actorId,
      },
    });
    return revision.id;
  });
}

export async function unpublishManagedPage(
  actorId: string,
  pageId: string,
  reason: string,
  database: Database = getRuntimeDatabase(),
) {
  if (!reason?.trim()) throw new ManagedPageError("UNPUBLISH_REASON_REQUIRED");
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_PUBLISH);
  return database.prisma.$transaction(async (tx) => {
    const page = await lockedPage(tx, pageId);
    if (
      !isPublishedAggregate(page.publicationStatus, page.liveRevisionId) ||
      !page.liveRevisionId
    ) {
      throw new ManagedPageError("NOT_PUBLISHED");
    }
    await tx.managedPage.update({
      where: { id: pageId },
      data: {
        publicationStatus: "UNPUBLISHED",
        liveRevisionId: null,
        unpublishedAt: new Date(),
      },
    });
    await tx.managedPagePublicationEvent.create({
      data: {
        managedPageId: pageId,
        revisionId: page.liveRevisionId,
        action: "UNPUBLISH",
        reason: reason.trim(),
        actorId,
      },
    });
  });
}

async function livePaths(
  database: Database,
  locale: ManagedPageLocale,
  pageIds: string[],
) {
  const paths = new Map<string, string>();
  if (!pageIds.length) return paths;
  const rows = await database.prisma.managedPage.findMany({
    where: {
      id: { in: pageIds },
      publicationStatus: "PUBLISHED",
      liveRevisionId: { not: null },
    },
    select: {
      id: true,
      liveRevision: {
        select: {
          translations: {
            where: { locale },
            select: { slug: true, title: true },
          },
        },
      },
    },
  });
  for (const row of rows) {
    const translation = row.liveRevision?.translations[0];
    if (!translation?.slug || !translation.title.trim()) continue;
    paths.set(
      row.id,
      `/${locale}/pages/${encodeURIComponent(translation.slug)}`,
    );
  }
  return paths;
}

function contentFor(
  draft: ManagedPageDraft,
  locale: ManagedPageLocale,
  paths: Map<string, string>,
  strict: boolean,
): {
  content: ManagedPageContent;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
} | null {
  const translation = draft.translations[locale];
  if (strict && (!translation?.title || !translation.slug)) return null;
  const blocks: ManagedPageContentBlock[] = [];
  for (const block of draft.blocks) {
    const localized = block.content[locale];
    if (!localized) {
      if (strict) return null;
      continue;
    }
    if (block.type === "RICHTEXT") {
      if (!localized.document) {
        if (strict) return null;
        continue;
      }
      const document = readRichTextDocument(localized.document);
      const internalHrefs: Record<string, string | null> = {};
      for (const reference of collectRichTextReferences(document)) {
        internalHrefs[reference.targetPageId] =
          paths.get(reference.targetPageId) ?? null;
      }
      blocks.push({ id: block.id, type: "RICHTEXT", document, internalHrefs });
    } else if (block.type === "CALLOUT") {
      if (!localized.body || !block.calloutVariant) {
        if (strict) return null;
        continue;
      }
      blocks.push({
        id: block.id,
        type: "CALLOUT",
        variant: block.calloutVariant,
        title: localized.title,
        body: localized.body,
      });
    } else {
      const items = block.linkItems.flatMap((item) => {
        const label = localized.labels[item.id];
        if (!label) return [];
        const href =
          item.kind === "external"
            ? item.href
            : item.targetRef
              ? (paths.get(item.targetRef) ?? null)
              : null;
        return [{ id: item.id, label, href }];
      });
      if (strict && block.linkItems.some((item) => !localized.labels[item.id]))
        return null;
      blocks.push({
        id: block.id,
        type: "LINK_LIST",
        heading: localized.heading,
        items,
      });
    }
  }
  return {
    content: {
      title: translation?.title ?? "",
      intro: translation?.intro ?? null,
      blocks,
    },
    slug: translation?.slug ?? "",
    seoTitle: translation?.seoTitle ?? null,
    seoDescription: translation?.seoDescription ?? null,
  };
}

function referencedIds(draft: ManagedPageDraft) {
  return [
    ...new Set(
      collectDraftReferences(draft).map((reference) => reference.targetPageId),
    ),
  ];
}

async function project(
  database: Database,
  revision: Snapshot,
  locale: ManagedPageLocale,
  strict: boolean,
) {
  let draft: ManagedPageDraft;
  try {
    draft = snapshotToDraft(revision);
  } catch (error) {
    if (error instanceof ManagedPageError) return null;
    throw error;
  }
  const paths = await livePaths(database, locale, referencedIds(draft));
  return contentFor(draft, locale, paths, strict);
}

const publicSelection = {
  id: true,
  publishedAt: true,
  publicationStatus: true,
  liveRevisionId: true,
  liveRevision: { include: snapshot },
} as const;

function toPublic(
  row: {
    id: string;
    publishedAt: Date | null;
    publicationStatus: string;
    liveRevisionId: string | null;
    liveRevision: Snapshot | null;
  },
  locale: ManagedPageLocale,
  projection: NonNullable<Awaited<ReturnType<typeof project>>>,
  counterpartSlug: string | null,
): PublicManagedPage | null {
  if (
    !isPublishedAggregate(row.publicationStatus, row.liveRevisionId) ||
    !row.liveRevision ||
    !row.publishedAt
  ) {
    return null;
  }
  if (row.liveRevision.id !== row.liveRevisionId) return null;
  return {
    pageId: row.id,
    revisionId: row.liveRevision.id,
    locale,
    title: projection.content.title,
    intro: projection.content.intro,
    slug: projection.slug,
    seoTitle: projection.seoTitle,
    seoDescription: projection.seoDescription,
    publishedAt: row.publishedAt,
    counterpartSlug,
    content: projection.content,
  };
}

export async function resolvePublishedManagedPageBySlug(
  locale: ManagedPageLocale,
  slug: string,
  database: Database = getRuntimeDatabase(),
): Promise<PublishedManagedPageResolution | null> {
  const current = await database.prisma.managedPage.findFirst({
    where: {
      publicationStatus: "PUBLISHED",
      liveRevisionId: { not: null },
      liveRevision: { translations: { some: { locale, slug } } },
    },
    select: publicSelection,
  });
  if (current?.liveRevision) {
    const projection = await project(
      database,
      current.liveRevision,
      locale,
      true,
    );
    const other = locale === "ar" ? "en" : "ar";
    const counterpart = projection
      ? await project(database, current.liveRevision, other, true)
      : null;
    const page = projection
      ? toPublic(current, locale, projection, counterpart?.slug ?? null)
      : null;
    return page ? { kind: "page", page } : null;
  }
  const historical = await database.prisma.managedPageSlugRedirect.findUnique({
    where: { locale_slug: { locale, slug } },
    select: { managedPage: { select: publicSelection } },
  });
  const target = historical?.managedPage;
  if (
    !target?.liveRevision ||
    !isPublishedAggregate(target.publicationStatus, target.liveRevisionId)
  ) {
    return null;
  }
  const projection = await project(database, target.liveRevision, locale, true);
  const page = projection ? toPublic(target, locale, projection, null) : null;
  return page && page.slug !== slug
    ? { kind: "redirect", slug: page.slug }
    : null;
}

export async function resolveManagedPagePreview(
  actorId: string,
  revisionId: string,
  locale: ManagedPageLocale,
  database: Database = getRuntimeDatabase(),
): Promise<ManagedPagePreview | null> {
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_READ);
  const revision = await database.prisma.managedPageRevision.findUnique({
    where: { id: revisionId },
    include: snapshot,
  });
  if (!revision) return null;
  const projection = await project(database, revision, locale, false);
  if (!projection) return null;
  const translation = revision.translations.find(
    (row) => row.locale === locale,
  );
  return {
    pageId: revision.managedPageId,
    revisionId: revision.id,
    locale,
    incomplete: !translation?.title.trim() || !translation.slug,
    content: projection.content,
  };
}

function titleOf(
  revision:
    { translations: { locale: string; title: string }[] } | null | undefined,
  locale: string,
) {
  return (
    revision?.translations.find((row) => row.locale === locale)?.title ||
    revision?.translations.find((row) => row.title)?.title ||
    ""
  );
}

export async function getEditorialManagedPage(
  actorId: string,
  pageId: string,
  locale: ManagedPageLocale,
  database: Database = getRuntimeDatabase(),
): Promise<EditorialManagedPage | null> {
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_READ);
  const page = await database.prisma.managedPage.findUnique({
    where: { id: pageId },
    include: {
      activeRevision: { include: snapshot },
      liveRevision: { select: { id: true, revisionNumber: true } },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        select: {
          id: true,
          revisionNumber: true,
          workflowStatus: true,
          createdAt: true,
        },
      },
      workflowEvents: {
        orderBy: { createdAt: "desc" },
        select: { action: true, comment: true, createdAt: true },
      },
      publicationEvents: {
        orderBy: { createdAt: "desc" },
        select: { action: true, reason: true, createdAt: true },
      },
    },
  });
  if (!page) return null;
  const activeDraft = page.activeRevision
    ? snapshotToDraft(page.activeRevision)
    : null;
  const focusRevisionId = page.activeRevision?.id ?? page.liveRevisionId;
  const outgoingRows = focusRevisionId
    ? await database.prisma.managedPageReference.findMany({
        where: { sourceRevisionId: focusRevisionId },
        select: { targetPageId: true },
      })
    : [];
  const outgoingTargets = [
    ...new Set(outgoingRows.map((row) => row.targetPageId)),
  ];
  const incomingRows = await database.prisma.managedPageReference.findMany({
    where: { targetPageId: pageId },
    select: {
      revision: {
        select: {
          id: true,
          managedPage: {
            select: { id: true, liveRevisionId: true, activeRevisionId: true },
          },
        },
      },
    },
  });
  const incomingCount = new Set(
    incomingRows
      .filter(
        (row) =>
          row.revision.id === row.revision.managedPage.liveRevisionId ||
          row.revision.id === row.revision.managedPage.activeRevisionId,
      )
      .map((row) => row.revision.managedPage.id),
  ).size;
  const options = await database.prisma.managedPage.findMany({
    select: {
      id: true,
      activeRevision: {
        select: { translations: { select: { locale: true, title: true } } },
      },
      liveRevision: {
        select: { translations: { select: { locale: true, title: true } } },
      },
      revisions: {
        take: 1,
        orderBy: { revisionNumber: "desc" },
        select: { translations: { select: { locale: true, title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return {
    id: page.id,
    systemKey: page.systemKey,
    publicationStatus: page.publicationStatus,
    publishedAt: page.publishedAt,
    liveRevisionId: page.liveRevisionId,
    liveRevisionNumber: page.liveRevision?.revisionNumber ?? null,
    active:
      page.activeRevision && activeDraft
        ? {
            id: page.activeRevision.id,
            revisionNumber: page.activeRevision.revisionNumber,
            workflowStatus: page.activeRevision.workflowStatus,
            editVersion: page.activeRevision.editVersion,
            submittedById: page.activeRevision.submittedById,
            draft: activeDraft,
          }
        : null,
    revisions: page.revisions,
    workflowEvents: page.workflowEvents,
    publicationEvents: page.publicationEvents,
    outgoingTargets,
    incomingCount,
    linkOptions: options.map((option) => ({
      id: option.id,
      label:
        titleOf(option.activeRevision, locale) ||
        titleOf(option.liveRevision, locale) ||
        titleOf(option.revisions[0], locale) ||
        option.id,
    })),
  };
}

export async function listEditorialManagedPages(
  actorId: string,
  locale: ManagedPageLocale,
  database: Database = getRuntimeDatabase(),
): Promise<ManagedPageListItem[]> {
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_READ);
  const rows = await database.prisma.managedPage.findMany({
    include: {
      activeRevision: { include: { translations: true } },
      liveRevision: { include: { translations: true } },
      revisions: {
        take: 1,
        orderBy: { revisionNumber: "desc" },
        include: { translations: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    systemKey: row.systemKey,
    publicationStatus: row.publicationStatus,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    title:
      titleOf(row.activeRevision, locale) ||
      titleOf(row.liveRevision, locale) ||
      titleOf(row.revisions[0], locale),
    workflowStatus: row.activeRevision?.workflowStatus ?? null,
  }));
}

export type ManagedPageNavigationTarget = {
  pageId: string;
  titleAr: string;
  titleEn: string;
  hrefAr: string | null;
  hrefEn: string | null;
  isPubliclyAvailable: boolean;
};

function liveTitleAndPath(
  row: {
    publicationStatus: string;
    liveRevisionId: string | null;
    liveRevision: {
      translations: { locale: string; slug: string; title: string }[];
    } | null;
  } | null,
  locale: ManagedPageLocale,
) {
  if (
    !row ||
    !isPublishedAggregate(row.publicationStatus, row.liveRevisionId) ||
    !row.liveRevision
  ) {
    return { title: "", href: null as string | null };
  }
  const translation = row.liveRevision.translations.find(
    (item) => item.locale === locale,
  );
  if (!translation?.slug || !translation.title.trim()) {
    return { title: "", href: null };
  }
  return {
    title: translation.title.trim(),
    href: `/${locale}/pages/${encodeURIComponent(translation.slug)}`,
  };
}

/** Public navigation content-route contract (stable page ID). */
export async function resolveManagedPageNavigationTarget(
  pageId: string,
  database: Database = getRuntimeDatabase(),
): Promise<ManagedPageNavigationTarget | null> {
  const row = await database.prisma.managedPage.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      publicationStatus: true,
      liveRevisionId: true,
      liveRevision: {
        select: {
          translations: {
            select: { locale: true, slug: true, title: true },
          },
        },
      },
      activeRevision: {
        select: {
          translations: {
            select: { locale: true, slug: true, title: true },
          },
        },
      },
      revisions: {
        take: 1,
        orderBy: { revisionNumber: "desc" },
        select: {
          translations: {
            select: { locale: true, slug: true, title: true },
          },
        },
      },
    },
  });
  if (!row) return null;
  const liveAr = liveTitleAndPath(row, "ar");
  const liveEn = liveTitleAndPath(row, "en");
  const draftAr =
    row.activeRevision?.translations.find((item) => item.locale === "ar")
      ?.title ??
    row.revisions[0]?.translations.find((item) => item.locale === "ar")
      ?.title ??
    "";
  const draftEn =
    row.activeRevision?.translations.find((item) => item.locale === "en")
      ?.title ??
    row.revisions[0]?.translations.find((item) => item.locale === "en")
      ?.title ??
    "";
  return {
    pageId: row.id,
    titleAr: liveAr.title || draftAr.trim(),
    titleEn: liveEn.title || draftEn.trim(),
    hrefAr: liveAr.href,
    hrefEn: liveEn.href,
    isPubliclyAvailable: Boolean(liveAr.href && liveEn.href),
  };
}

export type ManagedPageNavigationPickerItem = {
  id: string;
  title: string;
  isPubliclyAvailable: boolean;
};

export async function listManagedPageNavigationPickerTargets(
  actorId: string,
  locale: ManagedPageLocale,
  database: Database = getRuntimeDatabase(),
): Promise<ManagedPageNavigationPickerItem[]> {
  await requireActorPermission(actorId, PERMISSIONS.MANAGED_PAGES_READ);
  const rows = await database.prisma.managedPage.findMany({
    select: {
      id: true,
      publicationStatus: true,
      liveRevisionId: true,
      liveRevision: {
        select: {
          translations: {
            select: { locale: true, slug: true, title: true },
          },
        },
      },
      activeRevision: {
        select: {
          translations: {
            select: { locale: true, title: true },
          },
        },
      },
      revisions: {
        take: 1,
        orderBy: { revisionNumber: "desc" },
        select: {
          translations: {
            select: { locale: true, title: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => {
    const live = liveTitleAndPath(row, locale);
    const draftTitle =
      row.activeRevision?.translations.find((item) => item.locale === locale)
        ?.title ??
      row.revisions[0]?.translations.find((item) => item.locale === locale)
        ?.title ??
      "";
    return {
      id: row.id,
      title: live.title || draftTitle.trim() || row.id,
      isPubliclyAvailable: Boolean(live.href),
    };
  });
}
