import type { getTranslations } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import type { LocaleSwitch } from "@/shared/ui/public-shell";

import { buildAdminNav } from "./admin-nav";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export function adminShellProps(
  locale: string,
  t: Translator,
  permissions: ReadonlySet<string>,
  options: { switchHref: string; activeHref?: string },
) {
  const otherLocale = routing.locales.find(
    (candidate) => candidate !== locale,
  ) as Locale;
  const switchTo: LocaleSwitch = {
    href: options.switchHref,
    lang: otherLocale,
    label: t("shell.language"),
    ariaLabel: t("shell.languageSwitch"),
  };
  return {
    locale,
    title: t("shell.adminTitle"),
    navLabel: t("shell.adminNav"),
    skipLabel: t("shell.skipToContent"),
    openMenuLabel: t("shell.openMenu"),
    closeMenuLabel: t("shell.closeMenu"),
    navItems: buildAdminNav(locale, t, permissions),
    activeHref: options.activeHref,
    switchTo,
  };
}
