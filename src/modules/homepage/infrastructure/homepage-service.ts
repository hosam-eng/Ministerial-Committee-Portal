import "server-only";

import { PERMISSIONS, requireActorPermission } from "@/modules/identity";
import {
  listLatestPublishedNews,
  resolvePublishedNewsByIds,
  type NewsLocale,
  type PublicNews,
} from "@/modules/publishing";
import type { Database } from "@/platform/database";
import {
  Prisma,
  type PrismaClient,
} from "@/platform/database/generated/client";
import { getServerConfig } from "@/platform/config/server";
import { getRuntimeDatabase } from "@/platform/runtime";

import {
  emptyHomepageDraft,
  emptyHomepageHeroDraft,
  emptyHomepageNewsDraft,
  validateHomepageDraft,
  type HomepageDraft,
  type HomepageHeroDraft,
  type HomepageNewsDraft,
  type HomepageSectionDraft,
} from "../domain/draft";
import { HomepageError } from "../domain/errors";
import type {
  PublicHomepage,
  PublicHomepageNewsItem,
  PublicHomepageSection,
} from "../domain/public-view";
import { HOMEPAGE_SINGLETON_KEY } from "../domain/singleton";
import { collectHomepageCompletenessIssues } from "../domain/completeness";
import { validateHomepageHeroCta } from "../domain/hero-cta";
import { resolveHomepageHeroCta } from "./hero-cta-resolver";
import { assertPublishableHomepageDraft } from "./publish-validation";

type Transaction = Prisma.TransactionClient;
type DbClient = Transaction | PrismaClient;

type SectionRow = Prisma.HomepageSectionGetPayload<{
  include: {
    hero: { include: { translations: true } };
    news: {
      include: {
        translations: true;
        manualItems: { orderBy: { position: "asc" } };
      };
    };
  };
}>;

type Snapshot = Prisma.HomepageRevisionGetPayload<object> & {
  sections: SectionRow[];
};

async function loadSnapshot(client: DbClient, id: string): Promise<Snapshot> {
  const revision = await client.homepageRevision.findUniqueOrThrow({
    where: { id },
  });
  const sections = await client.homepageSection.findMany({
    where: { revisionId: id },
    orderBy: { position: "asc" },
    include: {
      hero: { include: { translations: true } },
      news: {
        include: {
          translations: true,
          manualItems: { orderBy: { position: "asc" } },
        },
      },
    },
  });
  return { ...revision, sections };
}

