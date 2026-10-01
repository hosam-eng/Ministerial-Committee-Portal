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
  NEWS_READ: "publishing.news.read",
  NEWS_CREATE: "publishing.news.create",
  NEWS_EDIT: "publishing.news.edit",
  NEWS_REVIEW: "publishing.news.review",
  NEWS_PUBLISH: "publishing.news.publish",
  MANAGED_PAGES_READ: "managed_pages.pages.read",
  MANAGED_PAGES_CREATE: "managed_pages.pages.create",
  MANAGED_PAGES_EDIT: "managed_pages.pages.edit",
  MANAGED_PAGES_REVIEW: "managed_pages.pages.review",
  MANAGED_PAGES_PUBLISH: "managed_pages.pages.publish",
  REFERENCE_DATA_READ: "reference_data.read",
  REFERENCE_DATA_TAXONOMIES_MANAGE: "reference_data.taxonomies.manage",
  REFERENCE_DATA_ORGANIZATIONS_MANAGE: "reference_data.organizations.manage",
  REFERENCE_DATA_GEOGRAPHIC_AREAS_MANAGE:
    "reference_data.geographic_areas.manage",
  NEWS_CATEGORIES_MANAGE: "publishing.news_categories.manage",
  SITE_SETTINGS_READ: "site_settings.read",
  SITE_SETTINGS_EDIT: "site_settings.edit",
  SITE_SETTINGS_REVIEW: "site_settings.review",
  SITE_SETTINGS_PUBLISH: "site_settings.publish",
  NAVIGATION_READ: "navigation.read",
  NAVIGATION_EDIT: "navigation.edit",
  NAVIGATION_REVIEW: "navigation.review",
  NAVIGATION_PUBLISH: "navigation.publish",
  HOMEPAGE_READ: "homepage.read",
  HOMEPAGE_EDIT: "homepage.edit",
  HOMEPAGE_REVIEW: "homepage.review",
  HOMEPAGE_PUBLISH: "homepage.publish",
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
