import "server-only";

import { PERMISSIONS, requireActorPermission } from "@/modules/identity";
import type { Database } from "@/platform/database";
import {
  Prisma,
  type PrismaClient,
} from "@/platform/database/generated/client";
import { getRuntimeDatabase } from "@/platform/runtime";

import {
  validateSiteSettingsDraft,
  type SiteSettingsDraft,
  type SiteSettingsLocale,
} from "../domain/draft";
import { SiteSettingsError } from "../domain/errors";
import { SITE_SETTINGS_SINGLETON_KEY } from "../domain/singleton";

type Transaction = Prisma.TransactionClient;
type DbClient = Transaction | PrismaClient;
type Snapshot = Prisma.SiteSettingsRevisionGetPayload<{
  include: {
    translations: true;
    socialLinks: { orderBy: { position: "asc" } };
  };
}>;

/** Interactive transactions bind one pg client — relation includes must not overlap. */
async function loadSnapshot(client: DbClient, id: string): Promise<Snapshot> {
  const revision = await client.siteSettingsRevision.findUniqueOrThrow({
    where: { id },
  });
  const translations = await client.siteSettingsRevisionTranslation.findMany({
    where: { revisionId: id },
  });
  const socialLinks = await client.siteSettingsSocialLink.findMany({
    where: { revisionId: id },
    orderBy: { position: "asc" },
  });
  return { ...revision, translations, socialLinks };
}