async function loadEditorialRoot(client: DbClient) {
  const root = await client.homepage.findUniqueOrThrow({
    where: { singletonKey: HOMEPAGE_SINGLETON_KEY },
  });
  const revisions = await client.homepageRevision.findMany({
    where: { homepageId: root.id },
    orderBy: { revisionNumber: "desc" },
  });
  const workflowEvents = await client.homepageWorkflowEvent.findMany({
    where: { homepageId: root.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const publicationEvents = await client.homepagePublicationEvent.findMany({
    where: { homepageId: root.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const activeRevision = root.activeRevisionId
    ? await loadSnapshot(client, root.activeRevisionId)
    : null;
  const liveRevision = root.liveRevisionId
    ? await client.homepageRevision.findUnique({
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

const PUBLISH_LOCK = 90917;

export type EditorialHomepage = {
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
    draft: HomepageDraft;
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

export type HomepagePreview = {
  revisionId: string;
  locale: "ar" | "en";
  incomplete: boolean;
  incompleteIssueKeys: string[];
};

function heroFromRow(row: NonNullable<SectionRow["hero"]>): HomepageHeroDraft {
  const translations = emptyHomepageHeroDraft().translations;
  for (const item of row.translations) {
    const locale = item.locale === "en" ? "en" : "ar";
    translations[locale] = {
      title: item.title,
      supportingText: item.supportingText,
      ctaLabel: item.ctaLabel,
    };
  }
  return {
    ctaEnabled: row.ctaEnabled,
    ctaTargetType: row.ctaTargetType ?? "",
    systemRouteKey: row.systemRouteKey ?? "",
    contentTargetKind: row.contentTargetKind ?? "",
    contentTargetId: row.contentTargetId ?? "",
    externalUrl: row.externalUrl ?? "",
    translations,
  };
}

function newsFromRow(row: NonNullable<SectionRow["news"]>): HomepageNewsDraft {
  const translations = emptyHomepageNewsDraft().translations;
  for (const item of row.translations) {
    const locale = item.locale === "en" ? "en" : "ar";
    translations[locale] = { sectionHeading: item.sectionHeading };
  }
  return {
    mode: row.mode,
    manualNewsIds: row.manualItems.map((item) => item.newsId),
    translations,
  };
}

function sectionToDraft(row: SectionRow): HomepageSectionDraft {
  if (row.sectionType === "HERO") {
    return {
      sectionType: "HERO",
      position: row.position,
      enabled: row.enabled,
      hero: row.hero ? heroFromRow(row.hero) : emptyHomepageHeroDraft(),
      news: null,
    };
  }
  return {
    sectionType: "NEWS",
    position: row.position,
    enabled: row.enabled,
    hero: null,
    news: row.news ? newsFromRow(row.news) : emptyHomepageNewsDraft(),
  };
}

function snapshotToDraft(revision: Snapshot): HomepageDraft {
  return validateHomepageDraft({
    sections: revision.sections.map(sectionToDraft),
  });
}

async function lockedRoot(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM "homepage"."homepage" WHERE id = ${id}::uuid FOR UPDATE`;
  const root = await tx.homepage.findUnique({ where: { id } });
  if (!root) throw new HomepageError("NOT_FOUND");
  return root;
}

function defaultSectionsCreate() {
  return [
    {
      sectionType: "HERO" as const,
      position: 0,
      enabled: true,
      hero: {
        create: {
          ctaEnabled: false,
          translations: {
            create: [
              {
                locale: "ar",
                title: "",
                supportingText: "",
                ctaLabel: "",
              },
              {
                locale: "en",
                title: "",
                supportingText: "",
                ctaLabel: "",
              },
            ],
          },
        },
      },
    },
    {
      sectionType: "NEWS" as const,
      position: 1,
      enabled: true,
      news: {
        create: {
          mode: "AUTOMATIC" as const,
          translations: {
            create: [
              { locale: "ar", sectionHeading: "" },
              { locale: "en", sectionHeading: "" },
            ],
          },
        },
      },
    },
  ];
}

async function writeDraft(
  tx: Transaction,
  revisionId: string,
  draft: HomepageDraft,
) {
  await tx.homepageSection.deleteMany({ where: { revisionId } });
  for (const section of draft.sections) {
    if (section.sectionType === "HERO" && section.hero) {
      const validated = validateHomepageHeroCta(section.hero, false);
      const hero = {
        ...validated,
        translations: section.hero.translations,
      };
      await tx.homepageSection.create({
        data: {
          revisionId,
          sectionType: "HERO",
          position: section.position,
          enabled: section.enabled,
          hero: {
            create: {
              ctaEnabled: hero.ctaEnabled,
              ctaTargetType:
                hero.ctaEnabled &&
                hero.ctaTargetType !== "" &&
                hero.ctaTargetType
                  ? hero.ctaTargetType
                  : null,
              systemRouteKey: hero.systemRouteKey.trim() || null,
              contentTargetKind:
                hero.contentTargetKind === "MANAGED_PAGE"
                  ? "MANAGED_PAGE"
                  : null,
              contentTargetId: hero.contentTargetId.trim() || null,
              externalUrl: hero.externalUrl.trim() || null,
              translations: {
                create: (["ar", "en"] as const).map((locale) => ({
                  locale,
                  title: hero.translations[locale].title,
                  supportingText: hero.translations[locale].supportingText,
                  ctaLabel: hero.translations[locale].ctaLabel,
                })),
              },
            },
          },
        },
      });
      continue;
    }
    if (section.sectionType === "NEWS" && section.news) {
      const news =
        section.news.mode === "AUTOMATIC"
          ? { ...section.news, manualNewsIds: [] }
          : section.news;
      await tx.homepageSection.create({
        data: {
          revisionId,
          sectionType: "NEWS",
          position: section.position,
          enabled: section.enabled,
          news: {
            create: {
              mode: news.mode,
              translations: {
                create: (["ar", "en"] as const).map((locale) => ({
                  locale,
                  sectionHeading: news.translations[locale].sectionHeading,
                })),
              },
              ...(news.mode === "MANUAL" && news.manualNewsIds.length
                ? {
                    manualItems: {
                      create: news.manualNewsIds.map((newsId, position) => ({
                        newsId,
                        position,
                      })),
                    },
                  }
                : {}),
            },
          },
        },
      });
    }
  }
}

function cloneSectionData(section: SectionRow) {
  if (section.sectionType === "HERO" && section.hero) {
    return {
      sectionType: "HERO" as const,
      position: section.position,
      enabled: section.enabled,
      hero: {
        create: {
          ctaEnabled: section.hero.ctaEnabled,
          ctaTargetType: section.hero.ctaTargetType,
          systemRouteKey: section.hero.systemRouteKey,
          contentTargetKind: section.hero.contentTargetKind,
          contentTargetId: section.hero.contentTargetId,
          externalUrl: section.hero.externalUrl,
          translations: {
            create: section.hero.translations.map((row) => ({
              locale: row.locale,
              title: row.title,
              supportingText: row.supportingText,
              ctaLabel: row.ctaLabel,
            })),
          },
        },
      },
    };
  }
  if (section.sectionType === "NEWS" && section.news) {
    return {
      sectionType: "NEWS" as const,
      position: section.position,
      enabled: section.enabled,
      news: {
        create: {
          mode: section.news.mode,
          translations: {
            create: section.news.translations.map((row) => ({
              locale: row.locale,
              sectionHeading: row.sectionHeading,
            })),
          },
          manualItems: {
            create: section.news.manualItems.map((item) => ({
              newsId: item.newsId,
              position: item.position,
            })),
          },
        },
      },
    };
  }
  return null;
}

async function cloneRevision(
  tx: Transaction,
  rootId: string,
  source: Snapshot,
  actorId: string,
) {
  const last = await tx.homepageRevision.findFirst({
    where: { homepageId: rootId },
    orderBy: { revisionNumber: "desc" },
  });
  const sectionsCreate = source.sections
    .map(cloneSectionData)
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const revision = await tx.homepageRevision.create({
    data: {
      homepageId: rootId,
      revisionNumber: (last?.revisionNumber ?? 0) + 1,
      basedOnRevisionId: source.id,
      createdById: actorId,
      sections: { create: sectionsCreate },
    },
  });
  await tx.homepage.update({
    where: { id: rootId },
    data: { activeRevisionId: revision.id },
  });
  return loadSnapshot(tx, revision.id);
}

async function active(tx: Transaction, rootId: string) {
  const root = await lockedRoot(tx, rootId);
  if (!root.activeRevisionId) {
    throw new HomepageError("NO_ACTIVE_REVISION");
  }
  const revision = await loadSnapshot(tx, root.activeRevisionId);
  if (revision.homepageId !== rootId) {
    throw new HomepageError("NO_ACTIVE_REVISION");
  }
  return { root, revision };
}

async function openEditingRevision(
  tx: Transaction,
  rootId: string,
  actorId: string,
) {
  const revision = await tx.homepageRevision.create({
    data: {
      homepageId: rootId,
      revisionNumber: 1,
      createdById: actorId,
      sections: { create: defaultSectionsCreate() },
    },
  });
  await tx.homepage.update({
    where: { id: rootId },
    data: { activeRevisionId: revision.id },
  });
  return revision;
}

async function ensureRoot(tx: Transaction, actorId: string | null) {
  let root = await tx.homepage.findUnique({
    where: { singletonKey: HOMEPAGE_SINGLETON_KEY },
  });
  if (!root) {
    root = await tx.homepage.create({
      data: { singletonKey: HOMEPAGE_SINGLETON_KEY },
    });
  }
  if (!root.activeRevisionId) {
    const count = await tx.homepageRevision.count({
      where: { homepageId: root.id },
    });
    if (count === 0 && actorId) {
      await openEditingRevision(tx, root.id, actorId);
      root = await tx.homepage.findUniqueOrThrow({ where: { id: root.id } });
    }
  }
  return root;
}

async function completeSnapshot(revision: Snapshot, database: Database) {
  const draft = validateHomepageDraft(snapshotToDraft(revision), true);
  try {
    await assertPublishableHomepageDraft(draft, database);
  } catch (error) {
    if (error instanceof HomepageError && error.code === "UNAVAILABLE_TARGET") {
      throw error;
    }
    throw new HomepageError("UNAVAILABLE_TARGET");
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
  await tx.homepageRevision.update({
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
  await tx.homepageWorkflowEvent.create({
    data: {
      homepageId: revision.homepageId,
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

function toPublicNewsItem(
  item: PublicNews,
  locale: NewsLocale,
): PublicHomepageNewsItem {
  return {
    newsId: item.newsId,
    title: item.title,
    summary: item.summary,
    slug: item.slug,
    displayDate: item.displayDate,
    href: `/${locale}/news/${encodeURIComponent(item.slug)}`,
  };
}

export async function resolveHomepageDraftToPublic(
  draft: HomepageDraft,
  locale: NewsLocale,
  database: Database,
): Promise<PublicHomepage> {
  const sections: PublicHomepageSection[] = [];
  const sorted = [...draft.sections].sort((a, b) => a.position - b.position);
  for (const section of sorted) {
    if (!section.enabled) continue;
    if (section.sectionType === "HERO" && section.hero) {
      const translation = section.hero.translations[locale];
      const heroCta = validateHomepageHeroCta(section.hero, false);
      const cta = heroCta.ctaEnabled
        ? await resolveHomepageHeroCta(heroCta, {
            locale,
            label: translation.ctaLabel,
          })
        : null;
      sections.push({
        type: "hero",
        hero: {
          title: translation.title,
          supportingText: translation.supportingText,
          cta,
        },
      });
    }
    if (section.sectionType === "NEWS" && section.news) {
      const heading = section.news.translations[locale].sectionHeading;
      let items: PublicHomepageNewsItem[] = [];
      if (section.news.mode === "MANUAL") {
        items = (
          await resolvePublishedNewsByIds(
            locale,
            section.news.manualNewsIds,
            database,
          )
        ).map((item) => toPublicNewsItem(item, locale));
      } else {
        items = (await listLatestPublishedNews(locale, 3, database)).map(
          (item) => toPublicNewsItem(item, locale),
        );
      }
      sections.push({
        type: "news",
        news: {
          heading,
          items,
          viewAllHref: `/${locale}/news`,
        },
      });
    }
  }
  return { sections };
}

export async function getEditorialHomepage(
  actorId: string,
  database: Database = getRuntimeDatabase(),
): Promise<EditorialHomepage> {
  await requireActorPermission(actorId, PERMISSIONS.HOMEPAGE_READ);
  await database.prisma.$transaction(async (tx) => {
    const row = await ensureRoot(tx, actorId);
    if (!row.activeRevisionId) {
      const count = await tx.homepageRevision.count({
        where: { homepageId: row.id },
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

export async function saveHomepageDraft(
  actorId: string,
  expectedVersion: number,
  input: unknown,
  database: Database = getRuntimeDatabase(),
) {
  const draft = validateHomepageDraft(input);
  await requireActorPermission(actorId, PERMISSIONS.HOMEPAGE_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, actorId);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "EDITING") {
      throw new HomepageError("INVALID_WORKFLOW_STATE");
    }
    if (revision.editVersion !== expectedVersion) {
      throw new HomepageError("CONCURRENT_MODIFICATION");
    }
    const changed = await tx.homepageRevision.updateMany({
      where: {
        id: revision.id,
        workflowStatus: "EDITING",
        editVersion: expectedVersion,
      },
      data: { editVersion: { increment: 1 } },
    });
    if (!changed.count) {
      throw new HomepageError("CONCURRENT_MODIFICATION");
    }
    await writeDraft(tx, revision.id, draft);
    return { revisionId: revision.id, editVersion: expectedVersion + 1 };
  });
}

export async function submitHomepage(
  actorId: string,
  expectedVersion: number,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.HOMEPAGE_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, actorId);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "EDITING") {
      throw new HomepageError("INVALID_WORKFLOW_STATE");
    }
    if (revision.editVersion !== expectedVersion) {
      throw new HomepageError("CONCURRENT_MODIFICATION");
    }
    await completeSnapshot(revision, database);
    await transition(tx, revision, actorId, "PENDING_REVIEW", "SUBMIT");
    return revision.id;
  });
}

export async function approveHomepage(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.HOMEPAGE_REVIEW);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, null);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "PENDING_REVIEW") {
      throw new HomepageError("INVALID_WORKFLOW_STATE");
    }
    if (revision.submittedById === actorId) {
      throw new HomepageError("SELF_APPROVAL_FORBIDDEN");
    }
    await completeSnapshot(revision, database);
    await transition(tx, revision, actorId, "APPROVED", "APPROVE");
    return revision.id;
  });
}

export async function returnHomepage(
  actorId: string,
  comment: string,
  database: Database = getRuntimeDatabase(),
) {
  if (!comment?.trim()) {
    throw new HomepageError("RETURN_COMMENT_REQUIRED");
  }
  await requireActorPermission(actorId, PERMISSIONS.HOMEPAGE_REVIEW);
  return database.prisma.$transaction(async (tx) => {
    const root = await ensureRoot(tx, null);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "PENDING_REVIEW") {
      throw new HomepageError("INVALID_WORKFLOW_STATE");
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

export async function startEditingHomepage(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.HOMEPAGE_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await lockedRoot(tx, (await ensureRoot(tx, actorId)).id);
    if (root.activeRevisionId) {
      throw new HomepageError("ACTIVE_REVISION_EXISTS");
    }
    let source: Snapshot | null = null;
    if (root.liveRevisionId) {
      source = await loadSnapshot(tx, root.liveRevisionId);
    } else {
      const latest = await tx.homepageRevision.findFirst({
        where: { homepageId: root.id },
        orderBy: { revisionNumber: "desc" },
      });
      if (latest) source = await loadSnapshot(tx, latest.id);
    }
    if (!source) throw new HomepageError("NOT_FOUND");
    return cloneRevision(tx, root.id, source, actorId);
  });
}

export async function restoreHomepageRevision(
  actorId: string,
  sourceRevisionId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.HOMEPAGE_EDIT);
  return database.prisma.$transaction(async (tx) => {
    const root = await lockedRoot(tx, (await ensureRoot(tx, actorId)).id);
    if (root.activeRevisionId) {
      const current = await tx.homepageRevision.findUnique({
        where: { id: root.activeRevisionId },
      });
      if (current?.workflowStatus === "EDITING") {
        throw new HomepageError("ACTIVE_EDITING_EXISTS");
      }
      if (current?.workflowStatus === "PENDING_REVIEW") {
        throw new HomepageError("ACTIVE_REVISION_EXISTS");
      }
    }
    const source = await loadSnapshot(tx, sourceRevisionId);
    if (source.homepageId !== root.id) {
      throw new HomepageError("REVISION_NOT_FOUND");
    }
    const draft = await cloneRevision(tx, root.id, source, actorId);
    await tx.homepageWorkflowEvent.create({
      data: {
        homepageId: root.id,
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

export async function publishHomepage(
  actorId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.HOMEPAGE_PUBLISH);
  return database.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${PUBLISH_LOCK})::text`;
    const root = await ensureRoot(tx, null);
    const { revision } = await active(tx, root.id);
    if (revision.workflowStatus !== "APPROVED") {
      throw new HomepageError("INVALID_WORKFLOW_STATE");
    }
    await completeSnapshot(revision, database);
    await tx.homepage.update({
      where: { id: root.id },
      data: {
        liveRevisionId: revision.id,
        activeRevisionId: null,
        publicationStatus: "PUBLISHED",
        publishedAt: new Date(),
        unpublishedAt: null,
      },
    });
    await tx.homepagePublicationEvent.create({
      data: {
        homepageId: root.id,
        revisionId: revision.id,
        action: "PUBLISH",
        actorId,
      },
    });
    return revision.id;
  });
}

export async function unpublishHomepage(
  actorId: string,
  reason: string,
  database: Database = getRuntimeDatabase(),
) {
  if (!reason?.trim()) {
    throw new HomepageError("UNPUBLISH_REASON_REQUIRED");
  }
  await requireActorPermission(actorId, PERMISSIONS.HOMEPAGE_PUBLISH);
  return database.prisma.$transaction(async (tx) => {
    const root = await lockedRoot(tx, (await ensureRoot(tx, null)).id);
    if (root.publicationStatus !== "PUBLISHED" || !root.liveRevisionId) {
      throw new HomepageError("INVALID_WORKFLOW_STATE");
    }
    const liveRevisionId = root.liveRevisionId;
    await tx.homepage.update({
      where: { id: root.id },
      data: {
        publicationStatus: "UNPUBLISHED",
        liveRevisionId: null,
        unpublishedAt: new Date(),
      },
    });
    await tx.homepagePublicationEvent.create({
      data: {
        homepageId: root.id,
        revisionId: liveRevisionId,
        action: "UNPUBLISH",
        reason: reason.trim(),
        actorId,
      },
    });
  });
}

export async function loadRevisionDraft(
  revisionId: string,
  database: Database = getRuntimeDatabase(),
): Promise<HomepageDraft | null> {
  const revision = await database.prisma.homepageRevision.findUnique({
    where: { id: revisionId },
  });
  if (!revision) return null;
  const snapshotRow = await loadSnapshot(database.prisma, revisionId);
  return snapshotToDraft(snapshotRow);
}

export async function resolveLivePublicHomepage(
  locale: NewsLocale,
  database?: Database,
): Promise<PublicHomepage | null> {
  const db = runtimeDatabaseOrNull(database);
  if (!db) return null;
  try {
    const root = await db.prisma.homepage.findUnique({
      where: { singletonKey: HOMEPAGE_SINGLETON_KEY },
    });
    if (
      !root ||
      root.publicationStatus !== "PUBLISHED" ||
      !root.liveRevisionId
    ) {
      return null;
    }
    const draft = await loadRevisionDraft(root.liveRevisionId, db);
    if (!draft) return null;
    return resolveHomepageDraftToPublic(draft, locale, db);
  } catch {
    return null;
  }
}

export async function resolveHomepagePreview(
  actorId: string,
  revisionId: string,
  locale: "ar" | "en",
  database: Database = getRuntimeDatabase(),
): Promise<HomepagePreview | null> {
  await requireActorPermission(actorId, PERMISSIONS.HOMEPAGE_READ);
  const revision = await database.prisma.homepageRevision.findUnique({
    where: { id: revisionId },
  });
  if (!revision) return null;
  const snapshotRow = await loadSnapshot(database.prisma, revisionId);
  const draft = validateHomepageDraft(snapshotToDraft(snapshotRow), false);
  const incompleteIssueKeys = [...collectHomepageCompletenessIssues(draft)];
  try {
    await assertPublishableHomepageDraft(draft, database);
  } catch (error) {
    if (error instanceof HomepageError) {
      if (error.code === "UNAVAILABLE_TARGET") {
        incompleteIssueKeys.push("news.targets.unavailable");
      } else if (
        error.code === "INVALID_CTA" ||
        error.code === "INVALID_SYSTEM_ROUTE" ||
        error.code === "INVALID_CONTENT_TARGET" ||
        error.code === "INVALID_EXTERNAL_URL"
      ) {
        incompleteIssueKeys.push("hero.cta.target");
      }
    } else {
      throw error;
    }
  }
  const uniqueIssues = [...new Set(incompleteIssueKeys)];
  return {
    revisionId,
    locale,
    incomplete: uniqueIssues.length > 0,
    incompleteIssueKeys: uniqueIssues,
  };
}

export function describeHomepageDraftCompleteness(draft: HomepageDraft) {
  return collectHomepageCompletenessIssues(draft);
}

export { emptyHomepageDraft, validateHomepageDraft };
