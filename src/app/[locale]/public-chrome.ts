import type { getTranslations } from "next-intl/server";

import {
  resolveLivePublicSiteSettings,
  type PublicSiteSettingsShell,
} from "@/modules/site-settings";
import type { PublicFooter, PublicNavRegion } from "@/shared/ui/public-shell";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export type PublicChromeOptions = {
  switchHref: string | null;
  active?: "news";
  previewShell?: PublicSiteSettingsShell | null;
};

function mergeFooter(
  base: PublicFooter,
  live: PublicSiteSettingsShell | null,
): PublicFooter {
  if (!live) return base;
  return {
    identity: live.officialName.trim() || base.identity,
    groups: base.groups,
    copyright: base.copyright,
    contact:
      live.contactEmail || live.contactPhone || live.address
        ? {
            email: live.contactEmail,
            phone: live.contactPhone,
            address: live.address,
          }
        : null,
    socialLinks: live.socialLinks.length ? live.socialLinks : null,
  };
}

/** Interim public navigation plus LIVE Site Settings shell binding (IMP-15). */
export async function resolvePublicChrome(
  t: Translator,
  locale: string,
  options: PublicChromeOptions,
) {
  const other = locale === "ar" ? "en" : "ar";
  const contentLocale = locale === "en" ? "en" : "ar";
  const navigation: PublicNavRegion = {
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
  };
  const baseFooter: PublicFooter = {
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
    copyright: t("shell.copyright", {
      year: new Date().getFullYear(),
    }),
  };

  const live =
    options.previewShell !== undefined
      ? options.previewShell
      : await resolveLivePublicSiteSettings(contentLocale);

  return {
    identity: live?.officialName.trim() || t("app.name"),
    switchTo: options.switchHref
      ? {
          href: options.switchHref,
          lang: other,
          label: t("shell.language"),
          ariaLabel: t("shell.languageSwitch"),
        }
      : null,
    skipLabel: t("shell.skipToContent"),
    navigation,
    footer: mergeFooter(baseFooter, live),
  };
}
