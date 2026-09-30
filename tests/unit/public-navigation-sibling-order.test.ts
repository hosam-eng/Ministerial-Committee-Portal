import { describe, expect, it } from "vitest";

import {
  canMoveItem,
  moveItem,
  nextSiblingOrder,
  normalizeLocationSiblingOrders,
  removeNavigationItems,
  reparentItem,
  validateNavigationDraft,
  walkLocationTree,
  type NavigationItemDraft,
} from "@/modules/public-navigation";

const keyNews = "11111111-1111-4111-8111-111111111111";
const keyGroup = "22222222-2222-4222-8222-222222222222";
const keyPage = "33333333-3333-4333-8333-333333333333";
const keyGroupB = "44444444-4444-4444-8444-444444444444";
const pageId = "55555555-5555-4555-8555-555555555555";

function item(
  partial: Pick<
    NavigationItemDraft,
    "itemKey" | "itemType" | "parentItemKey" | "siblingOrder"
  > &
    Partial<NavigationItemDraft>,
): NavigationItemDraft {
  return {
    location: "MAIN",
    labelAr: "ع",
    labelEn: "L",
    systemRouteKey: "",
    contentTargetKind: "",
    contentTargetId: "",
    externalUrl: "",
    ...partial,
  };
}

describe("navigation sibling order", () => {
  it("assigns root orders 0..N-1 when adding items", () => {
    const first = item({
      itemKey: keyNews,
      itemType: "SYSTEM_ROUTE",
      parentItemKey: null,
      siblingOrder: 0,
      systemRouteKey: "NEWS",
    });
    expect(nextSiblingOrder([first], "MAIN", null)).toBe(1);
  });

  it("assigns first child under a group order 0", () => {
    const group = item({
      itemKey: keyGroup,
      itemType: "GROUP",
      parentItemKey: null,
      siblingOrder: 0,
    });
    expect(nextSiblingOrder([group], "MAIN", keyGroup)).toBe(0);
  });

  it("reparents root content route under group and validates", () => {
    const items = [
      item({
        itemKey: keyNews,
        itemType: "SYSTEM_ROUTE",
        parentItemKey: null,
        siblingOrder: 0,
        systemRouteKey: "NEWS",
        labelAr: "",
        labelEn: "",
      }),
      item({
        itemKey: keyGroup,
        itemType: "GROUP",
        parentItemKey: null,
        siblingOrder: 1,
      }),
      item({
        itemKey: keyPage,
        itemType: "CONTENT_ROUTE",
        parentItemKey: null,
        siblingOrder: 2,
        contentTargetKind: "MANAGED_PAGE",
        contentTargetId: pageId,
        labelAr: "",
        labelEn: "",
      }),
    ];

    const reparented = reparentItem(items, "MAIN", keyPage, keyGroup);
    expect(() =>
      validateNavigationDraft({ items: reparented }, false),
    ).not.toThrow();
    expect(
      reparented.find((row) => row.itemKey === keyPage)?.siblingOrder,
    ).toBe(0);
    expect(
      reparented.find((row) => row.itemKey === keyGroup)?.siblingOrder,
    ).toBe(1);
    expect(
      reparented.find((row) => row.itemKey === keyNews)?.siblingOrder,
    ).toBe(0);
  });

  it("reparents group child back to root", () => {
    const nested = reparentItem(
      [
        item({
          itemKey: keyNews,
          itemType: "SYSTEM_ROUTE",
          parentItemKey: null,
          siblingOrder: 0,
          systemRouteKey: "NEWS",
          labelAr: "",
          labelEn: "",
        }),
        item({
          itemKey: keyGroup,
          itemType: "GROUP",
          parentItemKey: null,
          siblingOrder: 1,
        }),
        item({
          itemKey: keyPage,
          itemType: "CONTENT_ROUTE",
          parentItemKey: keyGroup,
          siblingOrder: 0,
          contentTargetKind: "MANAGED_PAGE",
          contentTargetId: pageId,
          labelAr: "",
          labelEn: "",
        }),
      ],
      "MAIN",
      keyPage,
      null,
    );
    expect(nested.find((row) => row.itemKey === keyPage)?.siblingOrder).toBe(1);
    expect(() =>
      validateNavigationDraft({ items: nested }, false),
    ).not.toThrow();
  });

  it("reparents between groups and normalizes both sibling sets", () => {
    const items = [
      item({
        itemKey: keyGroup,
        itemType: "GROUP",
        parentItemKey: null,
        siblingOrder: 0,
        labelEn: "A",
        labelAr: "أ",
      }),
      item({
        itemKey: keyGroupB,
        itemType: "GROUP",
        parentItemKey: null,
        siblingOrder: 1,
        labelEn: "B",
        labelAr: "ب",
      }),
      item({
        itemKey: keyPage,
        itemType: "CONTENT_ROUTE",
        parentItemKey: keyGroup,
        siblingOrder: 0,
        contentTargetKind: "MANAGED_PAGE",
        contentTargetId: pageId,
        labelAr: "",
        labelEn: "",
      }),
    ];
    const moved = reparentItem(items, "MAIN", keyPage, keyGroupB);
    expect(moved.find((row) => row.itemKey === keyPage)?.parentItemKey).toBe(
      keyGroupB,
    );
    expect(moved.find((row) => row.itemKey === keyPage)?.siblingOrder).toBe(0);
    expect(() =>
      validateNavigationDraft({ items: moved }, false),
    ).not.toThrow();
  });

  it("normalizes sibling orders after deleting a middle root item", () => {
    const items = [
      item({
        itemKey: keyNews,
        itemType: "SYSTEM_ROUTE",
        parentItemKey: null,
        siblingOrder: 0,
        systemRouteKey: "NEWS",
        labelAr: "",
        labelEn: "",
      }),
      item({
        itemKey: keyGroup,
        itemType: "GROUP",
        parentItemKey: null,
        siblingOrder: 1,
      }),
      item({
        itemKey: keyPage,
        itemType: "CONTENT_ROUTE",
        parentItemKey: null,
        siblingOrder: 2,
        contentTargetKind: "MANAGED_PAGE",
        contentTargetId: pageId,
        labelAr: "",
        labelEn: "",
      }),
    ];
    const removed = removeNavigationItems(items, "MAIN", new Set([keyGroup]));
    expect(removed.find((row) => row.itemKey === keyPage)?.siblingOrder).toBe(
      1,
    );
    expect(() =>
      validateNavigationDraft({ items: removed }, false),
    ).not.toThrow();
  });

  it("moves items only within their sibling set", () => {
    const items = [
      item({
        itemKey: keyNews,
        itemType: "SYSTEM_ROUTE",
        parentItemKey: null,
        siblingOrder: 0,
        systemRouteKey: "NEWS",
        labelAr: "",
        labelEn: "",
      }),
      item({
        itemKey: keyGroup,
        itemType: "GROUP",
        parentItemKey: null,
        siblingOrder: 1,
      }),
      item({
        itemKey: keyPage,
        itemType: "CONTENT_ROUTE",
        parentItemKey: keyGroup,
        siblingOrder: 0,
        contentTargetKind: "MANAGED_PAGE",
        contentTargetId: pageId,
        labelAr: "",
        labelEn: "",
      }),
    ];
    expect(canMoveItem(items, "MAIN", keyPage, "up")).toBe(false);
    expect(canMoveItem(items, "MAIN", keyPage, "down")).toBe(false);
    expect(canMoveItem(items, "MAIN", keyNews, "up")).toBe(false);
    expect(canMoveItem(items, "MAIN", keyGroup, "down")).toBe(false);
    const moved = moveItem(items, "MAIN", keyGroup, "up");
    expect(moved.find((row) => row.itemKey === keyGroup)?.siblingOrder).toBe(0);
  });

  it("walks the tree in hierarchical order", () => {
    const items = reparentItem(
      [
        item({
          itemKey: keyNews,
          itemType: "SYSTEM_ROUTE",
          parentItemKey: null,
          siblingOrder: 0,
          systemRouteKey: "NEWS",
          labelAr: "",
          labelEn: "",
        }),
        item({
          itemKey: keyGroup,
          itemType: "GROUP",
          parentItemKey: null,
          siblingOrder: 1,
        }),
        item({
          itemKey: keyPage,
          itemType: "CONTENT_ROUTE",
          parentItemKey: null,
          siblingOrder: 2,
          contentTargetKind: "MANAGED_PAGE",
          contentTargetId: pageId,
          labelAr: "",
          labelEn: "",
        }),
      ],
      "MAIN",
      keyPage,
      keyGroup,
    );
    const order = walkLocationTree(items, "MAIN").map((row) => row.itemKey);
    expect(order).toEqual([keyNews, keyGroup, keyPage]);
    expect(walkLocationTree(items, "MAIN")[2]?.depth).toBe(2);
  });

  it("accepts strict submit validation after reparent normalization", () => {
    const items = reparentItem(
      [
        item({
          itemKey: keyNews,
          itemType: "SYSTEM_ROUTE",
          parentItemKey: null,
          siblingOrder: 0,
          systemRouteKey: "NEWS",
          labelAr: "أ",
          labelEn: "News",
        }),
        item({
          itemKey: keyGroup,
          itemType: "GROUP",
          parentItemKey: null,
          siblingOrder: 1,
          labelEn: "Group",
          labelAr: "مجموعة",
        }),
        item({
          itemKey: keyPage,
          itemType: "CONTENT_ROUTE",
          parentItemKey: null,
          siblingOrder: 2,
          contentTargetKind: "MANAGED_PAGE",
          contentTargetId: pageId,
          labelAr: "صفحة",
          labelEn: "Page",
        }),
      ],
      "MAIN",
      keyPage,
      keyGroup,
    );
    expect(() => validateNavigationDraft({ items }, true)).not.toThrow();
  });

  it("rejects invalid global order before normalization", () => {
    const items = [
      item({
        itemKey: keyNews,
        itemType: "SYSTEM_ROUTE",
        parentItemKey: null,
        siblingOrder: 0,
        systemRouteKey: "NEWS",
        labelAr: "",
        labelEn: "",
      }),
      item({
        itemKey: keyGroup,
        itemType: "GROUP",
        parentItemKey: null,
        siblingOrder: 1,
      }),
      item({
        itemKey: keyPage,
        itemType: "CONTENT_ROUTE",
        parentItemKey: keyGroup,
        siblingOrder: 2,
        contentTargetKind: "MANAGED_PAGE",
        contentTargetId: pageId,
        labelAr: "",
        labelEn: "",
      }),
    ];
    expect(() => validateNavigationDraft({ items }, false)).toThrow();
    const fixed = normalizeLocationSiblingOrders(
      items.map((row) =>
        row.itemKey === keyPage
          ? { ...row, parentItemKey: keyGroup }
          : { ...row },
      ),
      "MAIN",
    );
    expect(() =>
      validateNavigationDraft({ items: fixed }, false),
    ).not.toThrow();
  });
});
