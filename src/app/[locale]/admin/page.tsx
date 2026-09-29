import { getTranslations, setRequestLocale } from "next-intl/server";

import { adminShellProps } from "@/app/[locale]/admin/admin-shell-props";
import { routing, type Locale } from "@/i18n/routing";
import {
  AccessDenied,
  AdminHome,
  LogoutButton,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import { AdminShell } from "@/shared/ui/admin-shell";

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
  const shell =
    gate.status === "granted"
      ? {
          ...adminShellProps(locale, t, gate.permissions, {
            switchHref: `/${otherLocale}/admin`,
            activeHref: `/${locale}/admin`,
          }),
          email: gate.user.email,
          actions: <LogoutButton locale={locale as Locale} />,
        }
      : {
          locale,
          title: t("shell.adminTitle"),
          email: gate.user.email,
          navLabel: t("shell.adminNav"),
          skipLabel: t("shell.skipToContent"),
          openMenuLabel: t("shell.openMenu"),
          closeMenuLabel: t("shell.closeMenu"),
          navItems: [],
          switchTo: {
            href: `/${otherLocale}/admin`,
            lang: otherLocale,
            label: t("shell.language"),
            ariaLabel: t("shell.languageSwitch"),
          },
          actions: <LogoutButton locale={locale as Locale} />,
        };

  if (gate.status === "denied") {
    return (
      <AdminShell {...shell}>
        <AccessDenied locale={locale as Locale} />
      </AdminShell>
    );
  }

  return (
    <AdminShell {...shell}>
      <AdminHome
        email={gate.user.email}
        destinations={buildAdminHomeDestinations(locale, t, gate.permissions)}
      />
    </AdminShell>
  );
}

function buildAdminHomeDestinations(
  locale: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
  permissions: ReadonlySet<string>,
) {
  const content: {
    heading: string;
    links: { href: string; label: string }[];
  }[] = [];
  const contentLinks: { href: string; label: string }[] = [];
  if (permissions.has(PERMISSIONS.NEWS_READ)) {
    contentLinks.push({
      href: `/${locale}/admin/content/news`,
      label: t("news.title"),
    });
  }
  if (permissions.has(PERMISSIONS.MANAGED_PAGES_READ)) {
    contentLinks.push({
      href: `/${locale}/admin/content/pages`,
      label: t("managedPages.title"),
    });
  }
  if (contentLinks.length) {
    content.push({
      heading: t("adminHome.contentSection"),
      links: contentLinks,
    });
  }
  const accessLinks: { href: string; label: string }[] = [];
  if (permissions.has(PERMISSIONS.USERS_READ)) {
    accessLinks.push({
      href: `/${locale}/admin/access/users`,
      label: t("access.links.users"),
    });
  }
  if (permissions.has(PERMISSIONS.ROLES_READ)) {
    accessLinks.push({
      href: `/${locale}/admin/access/roles`,
      label: t("access.links.roles"),
    });
  }
  if (accessLinks.length) {
    content.push({ heading: t("adminHome.accessSection"), links: accessLinks });
  }
  return content;
}
