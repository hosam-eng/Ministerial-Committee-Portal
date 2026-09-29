import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import {
  AccessDenied,
  listAllRoles,
  listBackofficeUsers,
  LogoutButton,
  PERMISSIONS,
  requireBackoffice,
  UsersAdmin,
} from "@/modules/identity";
import { AdminShell, type AdminNavItem } from "@/shared/ui/admin-shell";

import { assignRoleAction, removeUserRoleAction } from "../actions";

export const dynamic = "force-dynamic";

const ERROR_KEYS = new Set(["denied", "invalid", "lastAdmin"]);

/**
 * User ↔ Role assignment — requires backoffice.access +
 * identity.users.read; assignment controls render only with
 * identity.user_roles.manage (mutations re-check it server-side).
 */
export default async function AdminUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const gate = await requireBackoffice(locale, PERMISSIONS.USERS_READ);
  const t = await getTranslations({ locale });
  const otherLocale = routing.locales.find(
    (candidate) => candidate !== locale,
  ) as Locale;
  const shell = {
    locale,
    title: t("shell.adminTitle"),
    email: gate.user.email,
    navLabel: t("shell.adminNav"),
    skipLabel: t("shell.skipToContent"),
    switchTo: {
      href: `/${otherLocale}/admin/access/users`,
      lang: otherLocale,
      label: t("shell.language"),
      ariaLabel: t("shell.languageSwitch"),
    },
    actions: <LogoutButton locale={locale as Locale} />,
  } as const;

  if (gate.status === "denied") {
    return (
      <AdminShell {...shell} navItems={[]}>
        <AccessDenied locale={locale as Locale} />
      </AdminShell>
    );
  }

  const navItems: AdminNavItem[] = [
    ...(gate.permissions.has(PERMISSIONS.NEWS_READ)
      ? [{ href: `/${locale}/admin/content/news`, label: t("news.title") }]
      : []),
    ...(gate.permissions.has(PERMISSIONS.MANAGED_PAGES_READ)
      ? [
          {
            href: `/${locale}/admin/content/pages`,
            label: t("managedPages.title"),
          },
        ]
      : []),
    ...(gate.permissions.has(PERMISSIONS.ROLES_READ)
      ? [
          {
            href: `/${locale}/admin/access/roles`,
            label: t("access.links.roles"),
          },
        ]
      : []),
  ];

  const [users, roles, { error }] = await Promise.all([
    listBackofficeUsers(gate.user.id),
    listAllRoles(),
    searchParams,
  ]);

  return (
    <AdminShell {...shell} navItems={navItems}>
      <UsersAdmin
        returnPath={`/${locale}/admin/access/users`}
        users={users.map((user) => ({
          id: user.id,
          email: user.email,
          roles: user.roles.map((role) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            systemKey: role.systemKey,
            isActive: role.isActive,
            permissionKeys: role.permissions.map((p) => p.key),
          })),
        }))}
        assignableRoles={roles
          .filter((role) => role.isActive)
          .map((role) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            systemKey: role.systemKey,
            isActive: role.isActive,
            permissionKeys: role.permissions.map((p) => p.key),
          }))}
        canManage={gate.permissions.has(PERMISSIONS.USER_ROLES_MANAGE)}
        errorKey={error && ERROR_KEYS.has(error) ? error : undefined}
        actions={{ assign: assignRoleAction, remove: removeUserRoleAction }}
      />
    </AdminShell>
  );
}
