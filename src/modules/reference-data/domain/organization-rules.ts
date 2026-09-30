import {
  namesEquivalent,
  normalizeComparableName,
  normalizeReferenceName,
  parseBilingualName,
  type BilingualName,
} from "./bilingual-name";
import { ReferenceDataError } from "./errors";

export type OrganizationSearchMatch = {
  id: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  match: "exact" | "similar";
};

export function parseOrganizationNames(input: {
  nameAr: string;
  nameEn: string;
}): BilingualName {
  return parseBilingualName(input);
}

export function findOrganizationMatches(
  candidates: readonly {
    id: string;
    nameAr: string;
    nameEn: string;
    isActive: boolean;
  }[],
  input: BilingualName,
  excludeId?: string,
): OrganizationSearchMatch[] {
  const matches: OrganizationSearchMatch[] = [];
  for (const row of candidates) {
    if (excludeId && row.id === excludeId) continue;
    const exact =
      namesEquivalent(row.nameAr, input.nameAr) ||
      namesEquivalent(row.nameEn, input.nameEn);
    if (exact) {
      matches.push({ ...row, match: "exact" });
      continue;
    }
    const arSimilar =
      normalizeComparableName(row.nameAr).includes(
        normalizeComparableName(input.nameAr),
      ) ||
      normalizeComparableName(input.nameAr).includes(
        normalizeComparableName(row.nameAr),
      );
    const enSimilar =
      normalizeComparableName(row.nameEn).includes(
        normalizeComparableName(input.nameEn),
      ) ||
      normalizeComparableName(input.nameEn).includes(
        normalizeComparableName(row.nameEn),
      );
    if (arSimilar || enSimilar) {
      matches.push({ ...row, match: "similar" });
    }
  }
  return matches;
}

export function assertOrganizationNotExactDuplicate(
  matches: readonly OrganizationSearchMatch[],
) {
  if (matches.some((match) => match.match === "exact")) {
    throw new ReferenceDataError("DUPLICATE_ORGANIZATION");
  }
}

export function organizationSearchQuery(raw: string): string {
  const query = normalizeReferenceName(raw);
  if (!query) throw new ReferenceDataError("REQUIRED_FIELD");
  return query;
}
