import { ReferenceDataError } from "./errors";
import { normalizeReferenceName } from "./bilingual-name";

export type GeographicAreaInput = {
  nameAr: string;
  nameEn: string;
  code?: string | null;
  parentId?: string | null;
  isActive?: boolean;
};

export function normalizeGeographicCode(
  code: string | null | undefined,
): string | null {
  if (code == null) return null;
  const trimmed = code.trim();
  return trimmed.length ? trimmed.toUpperCase() : null;
}

export function assertNoSelfParent(
  id: string,
  parentId: string | null | undefined,
) {
  if (parentId && parentId === id)
    throw new ReferenceDataError("INVALID_HIERARCHY");
}

/** Walk parent pointers; detect cycles before persistence. */
export function assertNoHierarchyCycle(
  id: string,
  parentId: string | null | undefined,
  parentOf: (nodeId: string) => string | null | undefined,
) {
  assertNoSelfParent(id, parentId);
  if (!parentId) return;
  const seen = new Set<string>([id]);
  let current: string | null | undefined = parentId;
  while (current) {
    if (seen.has(current)) throw new ReferenceDataError("HIERARCHY_CYCLE");
    seen.add(current);
    current = parentOf(current) ?? null;
  }
}

export function parseGeographicAreaInput(input: GeographicAreaInput) {
  const nameAr = normalizeReferenceName(input.nameAr);
  const nameEn = normalizeReferenceName(input.nameEn);
  if (!nameAr || !nameEn) throw new ReferenceDataError("REQUIRED_FIELD");
  const code = normalizeGeographicCode(input.code);
  const parentId = input.parentId?.trim() || null;
  return {
    nameAr,
    nameEn,
    code,
    parentId,
    isActive: input.isActive ?? true,
  };
}
