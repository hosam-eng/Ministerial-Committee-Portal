import "server-only";

import { PERMISSIONS, requireActorPermission } from "@/modules/identity";
import type { Database } from "@/platform/database";
import { getRuntimeDatabase } from "@/platform/runtime";

import { NewsError } from "./news-rules";

function normalizeComparableName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

function parseCategoryNames(input: { nameAr: string; nameEn: string }) {
  const nameAr = input.nameAr.trim().replace(/\s+/gu, " ");
  const nameEn = input.nameEn.trim().replace(/\s+/gu, " ");
  if (!nameAr || !nameEn) throw new NewsError("REQUIRED_FIELD");
  return { nameAr, nameEn };
}

export type NewsCategoryRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type NewsCategoryListItem = NewsCategoryRow & {
  revisionReferenceCount: number;
};

export type NewsCategoryOption = NewsCategoryRow;

async function assertUniqueNewsCategoryNames(
  database: Database,
  names: { nameAr: string; nameEn: string },
  excludeId?: string,
) {
  const rows = await database.prisma.newsCategory.findMany();
  const ar = normalizeComparableName(names.nameAr);
  const en = normalizeComparableName(names.nameEn);
  for (const row of rows) {
    if (excludeId && row.id === excludeId) continue;
    if (
      normalizeComparableName(row.nameAr) === ar ||
      normalizeComparableName(row.nameEn) === en
    ) {
      throw new NewsError("DUPLICATE_NAME");
    }
  }
}

export async function listNewsCategoriesForAdmin(
  actorId: string,
  database: Database = getRuntimeDatabase(),
): Promise<NewsCategoryListItem[]> {
  await requireActorPermission(actorId, PERMISSIONS.REFERENCE_DATA_READ);
  const rows = await database.prisma.newsCategory.findMany({
    orderBy: { nameEn: "asc" },
  });
  const counts = await database.prisma.newsRevisionCategory.groupBy({
    by: ["categoryId"],
    _count: { categoryId: true },
  });
  const countById = new Map(
    counts.map((row) => [row.categoryId, row._count.categoryId]),
  );
  return rows.map((row) => ({
    ...row,
    revisionReferenceCount: countById.get(row.id) ?? 0,
  }));
}

export async function getNewsCategoryDependencies(
  actorId: string,
  id: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.REFERENCE_DATA_READ);
  const row = await database.prisma.newsCategory.findUnique({ where: { id } });
  if (!row) throw new NewsError("NOT_FOUND");
  const count = await database.prisma.newsRevisionCategory.count({
    where: { categoryId: id },
  });
  return count > 0 ? [{ kind: "newsRevisionCategory", count }] : [];
}

export async function createNewsCategory(
  actorId: string,
  input: { nameAr: string; nameEn: string },
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_CATEGORIES_MANAGE);
  const names = parseCategoryNames(input);
  await assertUniqueNewsCategoryNames(database, names);
  return database.prisma.newsCategory.create({
    data: { nameAr: names.nameAr, nameEn: names.nameEn, isActive: true },
  });
}

export async function updateNewsCategory(
  actorId: string,
  id: string,
  input: { nameAr: string; nameEn: string },
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_CATEGORIES_MANAGE);
  const names = parseCategoryNames(input);
  const existing = await database.prisma.newsCategory.findUnique({
    where: { id },
  });
  if (!existing) throw new NewsError("NOT_FOUND");
  await assertUniqueNewsCategoryNames(database, names, id);
  return database.prisma.newsCategory.update({
    where: { id },
    data: { nameAr: names.nameAr, nameEn: names.nameEn },
  });
}

export async function setNewsCategoryActive(
  actorId: string,
  id: string,
  isActive: boolean,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_CATEGORIES_MANAGE);
  const existing = await database.prisma.newsCategory.findUnique({
    where: { id },
  });
  if (!existing) throw new NewsError("NOT_FOUND");
  return database.prisma.newsCategory.update({
    where: { id },
    data: { isActive },
  });
}

export async function deleteNewsCategory(
  actorId: string,
  id: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_CATEGORIES_MANAGE);
  const dependencies = await getNewsCategoryDependencies(actorId, id, database);
  if (dependencies.some((entry) => entry.count > 0)) {
    throw new NewsError("DELETE_BLOCKED");
  }
  const existing = await database.prisma.newsCategory.findUnique({
    where: { id },
  });
  if (!existing) throw new NewsError("NOT_FOUND");
  return database.prisma.newsCategory.delete({ where: { id } });
}

/** Category picker data for the News editor (Publishing-owned persistence). */
export async function listNewsCategoryOptions(
  actorId: string,
  database: Database = getRuntimeDatabase(),
): Promise<NewsCategoryOption[]> {
  await requireActorPermission(actorId, PERMISSIONS.NEWS_READ);
  return database.prisma.newsCategory.findMany({
    orderBy: { nameEn: "asc" },
  });
}
