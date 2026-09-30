import "server-only";

import { PERMISSIONS, requireActorPermission } from "@/modules/identity";
import type { Database } from "@/platform/database";
import {
  Prisma,
  type PrismaClient,
} from "@/platform/database/generated/client";
import { getServerConfig } from "@/platform/config/server";
import { getRuntimeDatabase } from "@/platform/runtime";

import { assertPublishableNavigationTargets } from "./public-route-resolver";
import {
  emptyNavigationDraft,
  validateNavigationDraft,
  type NavigationDraft,
  type NavigationItemDraft,
} from "../domain/draft";
import { PublicNavigationError } from "../domain/errors";
import { PUBLIC_NAVIGATION_SINGLETON_KEY } from "../domain/singleton";

type Transaction = Prisma.TransactionClient;
type DbClient = Transaction | PrismaClient;

type ItemRow = Prisma.PublicNavigationItemGetPayload<object>;

type Snapshot = Prisma.PublicNavigationRevisionGetPayload<{
  include: { items: true };
}>;

async function loadSnapshot(client: DbClient, id: string): Promise<Snapshot> {
  const revision = await client.publicNavigationRevision.findUniqueOrThrow({
    where: { id },
  });
  const items = await client.publicNavigationItem.findMany({
    where: { revisionId: id },
    orderBy: [{ location: "asc" }, { siblingOrder: "asc" }],
  });
  return { ...revision, items };
}

