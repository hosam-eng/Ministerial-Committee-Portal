"use server";

import { redirect } from "next/navigation";

import {
  AccessDeniedError,
  PERMISSIONS,
  requireBackoffice,
  type PermissionKey,
} from "@/modules/identity";
import {
  HomepageError,
  approveHomepage,
  publishHomepage,
  restoreHomepageRevision,
  returnHomepage,
  saveHomepageDraft,
  startEditingHomepage,
  submitHomepage,
  unpublishHomepage,
  validateHomepageDraft,
  type HomepageEditorState,
} from "@/modules/homepage";

async function actor(locale: string, permission: PermissionKey) {
  const gate = await requireBackoffice(locale, permission);
  if (gate.status === "denied") throw new AccessDeniedError(permission);
  return gate.user.id;
}

function expected(formData: FormData) {
  const version = Number(formData.get("editVersion"));
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new HomepageError("CONCURRENT_MODIFICATION");
  }
  return version;
}

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function errorCode(error: unknown) {
  if (error instanceof AccessDeniedError) return "denied";
  if (error instanceof HomepageError) return error.code;
  throw error;
}

function path(locale: string) {
  return `/${locale}/admin/homepage`;
}

export async function saveHomepageAction(
  previous: HomepageEditorState,
  formData: FormData,
): Promise<HomepageEditorState> {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  try {
    const userId = await actor(locale, PERMISSIONS.HOMEPAGE_EDIT);
    const draft = JSON.parse(field(formData, "draft")) as unknown;
    validateHomepageDraft(draft);
    const result = await saveHomepageDraft(userId, expected(formData), draft);
    return { error: null, saved: true, editVersion: result.editVersion };
  } catch (error) {
    return {
      error: errorCode(error),
      saved: false,
      editVersion: previous.editVersion,
    };
  }
}

export async function submitHomepageAction(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  try {
    const userId = await actor(locale, PERMISSIONS.HOMEPAGE_EDIT);
    const draft = JSON.parse(field(formData, "draft")) as unknown;
    validateHomepageDraft(draft);
    const version = expected(formData);
    const saved = await saveHomepageDraft(userId, version, draft);
    await submitHomepage(userId, saved.editVersion);
  } catch (error) {
    redirect(`${path(locale)}?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect(`${path(locale)}?status=submitted`);
}

export async function homepageWorkflowAction(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  const operation = field(formData, "operation");
  try {
    const userId = await actor(
      locale,
      operation === "approve" || operation === "return"
        ? PERMISSIONS.HOMEPAGE_REVIEW
        : operation === "publish" || operation === "unpublish"
          ? PERMISSIONS.HOMEPAGE_PUBLISH
          : PERMISSIONS.HOMEPAGE_EDIT,
    );
    if (operation === "approve") {
      await approveHomepage(userId);
      redirect(`${path(locale)}?status=approved`);
    }
    if (operation === "return") {
      await returnHomepage(userId, field(formData, "comment"));
      redirect(`${path(locale)}?status=returned`);
    }
    if (operation === "publish") {
      await publishHomepage(userId);
      redirect(`${path(locale)}?status=published`);
    }
    if (operation === "unpublish") {
      await unpublishHomepage(userId, field(formData, "reason"));
      redirect(`${path(locale)}?status=unpublished`);
    }
    if (operation === "edit") {
      await startEditingHomepage(userId);
      redirect(`${path(locale)}?status=editing`);
    }
    if (operation === "restore") {
      await restoreHomepageRevision(userId, field(formData, "revisionId"));
      redirect(`${path(locale)}?status=restored`);
    }
  } catch (error) {
    redirect(`${path(locale)}?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect(`${path(locale)}?error=generic`);
}
