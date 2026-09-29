import type { getTranslations } from "next-intl/server";

import type { PublicFooter, PublicNavRegion } from "@/shared/ui/public-shell";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Interim public navigation. Only routes that exist today.
 * IMP-16 replaces this data; it does not redesign the shell.
 */
export function publicChrome(
  t: Translator,
  locale: string,
  options: { switchHref: string | null; active?: "news" },
): {
  identity: string;
  switchTo: {
    href: string;
    lang: string;
    label: string;
    ariaLabel: string;
  } | null;
  skipLabel: string;
  navigation: PublicNavRegion;
  footer: PublicFooter;
} {
  const other = locale === "ar" ? "en" : "ar";
  return {
    identity: t("app.name"),
    switchTo: options.switchHref
      ? {
          href: options.switchHref,
          lang: other,
          label: t("shell.language"),
          ariaLabel: t("shell.languageSwitch"),
        }
      : null,
    skipLabel: t("shell.skipToContent"),
    navigation: {
      label: t("shell.mainNavigation"),
      openMenuLabel: t("shell.openMenu"),
      closeMenuLabel: t("shell.closeMenu"),
      items: [
        {
          href: `/${locale}/news`,
          label: t("publicNews.title"),
          current: options.active === "news",
        },
      ],
    },
    footer: {
      identity: t("app.name"),
      groups: [
        {
          heading: t("shell.footerImportant"),
          links: [{ href: `/${locale}/news`, label: t("publicNews.title") }],
        },
        {
          heading: t("shell.footerPortal"),
          links: [{ href: `/${locale}`, label: t("shell.home") }],
        },
      ],
      copyright: t("shell.copyright", { year: new Date().getFullYear() }),
    },
  };
}
