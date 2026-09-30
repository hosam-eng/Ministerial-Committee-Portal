import { PublicNavigationError } from "./errors";
import type { NavigationItemDraft, NavigationLocation } from "./draft";

export const NAVIGATION_MAX_DEPTH = 3;

type ItemNode = NavigationItemDraft & { depth: number };

function byLocation(
  items: NavigationItemDraft[],
  location: NavigationLocation,
) {
  return items.filter((item) => item.location === location);
}

function childrenOf(
  items: NavigationItemDraft[],
  parentItemKey: string | null,
) {
  return items
    .filter((item) => item.parentItemKey === parentItemKey)
    .sort((a, b) => a.siblingOrder - b.siblingOrder);
}

function siblingSetParentKeys(items: NavigationItemDraft[]) {
  const parentKeys = new Set<string | null>([null]);
  for (const item of items) {
    if (item.itemType === "GROUP") {
      parentKeys.add(item.itemKey);
    }
  }
  return parentKeys;
}

/** Reassign contiguous 0..N-1 orders within each location + parent set. */
export function normalizeLocationSiblingOrders(
  items: NavigationItemDraft[],
  location: NavigationLocation,
): NavigationItemDraft[] {
  const next = items.map((item) => ({ ...item }));
  const scoped = byLocation(next, location);

  for (const parentKey of siblingSetParentKeys(scoped)) {
    const siblings = childrenOf(scoped, parentKey);
    siblings.forEach((sibling, index) => {
      const row = next.find((item) => item.itemKey === sibling.itemKey);
      if (row) row.siblingOrder = index;
    });
  }

  return next;
}

export function nextSiblingOrder(
  items: NavigationItemDraft[],
  location: NavigationLocation,
  parentItemKey: string | null,
): number {
  return childrenOf(byLocation(items, location), parentItemKey).length;
}

export function walkLocationTree(
  items: NavigationItemDraft[],
  location: NavigationLocation,
): Array<NavigationItemDraft & { depth: number }> {
  const scoped = byLocation(items, location);
  const result: Array<NavigationItemDraft & { depth: number }> = [];

  function walk(parentKey: string | null, depth: number) {
    for (const item of childrenOf(scoped, parentKey)) {
      result.push({ ...item, depth });
      if (item.itemType === "GROUP") {
        walk(item.itemKey, depth + 1);
      }
    }
  }

  walk(null, 1);
  return result;
}

export function canMoveItem(
  items: NavigationItemDraft[],
  location: NavigationLocation,
  itemKey: string,
  direction: "up" | "down",
): boolean {
  const scoped = byLocation(items, location);
  const target = scoped.find((item) => item.itemKey === itemKey);
  if (!target) return false;
  const siblings = childrenOf(scoped, target.parentItemKey);
  const index = siblings.findIndex((item) => item.itemKey === itemKey);
  if (index < 0) return false;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  return swapIndex >= 0 && swapIndex < siblings.length;
}

export function reparentItem(
  items: NavigationItemDraft[],
  location: NavigationLocation,
  itemKey: string,
  newParentItemKey: string | null,
): NavigationItemDraft[] {
  const next = items.map((item) => ({ ...item }));
  const scoped = byLocation(next, location);
  const target = scoped.find((item) => item.itemKey === itemKey);
  if (!target) throw new PublicNavigationError("NOT_FOUND");

  if (target.parentItemKey === newParentItemKey) {
    return next;
  }

  if (newParentItemKey) {
    if (newParentItemKey === itemKey) {
      throw new PublicNavigationError("INVALID_HIERARCHY");
    }
    const parent = scoped.find((row) => row.itemKey === newParentItemKey);
    if (
      !parent ||
      parent.itemType !== "GROUP" ||
      parent.location !== location
    ) {
      throw new PublicNavigationError("INVALID_PARENT");
    }
    let cursor: string | null = newParentItemKey;
    while (cursor) {
      if (cursor === itemKey) {
        throw new PublicNavigationError("INVALID_HIERARCHY");
      }
      cursor =
        scoped.find((row) => row.itemKey === cursor)?.parentItemKey ?? null;
    }
  }

  const row = next.find((item) => item.itemKey === itemKey);
  if (!row) throw new PublicNavigationError("NOT_FOUND");
  row.parentItemKey = newParentItemKey;

  const normalized = normalizeLocationSiblingOrders(next, location);
  validateNavigationHierarchy(normalized, location);
  return normalized;
}