async function loadEditorialRoot(client: DbClient) {
  const root = await client.siteSettings.findUniqueOrThrow({
    where: { singletonKey: SITE_SETTINGS_SINGLETON_KEY },
  });
  const revisions = await client.siteSettingsRevision.findMany({
    where: { siteSettingsId: root.id },
    orderBy: { revisionNumber: "desc" },
  });
  const workflowEvents = await client.siteSettingsWorkflowEvent.findMany({
    where: { siteSettingsId: root.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const publicationEvents = await client.siteSettingsPublicationEvent.findMany({
    where: { siteSettingsId: root.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const activeRevision = root.activeRevisionId
    ? await loadSnapshot(client, root.activeRevisionId)
    : null;
  const liveRevision = root.liveRevisionId
    ? await client.siteSettingsRevision.findUnique({
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

const PUBLISH_LOCK = 90915;

export type EditorialSiteSettings = {
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
    draft: SiteSettingsDraft;
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

export type PublicSiteSettingsShell = {
  officialName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  socialLinks: { label: string; href: string }[];
  defaultSeoTitle: string | null;
  defaultSeoDescription: string | null;
};

export type SiteSettingsPreview = {
  revisionId: string;
  locale: SiteSettingsLocale;
  incomplete: boolean;
  shell: PublicSiteSettingsShell;
};

function shellTranslations() {
  return [
    { locale: "ar", officialName: "" },
    { locale: "en", officialName: "" },
  ];
}

function snapshotToDraft(revision: Snapshot): SiteSettingsDraft {
  const translations = {
    ar: {
      officialName: "",
      address: "",
      defaultSeoTitle: "",
      defaultSeoDescription: "",
    },
    en: {
      officialName: "",
      address: "",
      defaultSeoTitle: "",
      defaultSeoDescription: "",
    },
  };
  for (const row of revision.translations) {
    const locale = row.locale === "en" ? "en" : "ar";
    translations[locale] = {
      officialName: row.officialName,
      address: row.address ?? "",
      defaultSeoTitle: row.defaultSeoTitle ?? "",
      defaultSeoDescription: row.defaultSeoDescription ?? "",
    };
  }
  return validateSiteSettingsDraft({
    contactEmail: revision.contactEmail ?? "",
    contactPhone: revision.contactPhone ?? "",
    translations,
    socialLinks: revision.socialLinks.map((link) => ({
      itemKey: link.itemKey,
      labelAr: link.labelAr,
      labelEn: link.labelEn,
      url: link.url,
      position: link.position,
    })),
  });
}

async function lockedRoot(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM "site_settings"."site_settings" WHERE id = ${id}::uuid FOR UPDATE`;
  const root = await tx.siteSettings.findUnique({ where: { id } });
  if (!root) throw new SiteSettingsError("NOT_FOUND");
  return root;
}

async function writeDraft(
  tx: Transaction,
  revisionId: string,
  draft: SiteSettingsDraft,
) {
  await tx.siteSettingsRevision.update({
    where: { id: revisionId },
    data: {
      contactEmail: draft.contactEmail.trim() || null,
      contactPhone: draft.contactPhone.trim() || null,
    },
  });
  for (const locale of ["ar", "en"] as const) {
    const row = draft.translations[locale];
    await tx.siteSettingsRevisionTranslation.upsert({
      where: { revisionId_locale: { revisionId, locale } },
      create: {
        revisionId,
        locale,
        officialName: row.officialName,
        address: row.address.trim() || null,
        defaultSeoTitle: row.defaultSeoTitle.trim() || null,
        defaultSeoDescription: row.defaultSeoDescription.trim() || null,
      },
      update: {
        officialName: row.officialName,
        address: row.address.trim() || null,
        defaultSeoTitle: row.defaultSeoTitle.trim() || null,
        defaultSeoDescription: row.defaultSeoDescription.trim() || null,
      },
    });
  }
  await tx.siteSettingsSocialLink.deleteMany({ where: { revisionId } });
  if (draft.socialLinks.length) {
    await tx.siteSettingsSocialLink.createMany({
      data: draft.socialLinks.map((link) => ({
        revisionId,
        itemKey: link.itemKey,
        labelAr: link.labelAr,
        labelEn: link.labelEn,
        url: link.url,
        position: link.position,
      })),
    });
  }
}

async function cloneRevision(
  tx: Transaction,
  rootId: string,
  source: Snapshot,
  actorId: string,
) {
  const last = await tx.siteSettingsRevision.findFirst({
    where: { siteSettingsId: rootId },
    orderBy: { revisionNumber: "desc" },
  });
  const revision = await tx.siteSettingsRevision.create({
    data: {
      siteSettingsId: rootId,
      revisionNumber: (last?.revisionNumber ?? 0) + 1,
      basedOnRevisionId: source.id,
      createdById: actorId,
      contactEmail: source.contactEmail,
      contactPhone: source.contactPhone,
      translations: {
        create: source.translations.map((row) => ({
          locale: row.locale,
          officialName: row.officialName,
          address: row.address,
          defaultSeoTitle: row.defaultSeoTitle,
          defaultSeoDescription: row.defaultSeoDescription,
        })),
      },
      socialLinks: {
        create: source.socialLinks.map((link) => ({
          itemKey: link.itemKey,
          labelAr: link.labelAr,
          labelEn: link.labelEn,
          url: link.url,
          position: link.position,
        })),
      },
    },
  });
  await tx.siteSettings.update({
    where: { id: rootId },
    data: { activeRevisionId: revision.id },
  });
  return loadSnapshot(tx, revision.id);
}

async function active(tx: Transaction, rootId: string) {
  const root = await lockedRoot(tx, rootId);
  if (!root.activeRevisionId) throw new SiteSettingsError("NO_ACTIVE_REVISION");
  const revision = await loadSnapshot(tx, root.activeRevisionId);
  if (revision.siteSettingsId !== rootId) {
    throw new SiteSettingsError("NO_ACTIVE_REVISION");
  }
  return { root, revision };
}

async function openEditingRevision(
  tx: Transaction,
  rootId: string,
  actorId: string,
) {
  const revision = await tx.siteSettingsRevision.create({
    data: {
      siteSettingsId: rootId,
      revisionNumber: 1,
      createdById: actorId,
      translations: { create: shellTranslations() },
    },
  });
  await tx.siteSettings.update({
    where: { id: rootId },
    data: { activeRevisionId: revision.id },
  });
  return revision;
}

async function ensureRoot(tx: Transaction, actorId: string | null) {
  let root = await tx.siteSettings.findUnique({
    where: { singletonKey: SITE_SETTINGS_SINGLETON_KEY },
  });
  if (!root) {
    root = await tx.siteSettings.create({
      data: { singletonKey: SITE_SETTINGS_SINGLETON_KEY },
    });
  }
  if (!root.activeRevisionId) {
    const count = await tx.siteSettingsRevision.count({
      where: { siteSettingsId: root.id },
    });
    if (count === 0 && actorId) {
      await openEditingRevision(tx, root.id, actorId);
      root = await tx.siteSettings.findUniqueOrThrow({
        where: { id: root.id },
      });
    }
  }
  return root;
}

function shellFromSnapshot(
  revision: Snapshot,
  locale: SiteSettingsLocale,
): PublicSiteSettingsShell {
  const translation = revision.translations.find(
    (row) => row.locale === locale,
  );
  const officialName = translation?.officialName.trim() ?? "";
  return {
    officialName,
    contactEmail: revision.contactEmail?.trim() || null,
    contactPhone: revision.contactPhone?.trim() || null,
    address: translation?.address?.trim() || null,
    socialLinks: revision.socialLinks
      .filter((link) => link.url.trim())
      .map((link) => ({
        label: locale === "en" ? link.labelEn : link.labelAr,
        href: link.url,
      })),
    defaultSeoTitle: translation?.defaultSeoTitle?.trim() || null,
    defaultSeoDescription: translation?.defaultSeoDescription?.trim() || null,
  };
}

async function completeSnapshot(revision: Snapshot) {
  return validateSiteSettingsDraft(snapshotToDraft(revision), true);
}

async function transition(
  tx: Transaction,
  revision: Snapshot,
  actorId: string,
  toStatus: "PENDING_REVIEW" | "APPROVED" | "RETURNED",
  action: "SUBMIT" | "APPROVE" | "RETURN",
  comment?: string,
) {
  await tx.siteSettingsRevision.update({
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
  await tx.siteSettingsWorkflowEvent.create({
    data: {
      siteSettingsId: revision.siteSettingsId,
      revisionId: revision.id,
      fromStatus: revision.workflowStatus,
      toStatus,
      action,
      actorId,
      comment,
    },
  });
}

export async function getEditorialSiteSettings(
  actorId: string,
  database: Database = getRuntimeDatabase(),
): Promise<EditorialSiteSettings> {
  await requireActorPermission(actorId, PERMISSIONS.SITE_SETTINGS_READ);
  await database.prisma.$transaction(async (tx) => {
    const row = await ensureRoot(tx, actorId);
    if (!row.activeRevisionId) {
      const count = await tx.siteSettingsRevision.count({
        where: { siteSettingsId: row.id },
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

export async function saveSiteSettingsDraft(
  actorId: string,
  expectedVersion: number,
  input: unknown,
  database: Database = getRuntimeDatabase(),
) {
  const draft = validateSiteSettingsDraft(input);
  await requireActorPermission(actorId, PERMISSIONS.SITE_SETTINGS_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, actorId);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "EDITING") {
      throw new SiteSettingsError("INVALID_WORKFLOW_STATE");
    }
    if (revision.editVersion !== expectedVersion) {
      throw new SiteSettingsError("CONCURRENT_MODIFICATION");
    }
    const changed = await tx.siteSettingsRevision.updateMany({
      where: {
        id: revision.id,
        workflowStatus: "EDITING",
        editVersion: expectedVersion,
      },
      data: { editVersion: { increment: 1 } },
    });
    if (!changed.count) throw new SiteSettingsError("CONCURRENT_MODIFICATION");
    await writeDraft(tx, revision.id, draft);
    return { revisionId: revision.id, editVersion: expectedVersion + 1 };
  });
}

export async function submitSiteSettings(
  actorId: string,
  expectedVersion: number,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.SITE_SETTINGS_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, actorId);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "EDITING") {
      throw new SiteSettingsError("INVALID_WORKFLOW_STATE");
    }
    if (revision.editVersion !== expectedVersion) {
      throw new SiteSettingsError("CONCURRENT_MODIFICATION");
    }
    await completeSnapshot(revision);
    await transition(tx, revision, actorId, "PENDING_REVIEW", "SUBMIT");
    return revision.id;
  });
}

export async function approveSiteSettings(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.SITE_SETTINGS_REVIEW);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, null);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "PENDING_REVIEW") {
      throw new SiteSettingsError("INVALID_WORKFLOW_STATE");
    }
    if (revision.submittedById === actorId) {
      throw new SiteSettingsError("SELF_APPROVAL_FORBIDDEN");
    }
    await completeSnapshot(revision);
    await transition(tx, revision, actorId, "APPROVED", "APPROVE");
    return revision.id;
  });
}

export async function returnSiteSettings(
  actorId: string,
  comment: string,
  database: Database = getRuntimeDatabase(),
) {
  if (!comment?.trim()) throw new SiteSettingsError("RETURN_COMMENT_REQUIRED");
  await requireActorPermission(actorId, PERMISSIONS.SITE_SETTINGS_REVIEW);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, null);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "PENDING_REVIEW") {
      throw new SiteSettingsError("INVALID_WORKFLOW_STATE");
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

export async function startEditingSiteSettings(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.SITE_SETTINGS_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await lockedRoot(tx, (await ensureRoot(tx, actorId)).id);
    if (root.activeRevisionId) {
      throw new SiteSettingsError("ACTIVE_REVISION_EXISTS");
    }
    let source: Snapshot | null = null;
    if (root.liveRevisionId) {
      source = await loadSnapshot(tx, root.liveRevisionId);
    } else {
      const latest = await tx.siteSettingsRevision.findFirst({
        where: { siteSettingsId: root.id },
        orderBy: { revisionNumber: "desc" },
      });
      if (latest) source = await loadSnapshot(tx, latest.id);
    }
    if (!source) throw new SiteSettingsError("NOT_FOUND");
    return cloneRevision(tx, root.id, source, actorId);
  });
}

export async function restoreSiteSettingsRevision(
  actorId: string,
  sourceRevisionId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.SITE_SETTINGS_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await lockedRoot(tx, (await ensureRoot(tx, actorId)).id);
    if (root.activeRevisionId) {
      const current = await tx.siteSettingsRevision.findUnique({
        where: { id: root.activeRevisionId },
      });
      if (current?.workflowStatus === "EDITING") {
        throw new SiteSettingsError("ACTIVE_EDITING_EXISTS");
      }
      if (current?.workflowStatus === "PENDING_REVIEW") {
        throw new SiteSettingsError("ACTIVE_REVISION_EXISTS");
      }
    }
    const source = await loadSnapshot(tx, sourceRevisionId);
    if (source.siteSettingsId !== root.id) {
      throw new SiteSettingsError("REVISION_NOT_FOUND");
    }
    const draft = await cloneRevision(tx, root.id, source, actorId);
    await tx.siteSettingsWorkflowEvent.create({
      data: {
        siteSettingsId: root.id,
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

export async function publishSiteSettings(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.SITE_SETTINGS_PUBLISH);
  return database.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${PUBLISH_LOCK})::text`;
    const root = await ensureRoot(tx, null);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "APPROVED") {
      throw new SiteSettingsError("INVALID_WORKFLOW_STATE");
    }
    await completeSnapshot(revision);
    await tx.siteSettings.update({
      where: { id: root.id },
      data: {
        liveRevisionId: revision.id,
        activeRevisionId: null,
        publicationStatus: "PUBLISHED",
        publishedAt: new Date(),
        unpublishedAt: null,
      },
    });
    await tx.siteSettingsPublicationEvent.create({
      data: {
        siteSettingsId: root.id,
        revisionId: revision.id,
        action: "PUBLISH",
        actorId,
      },
    });
    return revision.id;
  });
}

export async function unpublishSiteSettings(
  actorId: string,
  reason: string,
  database: Database = getRuntimeDatabase(),
) {
  if (!reason?.trim()) {
    throw new SiteSettingsError("UNPUBLISH_REASON_REQUIRED");
  }
  await requireActorPermission(actorId, PERMISSIONS.SITE_SETTINGS_PUBLISH);
  return database.prisma.$transaction(async (tx) => {
    const root = await lockedRoot(tx, (await ensureRoot(tx, null)).id);
    if (root.publicationStatus !== "PUBLISHED" || !root.liveRevisionId) {
      throw new SiteSettingsError("INVALID_WORKFLOW_STATE");
    }
    const liveRevisionId = root.liveRevisionId;
    await tx.siteSettings.update({
      where: { id: root.id },
      data: {
        publicationStatus: "UNPUBLISHED",
        liveRevisionId: null,
        unpublishedAt: new Date(),
      },
    });
    await tx.siteSettingsPublicationEvent.create({
      data: {
        siteSettingsId: root.id,
        revisionId: liveRevisionId,
        action: "UNPUBLISH",
        reason: reason.trim(),
        actorId,
      },
    });
  });
}

export async function resolveLivePublicSiteSettings(
  locale: SiteSettingsLocale,
  database: Database = getRuntimeDatabase(),
): Promise<PublicSiteSettingsShell | null> {
  const root = await database.prisma.siteSettings.findUnique({
    where: { singletonKey: SITE_SETTINGS_SINGLETON_KEY },
  });
  if (!root || root.publicationStatus !== "PUBLISHED" || !root.liveRevisionId) {
    return null;
  }
  const liveRevision = await loadSnapshot(database.prisma, root.liveRevisionId);
  return shellFromSnapshot(liveRevision, locale);
}

export async function resolveLiveDefaultSeo(
  locale: SiteSettingsLocale,
  database: Database = getRuntimeDatabase(),
): Promise<{ title: string | null; description: string | null } | null> {
  const live = await resolveLivePublicSiteSettings(locale, database);
  if (!live) return null;
  return {
    title: live.defaultSeoTitle,
    description: live.defaultSeoDescription,
  };
}

export async function resolveSiteSettingsPreview(
  actorId: string,
  revisionId: string,
  locale: SiteSettingsLocale,
  database: Database = getRuntimeDatabase(),
): Promise<SiteSettingsPreview | null> {
  await requireActorPermission(actorId, PERMISSIONS.SITE_SETTINGS_READ);
  const revision = await database.prisma.siteSettingsRevision.findUnique({
    where: { id: revisionId },
  });
  if (!revision) return null;
  const snapshotRow = await loadSnapshot(database.prisma, revisionId);
  const shell = shellFromSnapshot(snapshotRow, locale);
  let incomplete = false;
  try {
    await completeSnapshot(snapshotRow);
  } catch {
    incomplete = true;
  }
  return { revisionId, locale, incomplete, shell };
}

export function composePublicSeoTitle(options: {
  explicitTitle?: string | null;
  pageTitle?: string | null;
  liveDefaultTitle?: string | null;
  staticFallback: string;
}): string {
  const explicit = options.explicitTitle?.trim();
  if (explicit) return explicit;
  const page = options.pageTitle?.trim();
  if (page) return page;
  const live = options.liveDefaultTitle?.trim();
  if (live) return live;
  return options.staticFallback;
}

export function composePublicSeoDescription(options: {
  explicitDescription?: string | null;
  pageDescription?: string | null;
  liveDefaultDescription?: string | null;
}): string | undefined {
  const explicit = options.explicitDescription?.trim();
  if (explicit) return explicit;
  const page = options.pageDescription?.trim();
  if (page) return page;
  const live = options.liveDefaultDescription?.trim();
  return live || undefined;
}
