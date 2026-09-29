import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import {
  AccessDenied,
  AdminHome,
  LogoutButton,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import { AdminShell, type AdminNavItem } from "@/shared/ui/admin-shell";

export const dynamic = "force-dynamic";

/**
 * Backoffice landing — IMP-05 authentication state machine first
 * (login / MFA setup / MFA challenge redirects inside the gate), then
 * RBAC: fully authenticated users without `backoffice.access` get the
 * localized access-denied experience. IMP-08 renders the authorized
 * result inside AdminShell.
 */
export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const gate = await requireBackoffice(locale);
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
      href: `/${otherLocale}/admin`,
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
    ...(gate.permissions.has(PERMISSIONS.USERS_READ)
      ? [
          {
            href: `/${locale}/admin/access/users`,
            label: t("access.links.users"),
          },
        ]
      : []),
  ];

  return (
    <AdminShell {...shell} navItems={navItems}>
      <AdminHome email={gate.user.email} />
    </AdminShell>
  );
}
