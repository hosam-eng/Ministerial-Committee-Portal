import { describe, expect, it } from "vitest";

import {
  normalizeComparableName,
  parseBilingualName,
} from "@/modules/reference-data/domain/bilingual-name";
import { ReferenceDataError } from "@/modules/reference-data/domain/errors";
import {
  assertNoHierarchyCycle,
  parseGeographicAreaInput,
} from "@/modules/reference-data/domain/geographic-rules";
import {
  assertOrganizationNotExactDuplicate,
  findOrganizationMatches,
} from "@/modules/reference-data/domain/organization-rules";

describe("reference-data domain rules", () => {
  it("rejects blank bilingual names", () => {
    expect(() => parseBilingualName({ nameAr: "  ", nameEn: "News" })).toThrow(
      ReferenceDataError,
    );
  });

  it("normalizes duplicate comparable names", () => {
    expect(normalizeComparableName("  Hello   World ")).toBe("hello world");
  });

  it("detects exact organization duplicates", () => {
    const matches = findOrganizationMatches(
      [{ id: "1", nameAr: "وزارة", nameEn: "Ministry", isActive: true }],
      { nameAr: "وزارة", nameEn: "Other" },
    );
    expect(matches[0]?.match).toBe("exact");
    expect(() => assertOrganizationNotExactDuplicate(matches)).toThrow(
      ReferenceDataError,
    );
  });

  it("blocks geographic hierarchy cycles", () => {
    const parentMap = new Map([
      ["b", "a"],
      ["c", "b"],
    ]);
    expect(() =>
      assertNoHierarchyCycle("d", "a", (id) => parentMap.get(id) ?? null),
    ).not.toThrow();
    expect(() =>
      assertNoHierarchyCycle("a", "c", (id) => parentMap.get(id) ?? null),
    ).toThrow(ReferenceDataError);
  });

  it("parses optional geographic code", () => {
    const parsed = parseGeographicAreaInput({
      nameAr: "الرياض",
      nameEn: "Riyadh",
      code: " ry ",
    });
    expect(parsed.code).toBe("RY");
  });
});
