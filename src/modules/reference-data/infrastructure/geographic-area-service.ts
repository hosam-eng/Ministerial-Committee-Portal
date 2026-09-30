import "server-only";

import { PERMISSIONS, requireActorPermission } from "@/modules/identity";
import type { Database } from "@/platform/database";
import { getRuntimeDatabase } from "@/platform/runtime";

import { normalizeComparableName } from "../domain/bilingual-name";
import { ReferenceDataError } from "../domain/errors";
import {
  assertNoHierarchyCycle,
  parseGeographicAreaInput,
} from "../domain/geographic-rules";

export type GeographicAreaRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  code: string | null;
  parentId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type GeographicAreaListItem = GeographicAreaRow & {
  parentLabelEn: string | null;
  childCount: number;
};

export async function listGeographicAreas(
  actorId: string,
  database: Database = getRuntimeDatabase(),
): Promise<GeographicAreaListItem[]> {
  await requireActorPermission(actorId, PERMISSIONS.REFERENCE_DATA_READ);
  const rows = await database.prisma.geographicArea.findMany({
    orderBy: [{ nameEn: "asc" }],
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const childCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.parentId) continue;
    childCounts.set(row.parentId, (childCounts.get(row.parentId) ?? 0) + 1);
  }
  return rows.map((row) => ({
    ...row,
    parentLabelEn: row.parentId
      ? (byId.get(row.parentId)?.nameEn ?? null)
      : null,
    childCount: childCounts.get(row.id) ?? 0,
  }));
}

export async function getGeographicAreaDependencies(
  actorId: string,
  id: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.REFERENCE_DATA_READ);
  const row = await database.prisma.geographicArea.findUnique({
    where: { id },
  });
  if (!row) throw new ReferenceDataError("NOT_FOUND");
  const childCount = await database.prisma.geographicArea.count({
    where: { parentId: id },
  });
  const dependencies: { kind: string; count: number }[] = [];
  if (childCount > 0) {
    dependencies.push({ kind: "childGeographicArea", count: childCount });
  }
  return dependencies;
}

async function assertUniqueCode(
  database: Database,
  code: string | null,
  excludeId?: string,
) {
  if (!code) return;
  const existing = await database.prisma.geographicArea.findUnique({
    where: { code },
  });
  if (existing && existing.id !== excludeId) {
    throw new ReferenceDataError("DUPLICATE_CODE");
  }
}

async function assertUniqueNames(
  database: Database,
  names: { nameAr: string; nameEn: string },
  excludeId?: string,
) {
  const rows = await database.prisma.geographicArea.findMany();
  const ar = normalizeComparableName(names.nameAr);
  const en = normalizeComparableName(names.nameEn);
  for (const row of rows) {
    if (excludeId && row.id === excludeId) continue;
    if (
      normalizeComparableName(row.nameAr) === ar ||
      normalizeComparableName(row.nameEn) === en
    ) {
      throw new ReferenceDataError("DUPLICATE_NAME");
    }
  }
}

export async function createGeographicArea(
  actorId: string,
  input: {
    nameAr: string;
    nameEn: string;
    code?: string | null;
    parentId?: string | null;
  },
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_GEOGRAPHIC_AREAS_MANAGE,
  );
  const parsed = parseGeographicAreaInput(input);
  if (parsed.parentId) {
    const parent = await database.prisma.geographicArea.findUnique({
      where: { id: parsed.parentId },
    });
    if (!parent) throw new ReferenceDataError("INVALID_HIERARCHY");
  }
  await assertUniqueCode(database, parsed.code);
  await assertUniqueNames(database, parsed);
  return database.prisma.geographicArea.create({
    data: {
      nameAr: parsed.nameAr,
      nameEn: parsed.nameEn,
      code: parsed.code,
      parentId: parsed.parentId,
      isActive: true,
    },
  });
}

export async function updateGeographicArea(
  actorId: string,
  id: string,
  input: {
    nameAr: string;
    nameEn: string;
    code?: string | null;
    parentId?: string | null;
  },
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_GEOGRAPHIC_AREAS_MANAGE,
  );
  const existing = await database.prisma.geographicArea.findUnique({
    where: { id },
  });
  if (!existing) throw new ReferenceDataError("NOT_FOUND");
  const parsed = parseGeographicAreaInput(input);
  const rows = await database.prisma.geographicArea.findMany({
    select: { id: true, parentId: true },
  });
  const parentMap = new Map(rows.map((row) => [row.id, row.parentId]));
  assertNoHierarchyCycle(
    id,
    parsed.parentId,
    (nodeId) => parentMap.get(nodeId) ?? null,
  );
  if (parsed.parentId) {
    const parent = await database.prisma.geographicArea.findUnique({
      where: { id: parsed.parentId },
    });
    if (!parent) throw new ReferenceDataError("INVALID_HIERARCHY");
  }
  await assertUniqueCode(database, parsed.code, id);
  await assertUniqueNames(database, parsed, id);
  return database.prisma.geographicArea.update({
    where: { id },
    data: {
      nameAr: parsed.nameAr,
      nameEn: parsed.nameEn,
      code: parsed.code,
      parentId: parsed.parentId,
    },
  });
}

export async function setGeographicAreaActive(
  actorId: string,
  id: string,
  isActive: boolean,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_GEOGRAPHIC_AREAS_MANAGE,
  );
  const existing = await database.prisma.geographicArea.findUnique({
    where: { id },
  });
  if (!existing) throw new ReferenceDataError("NOT_FOUND");
  return database.prisma.geographicArea.update({
    where: { id },
    data: { isActive },
  });
}

export async function deleteGeographicArea(
  actorId: string,
  id: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_GEOGRAPHIC_AREAS_MANAGE,
  );
  const dependencies = await getGeographicAreaDependencies(
    actorId,
    id,
    database,
  );
  if (dependencies.some((entry) => entry.count > 0)) {
    throw new ReferenceDataError("DELETE_BLOCKED");
  }
  const existing = await database.prisma.geographicArea.findUnique({
    where: { id },
  });
  if (!existing) throw new ReferenceDataError("NOT_FOUND");
  return database.prisma.geographicArea.delete({ where: { id } });
}
