import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { adminShellProps } from "@/app/[locale]/admin/admin-shell-props";
import { routing, type Locale } from "@/i18n/routing";
import {
  AccessDenied,
  LogoutButton,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import { REFERENCE_DATA_NAV } from "@/modules/reference-data";
import { AdminPageHeader } from "@/shared/ui/admin-page-header";
import { AdminShell } from "@/shared/ui/admin-shell";

export const dynamic = "force-dynamic";

export default async function ReferenceDataHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.REFERENCE_DATA_READ);
  const t = await getTranslations({ locale, namespace: "referenceData" });
  const tShell = await getTranslations({ locale });
  const permissions =
    gate.status === "granted" ? gate.permissions : new Set<string>();
  const props = adminShellProps(locale, tShell, permissions, {
    switchHref: `/${routing.locales.find((l) => l !== locale)}/admin/reference-data`,
    activeHref: `/${locale}/admin/reference-data`,
  });
  const shell = {
    ...props,
    email: gate.status === "granted" ? gate.user.email : "",
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

  const links = REFERENCE_DATA_NAV.filter(
    (item) =>
      permissions.has(PERMISSIONS.REFERENCE_DATA_READ) ||
      permissions.has(item.permission),
  );
  return (
    <AdminShell {...shell}>
      <AdminPageHeader title={t("title")} description={t("intro")} />
      <nav aria-label={t("navLabel")}>
        <ul className="admin-shell-nav-list">
          {links.map((item) => (
            <li key={item.slug}>
              <Link
                className="admin-shell-nav-link"
                href={`/${locale}/admin/reference-data/${item.slug}`}
              >
                {t(`sections.${item.section}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </AdminShell>
  );
}
