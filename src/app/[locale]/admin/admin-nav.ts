import { PERMISSIONS } from "@/modules/identity";
import type { AdminNavItem } from "@/shared/ui/admin-shell";

export function adminNavItems(
  locale: string,
  permissions: ReadonlySet<string>,
  labels: { news: string; pages: string; roles: string; users: string },
): AdminNavItem[] {
  return [
    ...(permissions.has(PERMISSIONS.NEWS_READ)
      ? [{ href: `/${locale}/admin/content/news`, label: labels.news }]
      : []),
    ...(permissions.has(PERMISSIONS.MANAGED_PAGES_READ)
      ? [{ href: `/${locale}/admin/content/pages`, label: labels.pages }]
      : []),
    ...(permissions.has(PERMISSIONS.ROLES_READ)
      ? [{ href: `/${locale}/admin/access/roles`, label: labels.roles }]
      : []),
    ...(permissions.has(PERMISSIONS.USERS_READ)
      ? [{ href: `/${locale}/admin/access/users`, label: labels.users }]
      : []),
  ];
}
