import { getTranslations, setRequestLocale } from "next-intl/server";

import { adminShellProps } from "@/app/[locale]/admin/admin-shell-props";
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
import { AdminShell } from "@/shared/ui/admin-shell";

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
  const permissions =
    gate.status === "granted" ? gate.permissions : new Set<string>();
  const props = adminShellProps(locale, t, permissions, {
    switchHref: `/${otherLocale}/admin/access/users`,
    activeHref: `/${locale}/admin/access/users`,
  });
  const shell = {
    ...props,
    email: gate.user.email,
    actions: <LogoutButton locale={locale as Locale} />,
    navItems: gate.status === "granted" ? props.navItems : [],
  };

  if (gate.status === "denied") {
    return (
      <AdminShell {...shell}>
        <AccessDenied locale={locale as Locale} />
      </AdminShell>
    );
  }

  const [users, roles, { error }] = await Promise.all([
    listBackofficeUsers(gate.user.id),
    listAllRoles(),
    searchParams,
  ]);

  return (
    <AdminShell {...shell}>
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
