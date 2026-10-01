import { resolveManagedPageNavigationTarget } from "@/modules/managed-pages";

import type {
  ContentTargetPort,
  ContentTargetResolution,
} from "./content-target-port";

export const managedPageContentTargetPort: ContentTargetPort = {
  async resolve(kind, targetId, locale) {
    if (kind !== "MANAGED_PAGE") {
      return {
        available: false,
        href: null,
        defaultLabelAr: null,
        defaultLabelEn: null,
      };
    }
    const target = await resolveManagedPageNavigationTarget(targetId);
    if (!target) {
      return {
        available: false,
        href: null,
        defaultLabelAr: null,
        defaultLabelEn: null,
      };
    }
    const href = locale === "en" ? target.hrefEn : target.hrefAr;
    const resolution: ContentTargetResolution = {
      available: target.isPubliclyAvailable && Boolean(href),
      href: href ?? null,
      defaultLabelAr: target.titleAr || null,
      defaultLabelEn: target.titleEn || null,
    };
    return resolution;
  },
};
