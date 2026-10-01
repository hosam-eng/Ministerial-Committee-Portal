import {
  coalesceHomepageHeroCtaDraft,
  type HomepageHeroCtaDraft,
} from "../domain/hero-cta";
import {
  isHomepageCtaSystemRouteKey,
  resolveHomepageCtaSystemRoutePath,
} from "../domain/system-routes";
import type { ContentTargetPort } from "./content-target-port";
import { managedPageContentTargetPort } from "./managed-page-content-target-port";

export type ResolvedHeroCta = {
  label: string;
  href: string;
  external?: boolean;
};

type ResolveOptions = {
  locale: "ar" | "en";
  label: string;
  strictPublish?: boolean;
  contentPort?: ContentTargetPort;
};

export async function resolveHomepageHeroCta(
  cta: HomepageHeroCtaDraft,
  options: ResolveOptions,
): Promise<ResolvedHeroCta | null> {
  cta = coalesceHomepageHeroCtaDraft(cta);
  if (!cta.ctaEnabled) return null;
  const { locale, label, strictPublish, contentPort } = options;
  switch (cta.ctaTargetType) {
    case "SYSTEM_ROUTE": {
      const key = cta.systemRouteKey.trim();
      if (!key || !isHomepageCtaSystemRouteKey(key)) {
        if (strictPublish) throw new Error("UNAVAILABLE_TARGET");
        return null;
      }
      const href = resolveHomepageCtaSystemRoutePath(key, locale);
      if (!label.trim()) return null;
      return { label: label.trim(), href };
    }
    case "CONTENT_ROUTE": {
      if (
        cta.contentTargetKind !== "MANAGED_PAGE" ||
        !cta.contentTargetId.trim()
      ) {
        if (strictPublish) throw new Error("UNAVAILABLE_TARGET");
        return null;
      }
      const port = contentPort ?? managedPageContentTargetPort;
      const target = await port.resolve(
        "MANAGED_PAGE",
        cta.contentTargetId.trim(),
        locale,
      );
      if (!target.available || !target.href) {
        if (strictPublish) throw new Error("UNAVAILABLE_TARGET");
        return null;
      }
      if (!label.trim()) return null;
      return { label: label.trim(), href: target.href };
    }
    case "EXTERNAL_LINK": {
      const href = cta.externalUrl.trim();
      if (!href || !label.trim()) return null;
      return { label: label.trim(), href, external: true };
    }
    default:
      if (strictPublish) throw new Error("UNAVAILABLE_TARGET");
      return null;
  }
}