async function loadEditorialRoot(client: DbClient) {
  const root = await client.publicNavigation.findUniqueOrThrow({
    where: { singletonKey: PUBLIC_NAVIGATION_SINGLETON_KEY },
  });
  const revisions = await client.publicNavigationRevision.findMany({
    where: { publicNavigationId: root.id },
    orderBy: { revisionNumber: "desc" },
  });
  const workflowEvents = await client.publicNavigationWorkflowEvent.findMany({
    where: { publicNavigationId: root.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const publicationEvents =
    await client.publicNavigationPublicationEvent.findMany({
      where: { publicNavigationId: root.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  const activeRevision = root.activeRevisionId
    ? await loadSnapshot(client, root.activeRevisionId)
    : null;
  const liveRevision = root.liveRevisionId
    ? await client.publicNavigationRevision.findUnique({
        where: { id: root.liveRevisionId },
      })
    : null;
  return {
    ...root,
    revisions,
    workflowEvents,
    publicationEvents,
    activeRevision,
    liveRevision,
  };
}

const PUBLISH_LOCK = 90916;

export type EditorialPublicNavigation = {
  id: string;
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
    draft: NavigationDraft;
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
};

export type NavigationPreview = {
  revisionId: string;
  locale: "ar" | "en";
  incomplete: boolean;
};

function itemToDraft(row: ItemRow): NavigationItemDraft {
  return {
    itemKey: row.itemKey,
    location: row.location,
    itemType: row.itemType,
    parentItemKey: row.parentItemKey,
    siblingOrder: row.siblingOrder,
    labelAr: row.labelAr,
    labelEn: row.labelEn,
    systemRouteKey: row.systemRouteKey ?? "",
    contentTargetKind: row.contentTargetKind ?? "",
    contentTargetId: row.contentTargetId ?? "",
    externalUrl: row.externalUrl ?? "",
  };
}

function snapshotToDraft(revision: Snapshot): NavigationDraft {
  return validateNavigationDraft({
    items: revision.items.map(itemToDraft),
  });
}

async function lockedRoot(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM "public_navigation"."public_navigation" WHERE id = ${id}::uuid FOR UPDATE`;
  const root = await tx.publicNavigation.findUnique({ where: { id } });
  if (!root) throw new PublicNavigationError("NOT_FOUND");
  return root;
}

async function writeDraft(
  tx: Transaction,
  revisionId: string,
  draft: NavigationDraft,
) {
  await tx.publicNavigationItem.deleteMany({ where: { revisionId } });
  if (!draft.items.length) return;
  await tx.publicNavigationItem.createMany({
    data: draft.items.map((item) => ({
      revisionId,
      itemKey: item.itemKey,
      location: item.location,
      itemType: item.itemType,
      parentItemKey: item.parentItemKey,
      siblingOrder: item.siblingOrder,
      labelAr: item.labelAr,
      labelEn: item.labelEn,
      systemRouteKey: item.systemRouteKey.trim() || null,
      contentTargetKind:
        item.contentTargetKind === "MANAGED_PAGE" ? "MANAGED_PAGE" : null,
      contentTargetId: item.contentTargetId.trim() || null,
      externalUrl: item.externalUrl.trim() || null,
    })),
  });
}

async function cloneRevision(
  tx: Transaction,
  rootId: string,
  source: Snapshot,
  actorId: string,
) {
  const last = await tx.publicNavigationRevision.findFirst({
    where: { publicNavigationId: rootId },
    orderBy: { revisionNumber: "desc" },
  });
  const revision = await tx.publicNavigationRevision.create({
    data: {
      publicNavigationId: rootId,
      revisionNumber: (last?.revisionNumber ?? 0) + 1,
      basedOnRevisionId: source.id,
      createdById: actorId,
      items: {
        create: source.items.map((item) => ({
          itemKey: item.itemKey,
          location: item.location,
          itemType: item.itemType,
          parentItemKey: item.parentItemKey,
          siblingOrder: item.siblingOrder,
          labelAr: item.labelAr,
          labelEn: item.labelEn,
          systemRouteKey: item.systemRouteKey,
          contentTargetKind: item.contentTargetKind,
          contentTargetId: item.contentTargetId,
          externalUrl: item.externalUrl,
        })),
      },
    },
  });
  await tx.publicNavigation.update({
    where: { id: rootId },
    data: { activeRevisionId: revision.id },
  });
  return loadSnapshot(tx, revision.id);
}

async function active(tx: Transaction, rootId: string) {
  const root = await lockedRoot(tx, rootId);
  if (!root.activeRevisionId) {
    throw new PublicNavigationError("NO_ACTIVE_REVISION");
  }
  const revision = await loadSnapshot(tx, root.activeRevisionId);
  if (revision.publicNavigationId !== rootId) {
    throw new PublicNavigationError("NO_ACTIVE_REVISION");
  }
  return { root, revision };
}

async function openEditingRevision(
  tx: Transaction,
  rootId: string,
  actorId: string,
) {
  const revision = await tx.publicNavigationRevision.create({
    data: {
      publicNavigationId: rootId,
      revisionNumber: 1,
      createdById: actorId,
    },
  });
  await tx.publicNavigation.update({
    where: { id: rootId },
    data: { activeRevisionId: revision.id },
  });
  return revision;
}

async function ensureRoot(tx: Transaction, actorId: string | null) {
  let root = await tx.publicNavigation.findUnique({
    where: { singletonKey: PUBLIC_NAVIGATION_SINGLETON_KEY },
  });
  if (!root) {
    root = await tx.publicNavigation.create({
      data: { singletonKey: PUBLIC_NAVIGATION_SINGLETON_KEY },
    });
  }
  if (!root.activeRevisionId) {
    const count = await tx.publicNavigationRevision.count({
      where: { publicNavigationId: root.id },
    });
    if (count === 0 && actorId) {
      await openEditingRevision(tx, root.id, actorId);
      root = await tx.publicNavigation.findUniqueOrThrow({
        where: { id: root.id },
      });
    }
  }
  return root;
}

async function completeSnapshot(revision: Snapshot, database: Database) {
  const draft = validateNavigationDraft(snapshotToDraft(revision), true);
  try {
    await assertPublishableNavigationTargets(draft, database);
  } catch {
    throw new PublicNavigationError("UNAVAILABLE_TARGET");
  }
  return draft;
}

async function transition(
  tx: Transaction,
  revision: Snapshot,
  actorId: string,
  toStatus: "PENDING_REVIEW" | "APPROVED" | "RETURNED",
  action: "SUBMIT" | "APPROVE" | "RETURN",
  comment?: string,
) {
  await tx.publicNavigationRevision.update({
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
  await tx.publicNavigationWorkflowEvent.create({
    data: {
      publicNavigationId: revision.publicNavigationId,
      revisionId: revision.id,
      fromStatus: revision.workflowStatus,
      toStatus,
      action,
      actorId,
      comment,
    },
  });
}

function runtimeDatabaseOrNull(database?: Database): Database | null {
  if (database) return database;
  if (!getServerConfig().databaseUrl) return null;
  return getRuntimeDatabase();
}

export async function getEditorialPublicNavigation(
  actorId: string,
  database: Database = getRuntimeDatabase(),
): Promise<EditorialPublicNavigation> {
  await requireActorPermission(actorId, PERMISSIONS.NAVIGATION_READ);
  await database.prisma.$transaction(async (tx) => {
    const row = await ensureRoot(tx, actorId);
    if (!row.activeRevisionId) {
      const count = await tx.publicNavigationRevision.count({
        where: { publicNavigationId: row.id },
      });
      if (count === 0) {
        await openEditingRevision(tx, row.id, actorId);
      }
    }
  });
  const root = await loadEditorialRoot(database.prisma);
  const activeRevision = root.activeRevision
    ? {
        id: root.activeRevision.id,
        revisionNumber: root.activeRevision.revisionNumber,
        workflowStatus: root.activeRevision.workflowStatus,
        editVersion: root.activeRevision.editVersion,
        submittedById: root.activeRevision.submittedById,
        draft: snapshotToDraft(root.activeRevision),
      }
    : null;
  return {
    id: root.id,
    publicationStatus: root.publicationStatus,
    publishedAt: root.publishedAt,
    liveRevisionId: root.liveRevisionId,
    liveRevisionNumber: root.liveRevision?.revisionNumber ?? null,
    active: activeRevision,
    revisions: root.revisions.map((row) => ({
      id: row.id,
      revisionNumber: row.revisionNumber,
      workflowStatus: row.workflowStatus,
      createdAt: row.createdAt,
    })),
    workflowEvents: root.workflowEvents.map((row) => ({
      action: row.action,
      comment: row.comment,
      createdAt: row.createdAt,
    })),
    publicationEvents: root.publicationEvents.map((row) => ({
      action: row.action,
      reason: row.reason,
      createdAt: row.createdAt,
    })),
  };
}

export async function savePublicNavigationDraft(
  actorId: string,
  expectedVersion: number,
  input: unknown,
  database: Database = getRuntimeDatabase(),
) {
  const draft = validateNavigationDraft(input);
  await requireActorPermission(actorId, PERMISSIONS.NAVIGATION_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, actorId);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "EDITING") {
      throw new PublicNavigationError("INVALID_WORKFLOW_STATE");
    }
    if (revision.editVersion !== expectedVersion) {
      throw new PublicNavigationError("CONCURRENT_MODIFICATION");
    }
    const changed = await tx.publicNavigationRevision.updateMany({
      where: {
        id: revision.id,
        workflowStatus: "EDITING",
        editVersion: expectedVersion,
      },
      data: { editVersion: { increment: 1 } },
    });
    if (!changed.count) {
      throw new PublicNavigationError("CONCURRENT_MODIFICATION");
    }
    await writeDraft(tx, revision.id, draft);
    return { revisionId: revision.id, editVersion: expectedVersion + 1 };
  });
}

export async function submitPublicNavigation(
  actorId: string,
  expectedVersion: number,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NAVIGATION_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, actorId);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "EDITING") {
      throw new PublicNavigationError("INVALID_WORKFLOW_STATE");
    }
    if (revision.editVersion !== expectedVersion) {
      throw new PublicNavigationError("CONCURRENT_MODIFICATION");
    }
    await completeSnapshot(revision, database);
    await transition(tx, revision, actorId, "PENDING_REVIEW", "SUBMIT");
    return revision.id;
  });
}

export async function approvePublicNavigation(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NAVIGATION_REVIEW);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, null);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "PENDING_REVIEW") {
      throw new PublicNavigationError("INVALID_WORKFLOW_STATE");
    }
    if (revision.submittedById === actorId) {
      throw new PublicNavigationError("SELF_APPROVAL_FORBIDDEN");
    }
    await completeSnapshot(revision, database);
    await transition(tx, revision, actorId, "APPROVED", "APPROVE");
    return revision.id;
  });
}

export async function returnPublicNavigation(
  actorId: string,
  comment: string,
  database: Database = getRuntimeDatabase(),
) {
  if (!comment?.trim()) {
    throw new PublicNavigationError("RETURN_COMMENT_REQUIRED");
  }
  await requireActorPermission(actorId, PERMISSIONS.NAVIGATION_REVIEW);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, null);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "PENDING_REVIEW") {
      throw new PublicNavigationError("INVALID_WORKFLOW_STATE");
    }
    await transition(
      tx,
      revision,
      actorId,
      "RETURNED",
      "RETURN",
      comment.trim(),
    );
    return cloneRevision(tx, root.id, revision, actorId);
  });
}

export async function startEditingPublicNavigation(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NAVIGATION_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await lockedRoot(tx, (await ensureRoot(tx, actorId)).id);
    if (root.activeRevisionId) {
      throw new PublicNavigationError("ACTIVE_REVISION_EXISTS");
    }
    let source: Snapshot | null = null;
    if (root.liveRevisionId) {
      source = await loadSnapshot(tx, root.liveRevisionId);
    } else {
      const latest = await tx.publicNavigationRevision.findFirst({
        where: { publicNavigationId: root.id },
        orderBy: { revisionNumber: "desc" },
      });
      if (latest) source = await loadSnapshot(tx, latest.id);
    }
    if (!source) throw new PublicNavigationError("NOT_FOUND");
    return cloneRevision(tx, root.id, source, actorId);
  });
}

export async function restorePublicNavigationRevision(
  actorId: string,
  sourceRevisionId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NAVIGATION_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await lockedRoot(tx, (await ensureRoot(tx, actorId)).id);
    if (root.activeRevisionId) {
      const current = await tx.publicNavigationRevision.findUnique({
        where: { id: root.activeRevisionId },
      });
      if (current?.workflowStatus === "EDITING") {
        throw new PublicNavigationError("ACTIVE_EDITING_EXISTS");
      }
      if (current?.workflowStatus === "PENDING_REVIEW") {
        throw new PublicNavigationError("ACTIVE_REVISION_EXISTS");
      }
    }
    const source = await loadSnapshot(tx, sourceRevisionId);
    if (source.publicNavigationId !== root.id) {
      throw new PublicNavigationError("REVISION_NOT_FOUND");
    }
    const draft = await cloneRevision(tx, root.id, source, actorId);
    await tx.publicNavigationWorkflowEvent.create({
      data: {
        publicNavigationId: root.id,
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

export async function publishPublicNavigation(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NAVIGATION_PUBLISH);
  return database.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${PUBLISH_LOCK})::text`;
    const root = await ensureRoot(tx, null);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "APPROVED") {
      throw new PublicNavigationError("INVALID_WORKFLOW_STATE");
    }
    await completeSnapshot(revision, database);
    await tx.publicNavigation.update({
      where: { id: root.id },
      data: {
        liveRevisionId: revision.id,
        activeRevisionId: null,
        publicationStatus: "PUBLISHED",
        publishedAt: new Date(),
        unpublishedAt: null,
      },
    });
    await tx.publicNavigationPublicationEvent.create({
      data: {
        publicNavigationId: root.id,
        revisionId: revision.id,
        action: "PUBLISH",
        actorId,
      },
    });
    return revision.id;
  });
}

export async function unpublishPublicNavigation(
  actorId: string,
  reason: string,
  database: Database = getRuntimeDatabase(),
) {
  if (!reason?.trim()) {
    throw new PublicNavigationError("UNPUBLISH_REASON_REQUIRED");
  }
  await requireActorPermission(actorId, PERMISSIONS.NAVIGATION_PUBLISH);
  return database.prisma.$transaction(async (tx) => {
    const root = await lockedRoot(tx, (await ensureRoot(tx, null)).id);
    if (root.publicationStatus !== "PUBLISHED" || !root.liveRevisionId) {
      throw new PublicNavigationError("INVALID_WORKFLOW_STATE");
    }
    const liveRevisionId = root.liveRevisionId;
    await tx.publicNavigation.update({
      where: { id: root.id },
      data: {
        publicationStatus: "UNPUBLISHED",
        liveRevisionId: null,
        unpublishedAt: new Date(),
      },
    });
    await tx.publicNavigationPublicationEvent.create({
      data: {
        publicNavigationId: root.id,
        revisionId: liveRevisionId,
        action: "UNPUBLISH",
        reason: reason.trim(),
        actorId,
      },
    });
  });
}

export async function loadNavigationRevisionDraft(
  revisionId: string,
  database: Database = getRuntimeDatabase(),
): Promise<NavigationDraft | null> {
  const revision = await database.prisma.publicNavigationRevision.findUnique({
    where: { id: revisionId },
  });
  if (!revision) return null;
  const snapshotRow = await loadSnapshot(database.prisma, revisionId);
  return snapshotToDraft(snapshotRow);
}

export async function resolveLiveNavigationDraft(
  database?: Database,
): Promise<NavigationDraft | null> {
  const db = runtimeDatabaseOrNull(database);
  if (!db) return null;
  try {
    const root = await db.prisma.publicNavigation.findUnique({
      where: { singletonKey: PUBLIC_NAVIGATION_SINGLETON_KEY },
    });
    if (
      !root ||
      root.publicationStatus !== "PUBLISHED" ||
      !root.liveRevisionId
    ) {
      return null;
    }
    return loadNavigationRevisionDraft(root.liveRevisionId, db);
  } catch {
    return null;
  }
}

export async function resolveNavigationPreview(
  actorId: string,
  revisionId: string,
  locale: "ar" | "en",
  database: Database = getRuntimeDatabase(),
): Promise<NavigationPreview | null> {
  await requireActorPermission(actorId, PERMISSIONS.NAVIGATION_READ);
  const revision = await database.prisma.publicNavigationRevision.findUnique({
    where: { id: revisionId },
  });
  if (!revision) return null;
  const snapshotRow = await loadSnapshot(database.prisma, revisionId);
  let incomplete = false;
  try {
    await completeSnapshot(snapshotRow, database);
  } catch {
    incomplete = true;
  }
  return { revisionId, locale, incomplete };
}

export type NavigationContentTargetUsage = {
  liveReferenceCount: number;
  draftReferenceCount: number;
};

/** Dependency inspection for content targets (Navigation-owned). */
export async function inspectNavigationContentTargetUsage(
  targetKind: "MANAGED_PAGE",
  targetId: string,
  database: Database = getRuntimeDatabase(),
): Promise<NavigationContentTargetUsage> {
  const root = await database.prisma.publicNavigation.findUnique({
    where: { singletonKey: PUBLIC_NAVIGATION_SINGLETON_KEY },
  });
  if (!root) return { liveReferenceCount: 0, draftReferenceCount: 0 };
  const revisionIds = new Set<string>();
  if (root.liveRevisionId) revisionIds.add(root.liveRevisionId);
  if (root.activeRevisionId) revisionIds.add(root.activeRevisionId);
  if (!revisionIds.size) {
    return { liveReferenceCount: 0, draftReferenceCount: 0 };
  }
  const rows = await database.prisma.publicNavigationItem.findMany({
    where: {
      revisionId: { in: [...revisionIds] },
      contentTargetKind: "MANAGED_PAGE",
      contentTargetId: targetId,
    },
    select: { revisionId: true },
  });
  let liveReferenceCount = 0;
  let draftReferenceCount = 0;
  for (const row of rows) {
    if (row.revisionId === root.liveRevisionId) liveReferenceCount += 1;
    if (row.revisionId === root.activeRevisionId) draftReferenceCount += 1;
  }
  return { liveReferenceCount, draftReferenceCount };
}

export { emptyNavigationDraft, validateNavigationDraft };
