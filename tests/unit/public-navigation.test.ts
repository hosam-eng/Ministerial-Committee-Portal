import { describe, expect, it } from "vitest";

import { moveItem, validateNavigationDraft } from "@/modules/public-navigation";
import { validateNavigationExternalUrl } from "@/modules/public-navigation/domain/external-url";
import { computeDepth } from "@/modules/public-navigation/domain/hierarchy";
import { resolveSystemRoutePath } from "@/modules/public-navigation/domain/system-routes";

const keyA = "11111111-1111-4111-8111-111111111111";
const keyB = "22222222-2222-4222-8222-222222222222";
const keyC = "33333333-3333-4333-8333-333333333333";
const keyD = "44444444-4444-4444-8444-444444444444";

describe("public navigation draft", () => {
  it("requires bilingual group labels when strict", () => {
    expect(() =>
      validateNavigationDraft(
        {
          items: [
            {
              itemKey: keyA,
              location: "MAIN",
              itemType: "GROUP",
              parentItemKey: null,
              siblingOrder: 0,
              labelAr: "مجموعة",
              labelEn: "",
              systemRouteKey: "",
              contentTargetKind: "",
              contentTargetId: "",
              externalUrl: "",
            },
          ],
        },
        true,
      ),
    ).toThrow();
  });

  it("enforces max depth of three", () => {
    const items = [
      {
        itemKey: keyA,
        location: "MAIN" as const,
        itemType: "GROUP" as const,
        parentItemKey: null,
        siblingOrder: 0,
        labelAr: "1",
        labelEn: "1",
        systemRouteKey: "",
        contentTargetKind: "" as const,
        contentTargetId: "",
        externalUrl: "",
      },
      {
        itemKey: keyB,
        location: "MAIN" as const,
        itemType: "GROUP" as const,
        parentItemKey: keyA,
        siblingOrder: 0,
        labelAr: "2",
        labelEn: "2",
        systemRouteKey: "",
        contentTargetKind: "" as const,
        contentTargetId: "",
        externalUrl: "",
      },
      {
        itemKey: keyC,
        location: "MAIN" as const,
        itemType: "GROUP" as const,
        parentItemKey: keyB,
        siblingOrder: 0,
        labelAr: "3",
        labelEn: "3",
        systemRouteKey: "",
        contentTargetKind: "" as const,
        contentTargetId: "",
        externalUrl: "",
      },
      {
        itemKey: keyD,
        location: "MAIN" as const,
        itemType: "SYSTEM_ROUTE" as const,
        parentItemKey: keyC,
        siblingOrder: 0,
        labelAr: "",
        labelEn: "",
        systemRouteKey: "NEWS",
        contentTargetKind: "" as const,
        contentTargetId: "",
        externalUrl: "",
      },
    ];
    expect(() => validateNavigationDraft({ items }, false)).toThrow();
    expect(computeDepth(items, keyD)).toBe(4);
  });

  it("swaps sibling order with move up", () => {
    const items = [
      {
        itemKey: keyA,
        location: "MAIN" as const,
        itemType: "SYSTEM_ROUTE" as const,
        parentItemKey: null,
        siblingOrder: 0,
        labelAr: "أ",
        labelEn: "A",
        systemRouteKey: "NEWS",
        contentTargetKind: "" as const,
        contentTargetId: "",
        externalUrl: "",
      },
      {
        itemKey: keyB,
        location: "MAIN" as const,
        itemType: "SYSTEM_ROUTE" as const,
        parentItemKey: null,
        siblingOrder: 1,
        labelAr: "ب",
        labelEn: "B",
        systemRouteKey: "HOME",
        contentTargetKind: "" as const,
        contentTargetId: "",
        externalUrl: "",
      },
    ];
    const moved = moveItem(items, "MAIN", keyB, "up");
    expect(moved.find((item) => item.itemKey === keyA)?.siblingOrder).toBe(1);
    expect(moved.find((item) => item.itemKey === keyB)?.siblingOrder).toBe(0);
  });
});

describe("system routes", () => {
  it("resolves locale-specific news paths", () => {
    expect(resolveSystemRoutePath("NEWS", "ar")).toBe("/ar/news");
    expect(resolveSystemRoutePath("NEWS", "en")).toBe("/en/news");
  });
});

describe("external urls", () => {
  it("rejects unsafe schemes", () => {
    expect(() =>
      validateNavigationExternalUrl("javascript:alert(1)"),
    ).toThrow();
  });
});
