import type { Database } from "@/platform/database";
import { getRuntimeDatabase } from "@/platform/runtime";

import { HOMEPAGE_SINGLETON_KEY } from "../domain/singleton";

export type HomepageNewsReferenceUsage = {
  liveReferenceCount: number;
  draftReferenceCount: number;
};

/** Dependency inspection for published news referenced on the homepage. */
export async function inspectHomepageNewsReferenceUsage(
  newsId: string,
  database: Database = getRuntimeDatabase(),
): Promise<HomepageNewsReferenceUsage> {
  const root = await database.prisma.homepage.findUnique({
    where: { singletonKey: HOMEPAGE_SINGLETON_KEY },
  });
  if (!root) return { liveReferenceCount: 0, draftReferenceCount: 0 };
  const revisionIds = new Set<string>();
  if (root.liveRevisionId) revisionIds.add(root.liveRevisionId);
  if (root.activeRevisionId) revisionIds.add(root.activeRevisionId);
  if (!revisionIds.size) {
    return { liveReferenceCount: 0, draftReferenceCount: 0 };
  }
  const rows = await database.prisma.homepageNewsManualItem.findMany({
    where: {
      newsId,
      newsSection: {
        section: { revisionId: { in: [...revisionIds] } },
      },
    },
    select: {
      newsSection: { select: { section: { select: { revisionId: true } } } },
    },
  });
  let liveReferenceCount = 0;
  let draftReferenceCount = 0;
  for (const row of rows) {
    const revisionId = row.newsSection.section.revisionId;
    if (revisionId === root.liveRevisionId) liveReferenceCount += 1;
    if (revisionId === root.activeRevisionId) draftReferenceCount += 1;
  }
  return { liveReferenceCount, draftReferenceCount };
}
