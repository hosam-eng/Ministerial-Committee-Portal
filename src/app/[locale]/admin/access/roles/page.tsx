import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import {
  AccessDenied,
  listAllRoles,
  listCatalogPermissions,
  LogoutButton,
  PERMISSIONS,
  requireBackoffice,
  RolesAdmin,
} from "@/modules/identity";
import { AdminShell, type AdminNavItem } from "@/shared/ui/admin-shell";

import {
  createRoleAction,
  setRoleActiveAction,
  updateRoleAction,
} from "../actions";

export const dynamic = "force-dynamic";

const ERROR_KEYS = new Set(["denied", "invalid", "nameTaken", "lastAdmin"]);

/**
 * Roles management — requires backoffice.access + identity.roles.read;
 * manage controls render only with identity.roles.manage (and every
 * mutation re-checks the manage permission server-side anyway).
 */
export default async function AdminRolesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const gate = await requireBackoffice(locale, PERMISSIONS.ROLES_READ);
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
      href: `/${otherLocale}/admin/access/roles`,
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
    ...(gate.permissions.has(PERMISSIONS.USERS_READ)
      ? [
          {
            href: `/${locale}/admin/access/users`,
            label: t("access.links.users"),
          },
        ]
      : []),
  ];

  const [roles, catalog, { error }] = await Promise.all([
    listAllRoles(),
    listCatalogPermissions(),
    searchParams,
  ]);

  return (
    <AdminShell {...shell} navItems={navItems}>
      <RolesAdmin
        returnPath={`/${locale}/admin/access/roles`}
        roles={roles.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          systemKey: role.systemKey,
          isActive: role.isActive,
          permissionKeys: role.permissions.map((p) => p.key),
        }))}
        catalog={catalog}
        canManage={gate.permissions.has(PERMISSIONS.ROLES_MANAGE)}
        errorKey={error && ERROR_KEYS.has(error) ? error : undefined}
        actions={{
          create: createRoleAction,
          update: updateRoleAction,
          setActive: setRoleActiveAction,
        }}
      />
    </AdminShell>
  );
}
