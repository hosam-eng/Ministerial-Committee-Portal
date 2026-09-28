import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import {
  LogoutButton,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import { AdminShell, type AdminNavItem } from "@/shared/ui/admin-shell";

export const dynamic = "force-dynamic";

export default async function NewsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale);
  const t = await getTranslations({ locale });
  const otherLocale = routing.locales.find(
    (candidate) => candidate !== locale,
  ) as Locale;
  const navItems: AdminNavItem[] =
    gate.status === "granted"
      ? [
          ...(gate.permissions.has(PERMISSIONS.NEWS_READ)
            ? [
                {
                  href: `/${locale}/admin/content/news`,
                  label: t("news.title"),
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
        ]
      : [];
  return (
    <AdminShell
      locale={locale}
      title={t("shell.adminTitle")}
      email={gate.user.email}
      navLabel={t("shell.adminNav")}
      skipLabel={t("shell.skipToContent")}
      navItems={navItems}
      switchTo={{
        href: `/${otherLocale}/admin/content/news`,
        lang: otherLocale,
        label: t("shell.language"),
        ariaLabel: t("shell.languageSwitch"),
      }}
      actions={<LogoutButton locale={locale as Locale} />}
    >
      {children}
    </AdminShell>
  );
}
