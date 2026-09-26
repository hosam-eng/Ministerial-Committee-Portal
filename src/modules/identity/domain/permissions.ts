/**
 * System-defined permission catalog (IMP-06). Keys are stable,
 * language-neutral constants — the database rows are seeded by the
 * RBAC migration, and labels live in the AR/EN message catalogs.
 * Backoffice users can never create permissions.
 */
export const PERMISSIONS = {
  BACKOFFICE_ACCESS: "backoffice.access",
  USERS_READ: "identity.users.read",
  USER_ROLES_MANAGE: "identity.user_roles.manage",
  ROLES_READ: "identity.roles.read",
  ROLES_MANAGE: "identity.roles.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_KEYS: readonly PermissionKey[] =
  Object.values(PERMISSIONS);

export function isPermissionKey(key: string): key is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(key);
}

/** Built-in system role — seeded by migration, immutable via the UI. */
export const ADMINISTRATOR_SYSTEM_KEY = "administrator";

export const ROLE_NAME_MAX = 80;
export const ROLE_DESCRIPTION_MAX = 280;

export interface RolePermissionSource {
  readonly isActive: boolean;
  readonly permissions: readonly { readonly key: string }[];
}

/**
 * Effective permissions = union over ACTIVE roles only. Default deny —
 * an empty set means no permission. There is no direct
 * User↔Permission relationship anywhere in the model.
 */
export function collectEffectivePermissions(
  roles: readonly RolePermissionSource[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const role of roles) {
    if (!role.isActive) continue;
    for (const permission of role.permissions) keys.add(permission.key);
  }
  return keys;
}
