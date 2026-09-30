import "server-only";

import { PERMISSIONS, requireActorPermission } from "@/modules/identity";
import type { Database } from "@/platform/database";
import type { Prisma } from "@/platform/database/generated/client";
import { getRuntimeDatabase } from "@/platform/runtime";

import {
  normalizeComparableName,
  parseBilingualName,
} from "../domain/bilingual-name";
import { ReferenceDataError } from "../domain/errors";
import type { TaxonomyKind } from "../domain/taxonomy-kind";

type Transaction = Prisma.TransactionClient;

export type TaxonomyRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TaxonomyDependency = {
  kind: string;
  count: number;
};

type TaxonomyDelegate = {
  findMany: (args: { orderBy: { nameEn: "asc" } }) => Promise<TaxonomyRow[]>;
  findUnique: (args: { where: { id: string } }) => Promise<TaxonomyRow | null>;
  create: (args: {
    data: { nameAr: string; nameEn: string; isActive?: boolean };
  }) => Promise<TaxonomyRow>;
  update: (args: {
    where: { id: string };
    data: Partial<{ nameAr: string; nameEn: string; isActive: boolean }>;
  }) => Promise<TaxonomyRow>;
  delete: (args: { where: { id: string } }) => Promise<TaxonomyRow>;
};

function delegate(tx: Transaction, kind: TaxonomyKind): TaxonomyDelegate {
  switch (kind) {
    case "eventCategory":
      return tx.eventCategory as unknown as TaxonomyDelegate;
    case "awarenessTopic":
      return tx.awarenessTopic as unknown as TaxonomyDelegate;
    case "targetAudience":
      return tx.targetAudience as unknown as TaxonomyDelegate;
    case "publicationType":
      return tx.publicationType as unknown as TaxonomyDelegate;
    case "openDatasetCategory":
      return tx.openDatasetCategory as unknown as TaxonomyDelegate;
    default:
      throw new ReferenceDataError("INVALID_KIND");
  }
}

async function assertUniqueNames(
  tx: Transaction,
  kind: TaxonomyKind,
  names: { nameAr: string; nameEn: string },
  excludeId?: string,
) {
  const rows = await delegate(tx, kind).findMany({
    orderBy: { nameEn: "asc" },
  });
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

export async function listTaxonomies(
  actorId: string,
  kind: TaxonomyKind,
  database: Database = getRuntimeDatabase(),
): Promise<TaxonomyRow[]> {
  await requireActorPermission(actorId, PERMISSIONS.REFERENCE_DATA_READ);
  return database.prisma.$transaction((tx) =>
    delegate(tx, kind).findMany({ orderBy: { nameEn: "asc" } }),
  );
}

export async function getTaxonomyDependencies(
  actorId: string,
  kind: TaxonomyKind,
  id: string,
  database: Database = getRuntimeDatabase(),
): Promise<TaxonomyDependency[]> {
  await requireActorPermission(actorId, PERMISSIONS.REFERENCE_DATA_READ);
  await database.prisma.$transaction(async (tx) => {
    const row = await delegate(tx, kind).findUnique({ where: { id } });
    if (!row) throw new ReferenceDataError("NOT_FOUND");
  });
  void kind;
  void id;
  return [];
}

export async function createTaxonomy(
  actorId: string,
  kind: TaxonomyKind,
  input: { nameAr: string; nameEn: string },
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_TAXONOMIES_MANAGE,
  );
  const names = parseBilingualName(input);
  return database.prisma.$transaction(async (tx) => {
    await assertUniqueNames(tx, kind, names);
    return delegate(tx, kind).create({
      data: { nameAr: names.nameAr, nameEn: names.nameEn, isActive: true },
    });
  });
}

export async function updateTaxonomy(
  actorId: string,
  kind: TaxonomyKind,
  id: string,
  input: { nameAr: string; nameEn: string },
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_TAXONOMIES_MANAGE,
  );
  const names = parseBilingualName(input);
  return database.prisma.$transaction(async (tx) => {
    const existing = await delegate(tx, kind).findUnique({ where: { id } });
    if (!existing) throw new ReferenceDataError("NOT_FOUND");
    await assertUniqueNames(tx, kind, names, id);
    return delegate(tx, kind).update({
      where: { id },
      data: { nameAr: names.nameAr, nameEn: names.nameEn },
    });
  });
}

export async function setTaxonomyActive(
  actorId: string,
  kind: TaxonomyKind,
  id: string,
  isActive: boolean,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_TAXONOMIES_MANAGE,
  );
  return database.prisma.$transaction(async (tx) => {
    const existing = await delegate(tx, kind).findUnique({ where: { id } });
    if (!existing) throw new ReferenceDataError("NOT_FOUND");
    return delegate(tx, kind).update({ where: { id }, data: { isActive } });
  });
}

export async function deleteTaxonomy(
  actorId: string,
  kind: TaxonomyKind,
  id: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_TAXONOMIES_MANAGE,
  );
  const dependencies = await getTaxonomyDependencies(
    actorId,
    kind,
    id,
    database,
  );
  if (dependencies.some((entry) => entry.count > 0)) {
    throw new ReferenceDataError("DELETE_BLOCKED");
  }
  return database.prisma.$transaction(async (tx) => {
    const existing = await delegate(tx, kind).findUnique({ where: { id } });
    if (!existing) throw new ReferenceDataError("NOT_FOUND");
    return delegate(tx, kind).delete({ where: { id } });
  });
}

export async function canDeleteTaxonomy(
  actorId: string,
  kind: TaxonomyKind,
  id: string,
  database: Database = getRuntimeDatabase(),
) {
  const dependencies = await getTaxonomyDependencies(
    actorId,
    kind,
    id,
    database,
  );
  return dependencies.every((entry) => entry.count === 0);
}
