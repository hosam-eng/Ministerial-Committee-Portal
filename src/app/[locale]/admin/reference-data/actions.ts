"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AccessDeniedError,
  PERMISSIONS,
  requireBackoffice,
  type PermissionKey,
} from "@/modules/identity";
import {
  NewsError,
  createNewsCategory,
  deleteNewsCategory,
  setNewsCategoryActive,
  updateNewsCategory,
} from "@/modules/publishing";
import {
  ReferenceDataError,
  createGeographicArea,
  createOrganization,
  previewOrganizationDuplicates,
  createTaxonomy,
  deleteGeographicArea,
  deleteOrganization,
  deleteTaxonomy,
  isTaxonomyKind,
  referenceDataSectionFromSlug,
  setGeographicAreaActive,
  setOrganizationActive,
  setTaxonomyActive,
  updateGeographicArea,
  updateOrganization,
  updateTaxonomy,
  type TaxonomyKind,
} from "@/modules/reference-data";

type FormState = {
  error: string | null;
  nameAr?: string;
  nameEn?: string;
  similarMatches?: { nameAr: string; nameEn: string }[];
};

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function path(formData: FormData) {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const slug = field(formData, "sectionSlug");
  return `/${locale}/admin/reference-data/${slug}`;
}

function errorCode(error: unknown) {
  if (error instanceof AccessDeniedError) return "denied";
  if (error instanceof ReferenceDataError) return error.code;
  if (error instanceof NewsError) return error.code;
  throw error;
}

async function actor(locale: string, permission: PermissionKey) {
  const gate = await requireBackoffice(locale, permission);
  if (gate.status === "denied") throw new AccessDeniedError(permission);
  return gate.user.id;
}

function taxonomyKindFromSlug(slug: string): TaxonomyKind | null {
  const section = referenceDataSectionFromSlug(slug);
  if (!section || section === "newsCategory" || section === "organization") {
    return null;
  }
  if (section === "geographicArea") return null;
  return isTaxonomyKind(section) ? section : null;
}

