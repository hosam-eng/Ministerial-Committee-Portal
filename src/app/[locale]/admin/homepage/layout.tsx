import { getTranslations, setRequestLocale } from "next-intl/server";

import { adminShellProps } from "@/app/[locale]/admin/admin-shell-props";
import { routing, type Locale } from "@/i18n/routing";
import { LogoutButton, requireBackoffice } from "@/modules/identity";
import { AdminShell } from "@/shared/ui/admin-shell";

export const dynamic = "force-dynamic";

export default async function HomepageAdminLayout({
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
  const permissions =
    gate.status === "granted" ? gate.permissions : new Set<string>();
  const props = adminShellProps(locale, t, permissions, {
    switchHref: `/${otherLocale}/admin/homepage`,
    activeHref: `/${locale}/admin/homepage`,
  });
  return (
    <AdminShell
      {...props}
      email={gate.user.email}
      actions={<LogoutButton locale={locale as Locale} />}
      navItems={gate.status === "granted" ? props.navItems : []}
    >
      {children}
    </AdminShell>
  );
}
