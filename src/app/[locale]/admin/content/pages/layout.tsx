import { getTranslations, setRequestLocale } from "next-intl/server";

import { adminNavItems } from "@/app/[locale]/admin/admin-nav";
import { routing, type Locale } from "@/i18n/routing";
import { LogoutButton, requireBackoffice } from "@/modules/identity";
import { AdminShell } from "@/shared/ui/admin-shell";

export const dynamic = "force-dynamic";

export default async function ManagedPagesLayout({
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
  const navItems =
    gate.status === "granted"
      ? adminNavItems(locale, gate.permissions, {
          news: t("news.title"),
          pages: t("managedPages.title"),
          roles: t("access.links.roles"),
          users: t("access.links.users"),
        })
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
        href: `/${otherLocale}/admin/content/pages`,
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
