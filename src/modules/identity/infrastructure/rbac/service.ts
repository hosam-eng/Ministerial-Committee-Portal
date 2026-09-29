import type { Database } from "@/platform/database";
import { getRuntimeDatabase } from "@/platform/runtime";

import {
  normalizeRoleDescription,
  normalizeRoleName,
  requireCustomRole,
  requirePermission,
  RoleValidationError,
} from "../../application/authorization";
import {
  collectEffectivePermissions,
  PERMISSIONS,
  type PermissionKey,
} from "../../domain/permissions";
import {
  assignUserRole,
  bootstrapAssignAdministrator,
  createRole,
  findRole,
  isUniqueViolation,
  listPermissions,
  listRoles,
  listUserRoles,
  listUsersWithRoles,
  removeUserRole,
  setRoleActive,
  setRolePermissions,
  toUserWithRoles,
  updateRole,
  type RoleRecord,
} from "./store";

/**
 * RBAC service (IMP-06) — the authorization contract consumed by app
 * routes and server actions. Every mutation re-checks the actor's
 * permission against the database; nothing trusts session claims,
 * cookies, or client state. Role changes are effective on the next
 * call — there is no permission cache.
 */

export interface AuthorizationContext {
  readonly userId: string;
  readonly roles: readonly RoleRecord[];
  readonly permissions: ReadonlySet<string>;
}

export async function getAuthorizationContext(
  userId: string,
  database: Database = getRuntimeDatabase(),
): Promise<AuthorizationContext> {
  const roles = await listUserRoles(database, userId);
  return {
    userId,
    roles,
    permissions: collectEffectivePermissions(roles),
  };
}

export async function hasPermission(
  userId: string,
  permission: PermissionKey,
  database: Database = getRuntimeDatabase(),
): Promise<boolean> {
  return (await getAuthorizationContext(userId, database)).permissions.has(
    permission,
  );
}

/** Load the actor's effective permissions and enforce `permission`. */
async function requireActor(
  actorUserId: string,
  permission: PermissionKey,
  database: Database,
): Promise<AuthorizationContext> {
  const ctx = await getAuthorizationContext(actorUserId, database);
  requirePermission(ctx.permissions, permission);
  return ctx;
}

/**
 * Narrow public authorization use case. Resolves the actor against the
 * current database and throws AccessDeniedError when the permission is
 * absent. Callers pass an actor id and a permission key only — no
 * database handle, transaction, or persistence record.
 */
export async function requireActorPermission(
  actorId: string,
  permission: PermissionKey,
): Promise<void> {
  await requireActor(actorId, permission, getRuntimeDatabase());
}

export function listAllRoles(database: Database = getRuntimeDatabase()) {
  return listRoles(database);
}

export function listCatalogPermissions(
  database: Database = getRuntimeDatabase(),
) {
  return listPermissions(database);
}

export interface RoleInput {
  name: string;
  description: string | null;
  permissionIds: string[];
}

export async function createCustomRole(
  actorUserId: string,
  input: RoleInput,
  database: Database = getRuntimeDatabase(),
): Promise<RoleRecord> {
  await requireActor(actorUserId, PERMISSIONS.ROLES_MANAGE, database);
  await assertPermissionIds(database, input.permissionIds);
  try {
    return await createRole(database, {
      name: normalizeRoleName(input.name),
      description: normalizeRoleDescription(input.description),
      permissionIds: input.permissionIds,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RoleValidationError("Role name must be unique.", "nameTaken");
    }
    throw error;
  }
}

export async function updateCustomRole(
  actorUserId: string,
  roleId: string,
  input: { name: string; description: string | null },
  database: Database = getRuntimeDatabase(),
): Promise<void> {
  await requireActor(actorUserId, PERMISSIONS.ROLES_MANAGE, database);
  requireCustomRole(await findRole(database, roleId));
  try {
    await updateRole(database, roleId, {
      name: normalizeRoleName(input.name),
      description: normalizeRoleDescription(input.description),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new RoleValidationError("Role name must be unique.", "nameTaken");
    }
    throw error;
  }
}

export async function setCustomRolePermissions(
  actorUserId: string,
  roleId: string,
  permissionIds: readonly string[],
  database: Database = getRuntimeDatabase(),
): Promise<void> {
  await requireActor(actorUserId, PERMISSIONS.ROLES_MANAGE, database);
  requireCustomRole(await findRole(database, roleId));
  await assertPermissionIds(database, permissionIds);
  await setRolePermissions(database, roleId, permissionIds);
}

export async function setCustomRoleActive(
  actorUserId: string,
  roleId: string,
  isActive: boolean,
  database: Database = getRuntimeDatabase(),
): Promise<void> {
  await requireActor(actorUserId, PERMISSIONS.ROLES_MANAGE, database);
  requireCustomRole(await findRole(database, roleId));
  await setRoleActive(database, roleId, isActive);
}

export async function listBackofficeUsers(
  actorUserId: string,
  database: Database = getRuntimeDatabase(),
) {
  await requireActor(actorUserId, PERMISSIONS.USERS_READ, database);
  const rows = await listUsersWithRoles(database);
  return rows.map(toUserWithRoles);
}

export async function assignRole(
  actorUserId: string,
  userId: string,
  roleId: string,
  database: Database = getRuntimeDatabase(),
): Promise<void> {
  await requireActor(actorUserId, PERMISSIONS.USER_ROLES_MANAGE, database);
  const role = await findRole(database, roleId);
  if (!role) throw new RoleValidationError("Role not found.");
  if (!role.isActive) {
    throw new RoleValidationError("Inactive roles cannot be assigned.");
  }
  await assignUserRole(database, userId, roleId);
}

export async function unassignRole(
  actorUserId: string,
  userId: string,
  roleId: string,
  database: Database = getRuntimeDatabase(),
): Promise<void> {
  await requireActor(actorUserId, PERMISSIONS.USER_ROLES_MANAGE, database);
  await removeUserRole(database, userId, roleId);
}

/** Permission ids must reference existing catalog rows. */
async function assertPermissionIds(
  database: Database,
  permissionIds: readonly string[],
): Promise<void> {
  if (permissionIds.length === 0) return;
  const found = await database.prisma.permission.count({
    where: { id: { in: [...permissionIds] } },
  });
  if (found !== new Set(permissionIds).size) {
    throw new RoleValidationError("Unknown permission id.");
  }
}

/**
 * Operator-only first-administrator bootstrap. Password must already be
 * hashed with the production Argon2id path; creation and assignment are
 * atomic and refuse to run once any Administrator membership exists.
 */
export function bootstrapFirstAdministrator(
  input: { email: string; passwordHash: string | null },
  database: Database = getRuntimeDatabase(),
) {
  return bootstrapAssignAdministrator(database, input);
}
