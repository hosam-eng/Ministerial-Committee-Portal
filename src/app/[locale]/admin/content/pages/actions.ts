"use server";

import { redirect } from "next/navigation";

import {
  AccessDeniedError,
  PERMISSIONS,
  requireBackoffice,
  type PermissionKey,
} from "@/modules/identity";
import {
  ManagedPageError,
  approveManagedPage,
  createManagedPage,
  publishManagedPage,
  restoreManagedPageRevision,
  returnManagedPage,
  saveManagedPageDraft,
  startEditingManagedPage,
  submitManagedPage,
  unpublishManagedPage,
  validateManagedPageDraft,
} from "@/modules/managed-pages";

import type { ManagedPageEditorState } from "@/modules/managed-pages/editor";

function pageId(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  const id = String(formData.get("pageId") ?? "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new ManagedPageError("PAGE_NOT_FOUND");
  }
  return { locale, id, path: `/${locale}/admin/content/pages/${id}` };
}

async function actor(locale: string, permission: PermissionKey) {
  const gate = await requireBackoffice(locale, permission);
  if (gate.status === "denied") throw new AccessDeniedError(permission);
  return gate.user.id;
}

function expected(formData: FormData) {
  const version = Number(formData.get("editVersion"));
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new ManagedPageError("CONCURRENT_MODIFICATION");
  }
  return version;
}

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function errorCode(error: unknown) {
  if (error instanceof AccessDeniedError) return "denied";
  if (error instanceof ManagedPageError) return error.code;
  throw error;
}

export async function createManagedPageAction(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  let id: string;
  try {
    const userId = await actor(locale, PERMISSIONS.MANAGED_PAGES_CREATE);
    ({ pageId: id } = await createManagedPage(userId));
  } catch (error) {
    redirect(
      `/${locale}/admin/content/pages/new?error=${encodeURIComponent(errorCode(error))}`,
    );
  }
  redirect(`/${locale}/admin/content/pages/${id}`);
}

export async function saveManagedPageAction(
  previous: ManagedPageEditorState,
  formData: FormData,
): Promise<ManagedPageEditorState> {
  const { locale, id } = pageId(formData);
  try {
    const userId = await actor(locale, PERMISSIONS.MANAGED_PAGES_EDIT);
    const draft = JSON.parse(field(formData, "draft")) as unknown;
    validateManagedPageDraft(draft);
    const result = await saveManagedPageDraft(
      userId,
      id,
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

export async function submitManagedPageAction(
  previous: ManagedPageEditorState,
  formData: FormData,
): Promise<ManagedPageEditorState> {
  const { locale, id, path } = pageId(formData);
  try {
    const userId = await actor(locale, PERMISSIONS.MANAGED_PAGES_EDIT);
    await submitManagedPage(userId, id, expected(formData));
  } catch (error) {
    return {
      error: errorCode(error),
      saved: false,
      editVersion: previous.editVersion,
    };
  }
  redirect(`${path}?status=submit`);
}

export async function managedPageWorkflowAction(formData: FormData) {
  const { locale, id, path } = pageId(formData);
  const operation = field(formData, "operation");
  const permission: PermissionKey =
    operation === "return" || operation === "approve"
      ? PERMISSIONS.MANAGED_PAGES_REVIEW
      : operation === "publish" || operation === "unpublish"
        ? PERMISSIONS.MANAGED_PAGES_PUBLISH
        : PERMISSIONS.MANAGED_PAGES_EDIT;
  try {
    const userId = await actor(locale, permission);
    switch (operation) {
      case "return":
        await returnManagedPage(userId, id, field(formData, "comment"));
        break;
      case "approve":
        await approveManagedPage(userId, id);
        break;
      case "publish":
        await publishManagedPage(userId, id);
        break;
      case "unpublish":
        await unpublishManagedPage(userId, id, field(formData, "reason"));
        break;
      case "edit":
        await startEditingManagedPage(userId, id);
        break;
      case "restore":
        await restoreManagedPageRevision(
          userId,
          id,
          field(formData, "revisionId"),
        );
        break;
      default:
        throw new ManagedPageError("INVALID_WORKFLOW_STATE");
    }
  } catch (error) {
    redirect(`${path}?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect(`${path}?status=${encodeURIComponent(operation)}`);
}
