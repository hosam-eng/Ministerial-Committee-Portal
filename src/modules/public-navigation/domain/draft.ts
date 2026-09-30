import { PublicNavigationError } from "./errors";
import { validateNavigationExternalUrl } from "./external-url";
import { validateNavigationHierarchy } from "./hierarchy";
import { isPublicSystemRouteKey, parseSystemRouteKey } from "./system-routes";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const NAVIGATION_LOCATIONS = ["MAIN", "UTILITY", "FOOTER"] as const;
export type NavigationLocation = (typeof NAVIGATION_LOCATIONS)[number];

export const NAVIGATION_ITEM_TYPES = [
  "GROUP",
  "SYSTEM_ROUTE",
  "CONTENT_ROUTE",
  "EXTERNAL_LINK",
] as const;
export type NavigationItemType = (typeof NAVIGATION_ITEM_TYPES)[number];

export const CONTENT_TARGET_KINDS = ["MANAGED_PAGE"] as const;
export type NavigationContentTargetKind = (typeof CONTENT_TARGET_KINDS)[number];

export type NavigationItemDraft = {
  itemKey: string;
  location: NavigationLocation;
  itemType: NavigationItemType;
  parentItemKey: string | null;
  siblingOrder: number;
  labelAr: string;
  labelEn: string;
  systemRouteKey: string;
  contentTargetKind: NavigationContentTargetKind | "";
  contentTargetId: string;
  externalUrl: string;
};

export type NavigationDraft = {
  items: NavigationItemDraft[];
};

function parseLocation(value: unknown): NavigationLocation | null {
  return value === "MAIN" || value === "UTILITY" || value === "FOOTER"
    ? value
    : null;
}

function parseItemType(value: unknown): NavigationItemType | null {
  return NAVIGATION_ITEM_TYPES.includes(value as NavigationItemType)
    ? (value as NavigationItemType)
    : null;
}

function parseItem(row: unknown): NavigationItemDraft | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const itemKey =
    typeof record.itemKey === "string" ? record.itemKey.trim() : "";
  if (!UUID.test(itemKey)) return null;
  const location = parseLocation(record.location);
  const itemType = parseItemType(record.itemType);
  if (!location || !itemType) return null;
  const parentRaw = record.parentItemKey;
  const parentItemKey =
    parentRaw === null || parentRaw === undefined || parentRaw === ""
      ? null
      : typeof parentRaw === "string" && UUID.test(parentRaw.trim())
        ? parentRaw.trim()
        : null;
  if (parentRaw && !parentItemKey) return null;
  const siblingOrder = Number(record.siblingOrder);
  if (!Number.isInteger(siblingOrder) || siblingOrder < 0) return null;
  return {
    itemKey,
    location,
    itemType,
    parentItemKey,
    siblingOrder,
    labelAr: typeof record.labelAr === "string" ? record.labelAr : "",
    labelEn: typeof record.labelEn === "string" ? record.labelEn : "",
    systemRouteKey:
      typeof record.systemRouteKey === "string" ? record.systemRouteKey : "",
    contentTargetKind:
      record.contentTargetKind === "MANAGED_PAGE" ? "MANAGED_PAGE" : "",
    contentTargetId:
      typeof record.contentTargetId === "string" ? record.contentTargetId : "",
    externalUrl:
      typeof record.externalUrl === "string" ? record.externalUrl : "",
  };
}

function validateItemShape(item: NavigationItemDraft, strict: boolean) {
  switch (item.itemType) {
    case "GROUP":
      if (strict) {
        if (!item.labelAr.trim() || !item.labelEn.trim()) {
          throw new PublicNavigationError("MISSING_LABEL");
        }
      }
      if (item.systemRouteKey || item.contentTargetId || item.externalUrl) {
        throw new PublicNavigationError("INVALID_ITEM_TYPE");
      }
      break;
    case "EXTERNAL_LINK":
      if (strict) {
        if (!item.labelAr.trim() || !item.labelEn.trim()) {
          throw new PublicNavigationError("MISSING_LABEL");
        }
        validateNavigationExternalUrl(item.externalUrl);
      } else if (item.externalUrl.trim()) {
        validateNavigationExternalUrl(item.externalUrl);
      }
      if (item.systemRouteKey || item.contentTargetId) {
        throw new PublicNavigationError("INVALID_ITEM_TYPE");
      }
      break;
    case "SYSTEM_ROUTE": {
      const key = item.systemRouteKey.trim();
      if (strict && !key)
        throw new PublicNavigationError("INVALID_SYSTEM_ROUTE");
      if (key && !isPublicSystemRouteKey(key)) {
        throw new PublicNavigationError("INVALID_SYSTEM_ROUTE");
      }
      if (item.contentTargetId || item.externalUrl) {
        throw new PublicNavigationError("INVALID_ITEM_TYPE");
      }
      break;
    }
    case "CONTENT_ROUTE": {
      if (strict) {
        if (item.contentTargetKind !== "MANAGED_PAGE") {
          throw new PublicNavigationError("INVALID_CONTENT_TARGET");
        }
        if (!UUID.test(item.contentTargetId.trim())) {
          throw new PublicNavigationError("INVALID_CONTENT_TARGET");
        }
      }
      if (item.systemRouteKey || item.externalUrl) {
        throw new PublicNavigationError("INVALID_ITEM_TYPE");
      }
      break;
    }
    default:
      throw new PublicNavigationError("INVALID_ITEM_TYPE");
  }
}

export function validateNavigationDraft(
  input: unknown,
  strict = false,
): NavigationDraft {
  if (!input || typeof input !== "object") {
    throw new PublicNavigationError("NOT_FOUND");
  }
  const record = input as Record<string, unknown>;
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems
    .map(parseItem)
    .filter((item): item is NavigationItemDraft => item !== null);
  if (items.length !== rawItems.length) {
    throw new PublicNavigationError("INVALID_ITEM_TYPE");
  }

  for (const location of NAVIGATION_LOCATIONS) {
    validateNavigationHierarchy(items, location);
  }

  for (const item of items) {
    validateItemShape(item, strict);
    if (item.systemRouteKey.trim()) parseSystemRouteKey(item.systemRouteKey);
  }

  return { items };
}

export function emptyNavigationDraft(): NavigationDraft {
  return { items: [] };
}
