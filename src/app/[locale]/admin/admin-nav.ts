import type { getTranslations } from "next-intl/server";

import { PERMISSIONS } from "@/modules/identity";
import type { AdminNavItem } from "@/shared/ui/admin-shell";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/** Real admin destinations only. RBAC still enforced on each route. */
export function buildAdminNav(
  locale: string,
  t: Translator,
  permissions: ReadonlySet<string>,
): AdminNavItem[] {
  const items: AdminNavItem[] = [
    { href: `/${locale}/admin`, label: t("shell.adminDashboard") },
  ];
  if (permissions.has(PERMISSIONS.NEWS_READ)) {
    items.push({
      href: `/${locale}/admin/content/news`,
      label: t("news.title"),
    });
  }
  if (permissions.has(PERMISSIONS.MANAGED_PAGES_READ)) {
    items.push({
      href: `/${locale}/admin/content/pages`,
      label: t("managedPages.title"),
    });
  }
  if (permissions.has(PERMISSIONS.ROLES_READ)) {
    items.push({
      href: `/${locale}/admin/access/roles`,
      label: t("access.links.roles"),
    });
  }
  if (permissions.has(PERMISSIONS.USERS_READ)) {
    items.push({
      href: `/${locale}/admin/access/users`,
      label: t("access.links.users"),
    });
  }
  if (permissions.has(PERMISSIONS.REFERENCE_DATA_READ)) {
    items.push({
      href: `/${locale}/admin/reference-data`,
      label: t("referenceData.nav"),
    });
  }
  return items;
}