export function removeNavigationItems(
  items: NavigationItemDraft[],
  location: NavigationLocation,
  removeKeys: ReadonlySet<string>,
): NavigationItemDraft[] {
  const next = items.filter((item) => !removeKeys.has(item.itemKey));
  return normalizeLocationSiblingOrders(next, location);
}

export function computeDepth(
  items: NavigationItemDraft[],
  itemKey: string,
): number {
  const map = new Map(items.map((item) => [item.itemKey, item]));
  let depth = 0;
  let current = map.get(itemKey);
  const seen = new Set<string>();
  while (current?.parentItemKey) {
    if (seen.has(current.itemKey)) {
      throw new PublicNavigationError("INVALID_HIERARCHY");
    }
    seen.add(current.itemKey);
    depth += 1;
    current = map.get(current.parentItemKey);
  }
  return depth + 1;
}

export function validateNavigationHierarchy(
  items: NavigationItemDraft[],
  location: NavigationLocation,
): void {
  const scoped = byLocation(items, location);
  const keys = new Set(scoped.map((item) => item.itemKey));
  if (keys.size !== scoped.length) {
    throw new PublicNavigationError("DUPLICATE_ITEM_KEY");
  }

  for (const item of scoped) {
    if (item.parentItemKey) {
      if (item.parentItemKey === item.itemKey) {
        throw new PublicNavigationError("INVALID_HIERARCHY");
      }
      const parent = scoped.find((row) => row.itemKey === item.parentItemKey);
      if (!parent) {
        throw new PublicNavigationError("INVALID_PARENT");
      }
      if (parent.itemType !== "GROUP") {
        throw new PublicNavigationError("INVALID_PARENT");
      }
      if (parent.location !== item.location) {
        throw new PublicNavigationError("INVALID_PARENT");
      }
    }
    const depth = computeDepth(scoped, item.itemKey);
    if (depth > NAVIGATION_MAX_DEPTH) {
      throw new PublicNavigationError("MAX_DEPTH_EXCEEDED");
    }
  }

  for (const item of scoped) {
    if (!item.parentItemKey) continue;
    const ancestors = new Set<string>();
    let cursor = item.parentItemKey;
    while (cursor) {
      if (cursor === item.itemKey || ancestors.has(cursor)) {
        throw new PublicNavigationError("INVALID_HIERARCHY");
      }
      ancestors.add(cursor);
      const parent = scoped.find((row) => row.itemKey === cursor);
      cursor = parent?.parentItemKey ?? "";
    }
  }

  const roots = childrenOf(scoped, null);
  for (let index = 0; index < roots.length; index += 1) {
    if (roots[index].siblingOrder !== index) {
      throw new PublicNavigationError("INVALID_ORDER");
    }
  }

  for (const group of scoped.filter((row) => row.itemType === "GROUP")) {
    const kids = childrenOf(scoped, group.itemKey);
    for (let index = 0; index < kids.length; index += 1) {
      if (kids[index].siblingOrder !== index) {
        throw new PublicNavigationError("INVALID_ORDER");
      }
    }
  }
}

export function flattenLocationTree(
  items: NavigationItemDraft[],
  location: NavigationLocation,
): ItemNode[] {
  validateNavigationHierarchy(items, location);
  const scoped = byLocation(items, location);
  const result: ItemNode[] = [];

  function walk(parentKey: string | null, depth: number) {
    for (const item of childrenOf(scoped, parentKey)) {
      result.push({ ...item, depth });
      if (item.itemType === "GROUP") walk(item.itemKey, depth + 1);
    }
  }
  walk(null, 1);
  return result;
}

export function moveItem(
  items: NavigationItemDraft[],
  location: NavigationLocation,
  itemKey: string,
  direction: "up" | "down",
): NavigationItemDraft[] {
  validateNavigationHierarchy(items, location);
  const scoped = byLocation(items, location);
  const target = scoped.find((item) => item.itemKey === itemKey);
  if (!target) throw new PublicNavigationError("NOT_FOUND");
  const siblings = childrenOf(scoped, target.parentItemKey);
  const index = siblings.findIndex((item) => item.itemKey === itemKey);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (!canMoveItem(items, location, itemKey, direction)) {
    return items;
  }
  const next = items.map((item) => ({ ...item }));
  const a = siblings[index];
  const b = siblings[swapIndex];
  for (const row of next) {
    if (row.itemKey === a.itemKey) row.siblingOrder = b.siblingOrder;
    if (row.itemKey === b.itemKey) row.siblingOrder = a.siblingOrder;
  }
  validateNavigationHierarchy(next, location);
  return next;
}
