import type { Database } from "@/platform/database";
import { Prisma } from "@/platform/database/generated/client";

import {
  ADMINISTRATOR_SYSTEM_KEY,
  type PermissionKey,
} from "../../domain/permissions";
import {
  BootstrapClosedError,
  LastAdministratorError,
} from "../../application/authorization";

/**
 * RBAC persistence (IMP-06) — the only place Prisma touches the RBAC
 * tables. Authorization data always comes from PostgreSQL, never from
 * session/client claims, so role changes are effective on the next
 * request.
 */

export interface RoleRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly systemKey: string | null;
  readonly isActive: boolean;
  readonly permissions: readonly { readonly key: string }[];
}

const roleSelect = {
  id: true,
  name: true,
  description: true,
  systemKey: true,
  isActive: true,
  permissions: {
    select: { permission: { select: { key: true } } },
  },
} as const;

function toRoleRecord(row: {
  id: string;
  name: string;
  description: string | null;
  systemKey: string | null;
  isActive: boolean;
  permissions: { permission: { key: string } }[];
}): RoleRecord {
  return {
    ...row,
    permissions: row.permissions.map((rp) => ({ key: rp.permission.key })),
  };
}

export function listRoles(database: Database): Promise<RoleRecord[]> {
  return database.prisma.role
    .findMany({ select: roleSelect, orderBy: { name: "asc" } })
    .then((rows) => rows.map(toRoleRecord));
}

export async function findRole(
  database: Database,
  roleId: string,
): Promise<RoleRecord | null> {
  const row = await database.prisma.role.findUnique({
    where: { id: roleId },
    select: roleSelect,
  });
  return row ? toRoleRecord(row) : null;
}

export function listPermissions(
  database: Database,
): Promise<{ id: string; key: string }[]> {
  return database.prisma.permission.findMany({
    select: { id: true, key: true },
    orderBy: { key: "asc" },
  });
}

/** Roles (active or not) with their permission keys, for a user. */
export async function listUserRoles(
  database: Database,
  userId: string,
): Promise<RoleRecord[]> {
  const rows = await database.prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: roleSelect } },
    orderBy: { role: { name: "asc" } },
  });
  return rows.map((row) => toRoleRecord(row.role));
}

export function listUsersWithRoles(database: Database) {
  return database.prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      userRoles: {
        select: { role: { select: roleSelect } },
        orderBy: { role: { name: "asc" } },
      },
    },
    orderBy: { email: "asc" },
  });
}

export interface UserWithRoles {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly roles: readonly RoleRecord[];
}

export function toUserWithRoles(row: {
  id: string;
  email: string;
  name: string;
  userRoles: { role: Parameters<typeof toRoleRecord>[0] }[];
}): UserWithRoles {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roles: row.userRoles.map((ur) => toRoleRecord(ur.role)),
  };
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function createRole(
  database: Database,
  data: { name: string; description: string | null; permissionIds: string[] },
): Promise<RoleRecord> {
  return database.prisma.role
    .create({
      data: {
        name: data.name,
        description: data.description,
        permissions: {
          create: data.permissionIds.map((permissionId) => ({
            permission: { connect: { id: permissionId } },
          })),
        },
      },
      select: roleSelect,
    })
    .then(toRoleRecord);
}

export async function updateRole(
  database: Database,
  roleId: string,
  data: { name: string; description: string | null },
): Promise<void> {
  await database.prisma.role.update({ where: { id: roleId }, data });
}

export async function setRoleActive(
  database: Database,
  roleId: string,
  isActive: boolean,
): Promise<void> {
  await database.prisma.role.update({
    where: { id: roleId },
    data: { isActive },
  });
}

/** Replace a role's permission set atomically. */
export async function setRolePermissions(
  database: Database,
  roleId: string,
  permissionIds: readonly string[],
): Promise<void> {
  await database.prisma.$transaction([
    database.prisma.rolePermission.deleteMany({ where: { roleId } }),
    database.prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    }),
  ]);
}

/** Idempotent assign — a duplicate assignment is a no-op. */
export async function assignUserRole(
  database: Database,
  userId: string,
  roleId: string,
): Promise<void> {
  await database.prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    create: { userId, roleId },
    update: {},
  });
}

/**
 * Remove a User↔Role assignment. Removing the Administrator membership
 * takes the serializing lock on the Administrator role row so two
 * concurrent removals cannot both succeed and leave zero members.
 */
export async function removeUserRole(
  database: Database,
  userId: string,
  roleId: string,
): Promise<void> {
  const role = await database.prisma.role.findUnique({
    where: { id: roleId },
    select: { systemKey: true },
  });
  if (role?.systemKey !== ADMINISTRATOR_SYSTEM_KEY) {
    await database.prisma.userRole.deleteMany({ where: { userId, roleId } });
    return;
  }
  await database.prisma.$transaction(async (tx) => {
    // Lock the Administrator role row — every admin-membership mutation
    // serializes on this row before re-counting.
    await tx.$executeRaw`SELECT id FROM "identity"."role" WHERE "system_key" = ${ADMINISTRATOR_SYSTEM_KEY} FOR UPDATE`;
    const roleRow = await tx.role.findUniqueOrThrow({
      where: { systemKey: ADMINISTRATOR_SYSTEM_KEY },
      select: { id: true },
    });
    const members = await tx.userRole.count({
      where: { roleId: roleRow.id },
    });
    const target = await tx.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: roleRow.id } },
      select: { userId: true },
    });
    if (target && members <= 1) throw new LastAdministratorError();
    await tx.userRole.deleteMany({
      where: { userId, roleId: roleRow.id },
    });
  });
}

export function countAdministratorMembers(database: Database): Promise<number> {
  return database.prisma.userRole.count({
    where: { role: { systemKey: ADMINISTRATOR_SYSTEM_KEY } },
  });
}

/**
 * First-administrator bootstrap (IMP-06 §12): succeeds only while zero
 * Administrator memberships exist. The lock on the Administrator role
 * row makes the check-and-assign atomic under concurrency. The caller
 * supplies an already-Argon2id-hashed password when the user must be
 * created.
 */
export async function bootstrapAssignAdministrator(
  database: Database,
  input: {
    email: string;
    passwordHash: string | null;
  },
): Promise<{ userId: string; createdUser: boolean }> {
  return database.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "identity"."role" WHERE "system_key" = ${ADMINISTRATOR_SYSTEM_KEY} FOR UPDATE`;
    const role = await tx.role.findUniqueOrThrow({
      where: { systemKey: ADMINISTRATOR_SYSTEM_KEY },
      select: { id: true },
    });
    const members = await tx.userRole.count({
      where: { roleId: role.id },
    });
    if (members > 0) throw new BootstrapClosedError();

    let createdUser = false;
    let user = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (!user) {
      if (!input.passwordHash) {
        throw new BootstrapClosedError(); // unreachable: caller enforces
      }
      user = await tx.user.create({
        data: {
          email: input.email,
          name: input.email,
          emailVerified: true,
        },
        select: { id: true },
      });
      await tx.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: input.passwordHash,
        },
      });
      createdUser = true;
    }
    await tx.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    return { userId: user.id, createdUser };
  });
}

/** Used by services that must resolve a permission key to a row. */
export function findPermissionId(
  database: Database,
  key: PermissionKey,
): Promise<string | null> {
  return database.prisma.permission
    .findUnique({ where: { key }, select: { id: true } })
    .then((row) => row?.id ?? null);
}
