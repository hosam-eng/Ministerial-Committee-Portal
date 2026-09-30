import type { Database } from "@/platform/database";

import type { NavigationDraft, NavigationItemDraft } from "../domain/draft";
import { flattenLocationTree } from "../domain/hierarchy";
import {
  defaultSystemRouteLabels,
  isPublicSystemRouteKey,
  resolveSystemRoutePath,
} from "../domain/system-routes";
import type { ContentTargetPort } from "./content-target-port";
import { managedPageContentTargetPort } from "./managed-page-content-target-port";

export type ResolvedPublicNavLink = {
  kind: "link";
  label: string;
  href: string;
  current?: boolean;
  external?: boolean;
};

export type ResolvedPublicNavGroup = {
  kind: "group";
  label: string;
  current?: boolean;
  children: ResolvedPublicNavNode[];
};

export type ResolvedPublicNavNode =
  ResolvedPublicNavLink | ResolvedPublicNavGroup;

export type ResolvedPublicNavigation = {
  main: ResolvedPublicNavNode[];
  utility: ResolvedPublicNavLink[];
  footer: ResolvedPublicNavGroup[];
};

type ResolveOptions = {
  locale: "ar" | "en";
  currentPath?: string | null;
  strictPublish?: boolean;
  contentPort?: ContentTargetPort;
};

function labelFor(
  item: NavigationItemDraft,
  locale: "ar" | "en",
  defaults?: { ar: string; en: string },
) {
  const override = locale === "en" ? item.labelEn.trim() : item.labelAr.trim();
  if (override) return override;
  if (defaults) return locale === "en" ? defaults.en : defaults.ar;
  return "";
}

function pathMatches(href: string, currentPath?: string | null) {
  if (!currentPath) return false;
  return href === currentPath || href === `${currentPath}/`;
}

async function resolveLinkItem(
  item: NavigationItemDraft,
  options: ResolveOptions,
): Promise<ResolvedPublicNavLink | null> {
  const { locale, currentPath, strictPublish, contentPort } = options;
  switch (item.itemType) {
    case "SYSTEM_ROUTE": {
      const key = item.systemRouteKey.trim();
      if (!key || !isPublicSystemRouteKey(key)) {
        if (strictPublish) throw new Error("UNAVAILABLE_TARGET");
        return null;
      }
      const href = resolveSystemRoutePath(key, locale);
      const defaults = defaultSystemRouteLabels(key);
      const label = labelFor(item, locale, defaults);
      if (!label) return null;
      return {
        kind: "link",
        label,
        href,
        current: pathMatches(href, currentPath),
      };
    }
    case "CONTENT_ROUTE": {
      if (
        item.contentTargetKind !== "MANAGED_PAGE" ||
        !item.contentTargetId.trim()
      ) {
        if (strictPublish) throw new Error("UNAVAILABLE_TARGET");
        return null;
      }
      const port = contentPort ?? managedPageContentTargetPort;
      const target = await port.resolve(
        "MANAGED_PAGE",
        item.contentTargetId.trim(),
        locale,
      );
      if (!target.available || !target.href) {
        if (strictPublish) throw new Error("UNAVAILABLE_TARGET");
        return null;
      }
      const label = labelFor(item, locale, {
        ar: target.defaultLabelAr ?? "",
        en: target.defaultLabelEn ?? "",
      });
      if (!label) return null;
      return {
        kind: "link",
        label,
        href: target.href,
        current: pathMatches(target.href, currentPath),
      };
    }
    case "EXTERNAL_LINK": {
      const href = item.externalUrl.trim();
      if (!href) return null;
      const label = labelFor(item, locale);
      if (!label) return null;
      return {
        kind: "link",
        label,
        href,
        external: true,
      };
    }
    default:
      return null;
  }
}

async function resolveNodes(
  draft: NavigationDraft,
  location: "MAIN" | "FOOTER",
  options: ResolveOptions,
): Promise<ResolvedPublicNavNode[]> {
  const flat = flattenLocationTree(draft.items, location);
  const scoped = new Map(flat.map((item) => [item.itemKey, item]));
  const roots = flat.filter((item) => !item.parentItemKey);
  const result: ResolvedPublicNavNode[] = [];

  async function build(
    item: NavigationItemDraft,
  ): Promise<ResolvedPublicNavNode | null> {
    if (item.itemType === "GROUP") {
      const childrenFlat = flat.filter(
        (row) => row.parentItemKey === item.itemKey,
      );
      const children: ResolvedPublicNavNode[] = [];
      for (const child of childrenFlat) {
        const node = await build(child);
        if (node) children.push(node);
      }
      if (!children.length) return null;
      const label = labelFor(item, options.locale);
      if (!label) return null;
      const current = children.some(
        (child) =>
          (child.kind === "link" && child.current) ||
          (child.kind === "group" && child.current),
      );
      return { kind: "group", label, children, current: current || undefined };
    }
    return resolveLinkItem(item, options);
  }

  for (const root of roots) {
    const item = scoped.get(root.itemKey);
    if (!item) continue;
    const node = await build(item);
    if (node) result.push(node);
  }
  return result;
}

async function resolveUtility(
  draft: NavigationDraft,
  options: ResolveOptions,
): Promise<ResolvedPublicNavLink[]> {
  const flat = flattenLocationTree(draft.items, "UTILITY");
  const links: ResolvedPublicNavLink[] = [];
  for (const item of flat) {
    if (item.itemType === "GROUP") continue;
    const link = await resolveLinkItem(item, options);
    if (link) links.push(link);
  }
  return links;
}

export async function resolvePublicNavigation(
  draft: NavigationDraft,
  options: ResolveOptions,
): Promise<ResolvedPublicNavigation> {
  const main = await resolveNodes(draft, "MAIN", options);
  const utility = await resolveUtility(draft, options);
  const footerNodes = await resolveNodes(draft, "FOOTER", options);
  const footer: ResolvedPublicNavGroup[] = [];
  for (const node of footerNodes) {
    if (node.kind === "group") footer.push(node);
    if (node.kind === "link") {
      footer.push({
        kind: "group",
        label: node.label,
        children: [node],
        current: node.current,
      });
    }
  }
  return { main, utility, footer };
}

export async function assertPublishableNavigationTargets(
  draft: NavigationDraft,
  _database: Database,
  contentPort: ContentTargetPort = managedPageContentTargetPort,
): Promise<void> {
  await resolvePublicNavigation(draft, {
    locale: "ar",
    strictPublish: true,
    contentPort,
  });
  await resolvePublicNavigation(draft, {
    locale: "en",
    strictPublish: true,
    contentPort,
  });
  for (const location of ["MAIN", "UTILITY", "FOOTER"] as const) {
    const flat = flattenLocationTree(draft.items, location);
    for (const item of flat) {
      if (
        item.itemType === "SYSTEM_ROUTE" ||
        item.itemType === "CONTENT_ROUTE"
      ) {
        await resolveLinkItem(item, {
          locale: "ar",
          strictPublish: true,
          contentPort,
        });
        await resolveLinkItem(item, {
          locale: "en",
          strictPublish: true,
          contentPort,
        });
      }
    }
  }
}