export async function createReferenceTaxonomyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const slug = field(formData, "sectionSlug");
  const returnPath = path(formData);
  const input = {
    nameAr: field(formData, "nameAr"),
    nameEn: field(formData, "nameEn"),
  };
  try {
    if (slug === "news-categories") {
      const userId = await actor(locale, PERMISSIONS.NEWS_CATEGORIES_MANAGE);
      await createNewsCategory(userId, input);
    } else {
      const userId = await actor(
        locale,
        PERMISSIONS.REFERENCE_DATA_TAXONOMIES_MANAGE,
      );
      const kind = taxonomyKindFromSlug(slug);
      if (!kind) throw new ReferenceDataError("INVALID_KIND");
      await createTaxonomy(userId, kind, input);
    }
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function updateReferenceTaxonomyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const slug = field(formData, "sectionSlug");
  const id = field(formData, "id");
  const returnPath = path(formData);
  const input = {
    nameAr: field(formData, "nameAr"),
    nameEn: field(formData, "nameEn"),
  };
  try {
    if (slug === "news-categories") {
      const userId = await actor(locale, PERMISSIONS.NEWS_CATEGORIES_MANAGE);
      await updateNewsCategory(userId, id, input);
    } else {
      const userId = await actor(
        locale,
        PERMISSIONS.REFERENCE_DATA_TAXONOMIES_MANAGE,
      );
      const kind = taxonomyKindFromSlug(slug);
      if (!kind) throw new ReferenceDataError("INVALID_KIND");
      await updateTaxonomy(userId, kind, id, input);
    }
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function setReferenceTaxonomyActiveAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const slug = field(formData, "sectionSlug");
  const id = field(formData, "id");
  const isActive = field(formData, "isActive") === "true";
  const returnPath = path(formData);
  try {
    if (slug === "news-categories") {
      const userId = await actor(locale, PERMISSIONS.NEWS_CATEGORIES_MANAGE);
      await setNewsCategoryActive(userId, id, isActive);
    } else {
      const userId = await actor(
        locale,
        PERMISSIONS.REFERENCE_DATA_TAXONOMIES_MANAGE,
      );
      const kind = taxonomyKindFromSlug(slug);
      if (!kind) throw new ReferenceDataError("INVALID_KIND");
      await setTaxonomyActive(userId, kind, id, isActive);
    }
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function deleteReferenceTaxonomyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const slug = field(formData, "sectionSlug");
  const id = field(formData, "id");
  const returnPath = path(formData);
  try {
    if (slug === "news-categories") {
      const userId = await actor(locale, PERMISSIONS.NEWS_CATEGORIES_MANAGE);
      await deleteNewsCategory(userId, id);
    } else {
      const userId = await actor(
        locale,
        PERMISSIONS.REFERENCE_DATA_TAXONOMIES_MANAGE,
      );
      const kind = taxonomyKindFromSlug(slug);
      if (!kind) throw new ReferenceDataError("INVALID_KIND");
      await deleteTaxonomy(userId, kind, id);
    }
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function createOrganizationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const returnPath = path(formData);
  const nameAr = field(formData, "nameAr");
  const nameEn = field(formData, "nameEn");
  let userId: string | undefined;
  try {
    userId = await actor(
      locale,
      PERMISSIONS.REFERENCE_DATA_ORGANIZATIONS_MANAGE,
    );
    await createOrganization(userId, {
      nameAr,
      nameEn,
      acknowledgeSimilar: field(formData, "acknowledgeSimilar") === "true",
    });
  } catch (error) {
    const code = errorCode(error);
    if (code === "SIMILAR_ORGANIZATION" && userId) {
      const matches = await previewOrganizationDuplicates(userId, {
        nameAr,
        nameEn,
      });
      return {
        error: code,
        nameAr,
        nameEn,
        similarMatches: matches.map((match) => ({
          nameAr: match.nameAr,
          nameEn: match.nameEn,
        })),
      };
    }
    return { error: code, nameAr, nameEn };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function updateOrganizationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const returnPath = path(formData);
  try {
    const userId = await actor(
      locale,
      PERMISSIONS.REFERENCE_DATA_ORGANIZATIONS_MANAGE,
    );
    await updateOrganization(userId, field(formData, "id"), {
      nameAr: field(formData, "nameAr"),
      nameEn: field(formData, "nameEn"),
    });
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function setOrganizationActiveAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const returnPath = path(formData);
  try {
    const userId = await actor(
      locale,
      PERMISSIONS.REFERENCE_DATA_ORGANIZATIONS_MANAGE,
    );
    await setOrganizationActive(
      userId,
      field(formData, "id"),
      field(formData, "isActive") === "true",
    );
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function deleteOrganizationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const returnPath = path(formData);
  try {
    const userId = await actor(
      locale,
      PERMISSIONS.REFERENCE_DATA_ORGANIZATIONS_MANAGE,
    );
    await deleteOrganization(userId, field(formData, "id"));
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function createGeographicAreaAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const returnPath = path(formData);
  const parent = field(formData, "parentId");
  try {
    const userId = await actor(
      locale,
      PERMISSIONS.REFERENCE_DATA_GEOGRAPHIC_AREAS_MANAGE,
    );
    await createGeographicArea(userId, {
      nameAr: field(formData, "nameAr"),
      nameEn: field(formData, "nameEn"),
      code: field(formData, "code") || null,
      parentId: parent || null,
    });
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function updateGeographicAreaAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const returnPath = path(formData);
  const parent = field(formData, "parentId");
  try {
    const userId = await actor(
      locale,
      PERMISSIONS.REFERENCE_DATA_GEOGRAPHIC_AREAS_MANAGE,
    );
    await updateGeographicArea(userId, field(formData, "id"), {
      nameAr: field(formData, "nameAr"),
      nameEn: field(formData, "nameEn"),
      code: field(formData, "code") || null,
      parentId: parent || null,
    });
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function setGeographicAreaActiveAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const returnPath = path(formData);
  try {
    const userId = await actor(
      locale,
      PERMISSIONS.REFERENCE_DATA_GEOGRAPHIC_AREAS_MANAGE,
    );
    await setGeographicAreaActive(
      userId,
      field(formData, "id"),
      field(formData, "isActive") === "true",
    );
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function deleteGeographicAreaAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = field(formData, "locale") === "en" ? "en" : "ar";
  const returnPath = path(formData);
  try {
    const userId = await actor(
      locale,
      PERMISSIONS.REFERENCE_DATA_GEOGRAPHIC_AREAS_MANAGE,
    );
    await deleteGeographicArea(userId, field(formData, "id"));
  } catch (error) {
    return { error: errorCode(error) };
  }
  revalidatePath(returnPath);
  redirect(returnPath);
}

export async function setReferenceTaxonomyActiveForm(formData: FormData) {
  await setReferenceTaxonomyActiveAction({ error: null }, formData);
}

export async function deleteReferenceTaxonomyForm(formData: FormData) {
  await deleteReferenceTaxonomyAction({ error: null }, formData);
}

export async function setOrganizationActiveForm(formData: FormData) {
  await setOrganizationActiveAction({ error: null }, formData);
}

export async function deleteOrganizationForm(formData: FormData) {
  await deleteOrganizationAction({ error: null }, formData);
}

export async function setGeographicAreaActiveForm(formData: FormData) {
  await setGeographicAreaActiveAction({ error: null }, formData);
}

export async function deleteGeographicAreaForm(formData: FormData) {
  await deleteGeographicAreaAction({ error: null }, formData);
}
