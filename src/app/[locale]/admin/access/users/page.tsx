import { setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import {
  AccessDenied,
  listAllRoles,
  listBackofficeUsers,
  PERMISSIONS,
  requireBackoffice,
  UsersAdmin,
} from "@/modules/identity";

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
  if (gate.status === "denied") {
    return <AccessDenied locale={locale as Locale} />;
  }

  const [users, roles, { error }] = await Promise.all([
    listBackofficeUsers(gate.user.id),
    listAllRoles(),
    searchParams,
  ]);

  return (
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
  );
}
