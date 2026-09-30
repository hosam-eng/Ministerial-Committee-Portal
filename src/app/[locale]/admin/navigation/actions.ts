"use server";

import { redirect } from "next/navigation";

import {
  AccessDeniedError,
  PERMISSIONS,
  requireBackoffice,
  type PermissionKey,
} from "@/modules/identity";
import {
  PublicNavigationError,
  approvePublicNavigation,
  publishPublicNavigation,
  restorePublicNavigationRevision,
  returnPublicNavigation,
  savePublicNavigationDraft,
  startEditingPublicNavigation,
  submitPublicNavigation,
  unpublishPublicNavigation,
  validateNavigationDraft,
  type NavigationEditorState,
} from "@/modules/public-navigation";

async function actor(locale: string, permission: PermissionKey) {
  const gate = await requireBackoffice(locale, permission);
  if (gate.status === "denied") throw new AccessDeniedError(permission);
  return gate.user.id;
}

function expected(formData: FormData) {
  const version = Number(formData.get("editVersion"));
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new PublicNavigationError("CONCURRENT_MODIFICATION");
  }
  return version;
}

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function errorCode(error: unknown) {
  if (error instanceof AccessDeniedError) return "denied";
  if (error instanceof PublicNavigationError) return error.code;
  throw error;
}

function path(locale: string) {
  return `/${locale}/admin/navigation`;
}

export async function saveNavigationAction(
  previous: NavigationEditorState,
  formData: FormData,
): Promise<NavigationEditorState> {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  try {
    const userId = await actor(locale, PERMISSIONS.NAVIGATION_EDIT);
    const draft = JSON.parse(field(formData, "draft")) as unknown;
    validateNavigationDraft(draft);
    const result = await savePublicNavigationDraft(
      userId,
      expected(formData),
      draft,
    );
    return { error: null, saved: true, editVersion: result.editVersion };
  } catch (error) {
    return {
      error: errorCode(error),
      saved: false,
      editVersion: previous.editVersion,
    };
  }
}

export async function submitNavigationAction(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  try {
    const userId = await actor(locale, PERMISSIONS.NAVIGATION_EDIT);
    const draft = JSON.parse(field(formData, "draft")) as unknown;
    validateNavigationDraft(draft);
    const version = expected(formData);
    const saved = await savePublicNavigationDraft(userId, version, draft);
    await submitPublicNavigation(userId, saved.editVersion);
  } catch (error) {
    redirect(`${path(locale)}?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect(`${path(locale)}?status=submitted`);
}

export async function navigationWorkflowAction(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  const operation = field(formData, "operation");
  try {
    const userId = await actor(
      locale,
      operation === "approve" || operation === "return"
        ? PERMISSIONS.NAVIGATION_REVIEW
        : operation === "publish" || operation === "unpublish"
          ? PERMISSIONS.NAVIGATION_PUBLISH
          : PERMISSIONS.NAVIGATION_EDIT,
    );
    if (operation === "approve") {
      await approvePublicNavigation(userId);
      redirect(`${path(locale)}?status=approved`);
    }
    if (operation === "return") {
      await returnPublicNavigation(userId, field(formData, "comment"));
      redirect(`${path(locale)}?status=returned`);
    }
    if (operation === "publish") {
      await publishPublicNavigation(userId);
      redirect(`${path(locale)}?status=published`);
    }
    if (operation === "unpublish") {
      await unpublishPublicNavigation(userId, field(formData, "reason"));
      redirect(`${path(locale)}?status=unpublished`);
    }
    if (operation === "edit") {
      await startEditingPublicNavigation(userId);
      redirect(`${path(locale)}?status=editing`);
    }
    if (operation === "restore") {
      await restorePublicNavigationRevision(
        userId,
        field(formData, "revisionId"),
      );
      redirect(`${path(locale)}?status=restored`);
    }
  } catch (error) {
    redirect(`${path(locale)}?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect(`${path(locale)}?error=generic`);
}
