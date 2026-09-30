import "server-only";

import { PERMISSIONS, requireActorPermission } from "@/modules/identity";
import type { Database } from "@/platform/database";
import { getRuntimeDatabase } from "@/platform/runtime";

import { normalizeComparableName } from "../domain/bilingual-name";
import { ReferenceDataError } from "../domain/errors";
import {
  assertOrganizationNotExactDuplicate,
  findOrganizationMatches,
  organizationSearchQuery,
  parseOrganizationNames,
  type OrganizationSearchMatch,
} from "../domain/organization-rules";

export type OrganizationRow = {
  id: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function listOrganizations(
  actorId: string,
  database: Database = getRuntimeDatabase(),
): Promise<OrganizationRow[]> {
  await requireActorPermission(actorId, PERMISSIONS.REFERENCE_DATA_READ);
  return database.prisma.organization.findMany({
    orderBy: { nameEn: "asc" },
  });
}

export async function searchOrganizations(
  actorId: string,
  query: string,
  database: Database = getRuntimeDatabase(),
): Promise<OrganizationSearchMatch[]> {
  await requireActorPermission(actorId, PERMISSIONS.REFERENCE_DATA_READ);
  const normalized = organizationSearchQuery(query);
  const comparable = normalizeComparableName(normalized);
  const rows = await database.prisma.organization.findMany({
    orderBy: { nameEn: "asc" },
  });
  const probe = { nameAr: normalized, nameEn: normalized };
  return findOrganizationMatches(rows, probe).filter(
    (match) =>
      normalizeComparableName(match.nameAr).includes(comparable) ||
      normalizeComparableName(match.nameEn).includes(comparable) ||
      match.match === "exact",
  );
}

export async function previewOrganizationDuplicates(
  actorId: string,
  input: { nameAr: string; nameEn: string; excludeId?: string },
  database: Database = getRuntimeDatabase(),
): Promise<OrganizationSearchMatch[]> {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_ORGANIZATIONS_MANAGE,
  );
  const names = parseOrganizationNames(input);
  const rows = await database.prisma.organization.findMany({
    orderBy: { nameEn: "asc" },
  });
  return findOrganizationMatches(rows, names, input.excludeId);
}

export async function getOrganizationDependencies(
  actorId: string,
  id: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(actorId, PERMISSIONS.REFERENCE_DATA_READ);
  const row = await database.prisma.organization.findUnique({ where: { id } });
  if (!row) throw new ReferenceDataError("NOT_FOUND");
  return [];
}

export async function createOrganization(
  actorId: string,
  input: { nameAr: string; nameEn: string; acknowledgeSimilar?: boolean },
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_ORGANIZATIONS_MANAGE,
  );
  const names = parseOrganizationNames(input);
  const rows = await database.prisma.organization.findMany();
  const matches = findOrganizationMatches(rows, names);
  assertOrganizationNotExactDuplicate(matches);
  if (
    !input.acknowledgeSimilar &&
    matches.some((match) => match.match === "similar")
  ) {
    throw new ReferenceDataError("SIMILAR_ORGANIZATION");
  }
  return database.prisma.organization.create({
    data: { nameAr: names.nameAr, nameEn: names.nameEn, isActive: true },
  });
}

export async function updateOrganization(
  actorId: string,
  id: string,
  input: { nameAr: string; nameEn: string },
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_ORGANIZATIONS_MANAGE,
  );
  const names = parseOrganizationNames(input);
  const rows = await database.prisma.organization.findMany();
  const matches = findOrganizationMatches(rows, names, id);
  assertOrganizationNotExactDuplicate(matches);
  const existing = await database.prisma.organization.findUnique({
    where: { id },
  });
  if (!existing) throw new ReferenceDataError("NOT_FOUND");
  return database.prisma.organization.update({
    where: { id },
    data: { nameAr: names.nameAr, nameEn: names.nameEn },
  });
}

export async function setOrganizationActive(
  actorId: string,
  id: string,
  isActive: boolean,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_ORGANIZATIONS_MANAGE,
  );
  const existing = await database.prisma.organization.findUnique({
    where: { id },
  });
  if (!existing) throw new ReferenceDataError("NOT_FOUND");
  return database.prisma.organization.update({
    where: { id },
    data: { isActive },
  });
}

export async function deleteOrganization(
  actorId: string,
  id: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActorPermission(
    actorId,
    PERMISSIONS.REFERENCE_DATA_ORGANIZATIONS_MANAGE,
  );
  const dependencies = await getOrganizationDependencies(actorId, id, database);
  if (dependencies.length > 0) throw new ReferenceDataError("DELETE_BLOCKED");
  const existing = await database.prisma.organization.findUnique({
    where: { id },
  });
  if (!existing) throw new ReferenceDataError("NOT_FOUND");
  return database.prisma.organization.delete({ where: { id } });
}
