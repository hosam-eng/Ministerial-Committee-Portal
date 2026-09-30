import type { getTranslations } from "next-intl/server";

import {
  resolveLiveNavigationDraft,
  resolvePublicNavigation,
  type NavigationDraft,
} from "@/modules/public-navigation";
import {
  resolveLivePublicSiteSettings,
  type PublicSiteSettingsShell,
} from "@/modules/site-settings";
import type {
  PublicFooter,
  PublicLinkGroup,
  PublicNavRegion,
  PublicNavTreeLink,
  PublicNavTreeNode,
} from "@/shared/ui/public-shell";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export type PublicChromeOptions = {
  switchHref: string | null;
  currentPath?: string | null;
  previewNavigationDraft?: NavigationDraft | null;
  previewShell?: PublicSiteSettingsShell | null;
};

function staticFallbackNavigation(
  t: Translator,
  locale: string,
  currentPath?: string | null,
): PublicNavRegion {
  const newsHref = `/${locale}/news`;
  const newsCurrent =
    currentPath === newsHref ||
    Boolean(currentPath?.startsWith(`${newsHref}/`));
  const items: PublicNavTreeNode[] = [
    {
      kind: "link",
      href: newsHref,
      label: t("publicNews.title"),
      current: newsCurrent,
    },
  ];
  return {
    label: t("shell.mainNavigation"),
    openMenuLabel: t("shell.openMenu"),
    closeMenuLabel: t("shell.closeMenu"),
    items,
    utilityLinks: [],
  };
}

function staticFallbackFooter(t: Translator, locale: string): PublicFooter {
  return {
    identity: t("app.name"),
    groups: [
      {
        heading: t("shell.footerImportant"),
        links: [
          {
            kind: "link",
            href: `/${locale}/news`,
            label: t("publicNews.title"),
          },
        ],
      },
      {
        heading: t("shell.footerPortal"),
        links: [
          {
            kind: "link",
            href: `/${locale}`,
            label: t("shell.home"),
          },
        ],
      },
    ],
    copyright: t("shell.copyright", {
      year: new Date().getFullYear(),
    }),
  };
}

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

function footerFromResolved(
  t: Translator,
  locale: string,
  groups: PublicLinkGroup[],
  live: PublicSiteSettingsShell | null,
): PublicFooter {
  const base = staticFallbackFooter(t, locale);
  base.groups = groups.length ? groups : base.groups;
  return mergeFooter(base, live);
}

/** LIVE CMS navigation when published; otherwise safe static shell baseline (IMP-16). */
export async function resolvePublicChrome(
  t: Translator,
  locale: string,
  options: PublicChromeOptions,
) {
  const other = locale === "ar" ? "en" : "ar";
  const contentLocale = locale === "en" ? "en" : "ar";
  const currentPath = options.currentPath ?? null;

  const liveDraft =
    options.previewNavigationDraft !== undefined
      ? options.previewNavigationDraft
      : await resolveLiveNavigationDraft();

  let navigation: PublicNavRegion;
  let footerGroups: PublicLinkGroup[] = [];

  if (liveDraft) {
    const resolved = await resolvePublicNavigation(liveDraft, {
      locale: contentLocale,
      currentPath,
    });
    navigation = {
      label: t("shell.mainNavigation"),
      openMenuLabel: t("shell.openMenu"),
      closeMenuLabel: t("shell.closeMenu"),
      items: resolved.main,
      utilityLinks: resolved.utility,
    };
    footerGroups = resolved.footer
      .filter((group) => group.children.length > 0)
      .map((group) => ({
        heading: group.label,
        links: flattenFooterLinks(group.children),
      }));
  } else {
    navigation = staticFallbackNavigation(t, locale, currentPath);
  }

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
    footer: footerFromResolved(t, locale, footerGroups, live),
  };
}

function flattenFooterLinks(
  nodes: readonly PublicNavTreeNode[],
): PublicNavTreeLink[] {
  const links: PublicNavTreeLink[] = [];
  for (const node of nodes) {
    if (node.kind === "link") links.push(node);
    if (node.kind === "group") links.push(...flattenFooterLinks(node.children));
  }
  return links;
}
