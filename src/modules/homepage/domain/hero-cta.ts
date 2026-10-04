import { HomepageError } from "./errors";
import { validateHomepageExternalUrl } from "./external-url";
import {
  isHomepageCtaSystemRouteKey,
  parseHomepageCtaSystemRouteKey,
} from "./system-routes";
import type {
  HomepageContentTargetKind,
  HomepageCtaTargetType,
} from "./sections";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type HomepageHeroCtaDraft = {
  ctaEnabled: boolean;
  ctaTargetType: HomepageCtaTargetType | "";
  systemRouteKey: string;
  contentTargetKind: HomepageContentTargetKind | "";
  contentTargetId: string;
  externalUrl: string;
};

/** UI may enable CTA before persisting target type; default to SYSTEM_ROUTE/HOME. */
/** Clears fields incompatible with the new target type (editor draft boundary). */
export function patchHomepageHeroCtaForTargetTypeChange(
  cta: HomepageHeroCtaDraft,
  ctaTargetType: HomepageCtaTargetType,
): Partial<HomepageHeroCtaDraft> {
  switch (ctaTargetType) {
    case "SYSTEM_ROUTE":
      return {
        ctaTargetType,
        systemRouteKey: cta.systemRouteKey,
        contentTargetKind: "",
        contentTargetId: "",
        externalUrl: "",
      };
    case "CONTENT_ROUTE":
      return {
        ctaTargetType,
        systemRouteKey: "",
        contentTargetKind: cta.contentTargetKind,
        contentTargetId: cta.contentTargetId,
        externalUrl: "",
      };
    case "EXTERNAL_LINK":
      return {
        ctaTargetType,
        systemRouteKey: "",
        contentTargetKind: "",
        contentTargetId: "",
        externalUrl: cta.externalUrl,
      };
  }
}

export function coalesceHomepageHeroCtaDraft(
  cta: HomepageHeroCtaDraft,
): HomepageHeroCtaDraft {
  if (!cta.ctaEnabled) return cta;
  let next = cta;
  if (
    next.ctaTargetType !== "SYSTEM_ROUTE" &&
    next.ctaTargetType !== "CONTENT_ROUTE" &&
    next.ctaTargetType !== "EXTERNAL_LINK"
  ) {
    next = { ...next, ctaTargetType: "SYSTEM_ROUTE" };
  }
  if (next.ctaTargetType === "SYSTEM_ROUTE" && !next.systemRouteKey.trim()) {
    next = { ...next, systemRouteKey: "HOME" };
  }
  return next;
}

export function validateHomepageHeroCta(
  cta: HomepageHeroCtaDraft,
  strict: boolean,
): HomepageHeroCtaDraft {
  cta = coalesceHomepageHeroCtaDraft(cta);
  if (!cta.ctaEnabled) {
    return {
      ctaEnabled: false,
      ctaTargetType: "",
      systemRouteKey: "",
      contentTargetKind: "",
      contentTargetId: "",
      externalUrl: "",
    };
  }
  const targetType = cta.ctaTargetType;
  if (
    targetType !== "SYSTEM_ROUTE" &&
    targetType !== "CONTENT_ROUTE" &&
    targetType !== "EXTERNAL_LINK"
  ) {
    throw new HomepageError("INVALID_CTA");
  }
  switch (targetType) {
    case "SYSTEM_ROUTE": {
      const key = cta.systemRouteKey.trim();
      if (strict && !key) throw new HomepageError("INVALID_SYSTEM_ROUTE");
      if (key) {
        parseHomepageCtaSystemRouteKey(key);
        if (!isHomepageCtaSystemRouteKey(key)) {
          throw new HomepageError("INVALID_SYSTEM_ROUTE");
        }
      }
      if (cta.contentTargetId.trim() || cta.externalUrl.trim()) {
        throw new HomepageError("INVALID_CTA");
      }
      return {
        ctaEnabled: true,
        ctaTargetType: "SYSTEM_ROUTE",
        systemRouteKey: key,
        contentTargetKind: "",
        contentTargetId: "",
        externalUrl: "",
      };
    }
    case "CONTENT_ROUTE": {
      if (strict) {
        if (cta.contentTargetKind !== "MANAGED_PAGE") {
          throw new HomepageError("INVALID_CONTENT_TARGET");
        }
        if (!UUID.test(cta.contentTargetId.trim())) {
          throw new HomepageError("INVALID_CONTENT_TARGET");
        }
      }
      if (cta.systemRouteKey.trim() || cta.externalUrl.trim()) {
        throw new HomepageError("INVALID_CTA");
      }
      return {
        ctaEnabled: true,
        ctaTargetType: "CONTENT_ROUTE",
        systemRouteKey: "",
        contentTargetKind:
          cta.contentTargetKind === "MANAGED_PAGE" ? "MANAGED_PAGE" : "",
        contentTargetId: cta.contentTargetId.trim(),
        externalUrl: "",
      };
    }
    case "EXTERNAL_LINK": {
      let href = cta.externalUrl;
      if (strict || href.trim()) {
        try {
          href = validateHomepageExternalUrl(href);
        } catch {
          throw new HomepageError("INVALID_EXTERNAL_URL");
        }
      }
      if (cta.systemRouteKey.trim() || cta.contentTargetId.trim()) {
        throw new HomepageError("INVALID_CTA");
      }
      return {
        ctaEnabled: true,
        ctaTargetType: "EXTERNAL_LINK",
        systemRouteKey: "",
        contentTargetKind: "",
        contentTargetId: "",
        externalUrl: href,
      };
    }
    default:
      throw new HomepageError("INVALID_CTA");
  }
}
