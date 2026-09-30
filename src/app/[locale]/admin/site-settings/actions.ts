"use server";

import { redirect } from "next/navigation";

import {
  AccessDeniedError,
  PERMISSIONS,
  requireBackoffice,
  type PermissionKey,
} from "@/modules/identity";
import {
  SiteSettingsError,
  approveSiteSettings,
  publishSiteSettings,
  restoreSiteSettingsRevision,
  returnSiteSettings,
  saveSiteSettingsDraft,
  startEditingSiteSettings,
  submitSiteSettings,
  unpublishSiteSettings,
  validateSiteSettingsDraft,
  type SiteSettingsEditorState,
} from "@/modules/site-settings";

async function actor(locale: string, permission: PermissionKey) {
  const gate = await requireBackoffice(locale, permission);
  if (gate.status === "denied") throw new AccessDeniedError(permission);
  return gate.user.id;
}

function expected(formData: FormData) {
  const version = Number(formData.get("editVersion"));
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new SiteSettingsError("CONCURRENT_MODIFICATION");
  }
  return version;
}

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function errorCode(error: unknown) {
  if (error instanceof AccessDeniedError) return "denied";
  if (error instanceof SiteSettingsError) return error.code;
  throw error;
}

function path(locale: string) {
  return `/${locale}/admin/site-settings`;
}

export async function saveSiteSettingsAction(
  previous: SiteSettingsEditorState,
  formData: FormData,
): Promise<SiteSettingsEditorState> {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  try {
    const userId = await actor(locale, PERMISSIONS.SITE_SETTINGS_EDIT);
    const draft = JSON.parse(field(formData, "draft")) as unknown;
    validateSiteSettingsDraft(draft);
    const result = await saveSiteSettingsDraft(
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

export async function submitSiteSettingsAction(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  try {
    const userId = await actor(locale, PERMISSIONS.SITE_SETTINGS_EDIT);
    const draft = JSON.parse(field(formData, "draft")) as unknown;
    validateSiteSettingsDraft(draft);
    const version = expected(formData);
    const saved = await saveSiteSettingsDraft(userId, version, draft);
    await submitSiteSettings(userId, saved.editVersion);
  } catch (error) {
    redirect(`${path(locale)}?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect(`${path(locale)}?status=submitted`);
}

export async function siteSettingsWorkflowAction(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  const operation = field(formData, "operation");
  try {
    const userId = await actor(
      locale,
      operation === "approve" || operation === "return"
        ? PERMISSIONS.SITE_SETTINGS_REVIEW
        : operation === "publish" || operation === "unpublish"
          ? PERMISSIONS.SITE_SETTINGS_PUBLISH
          : PERMISSIONS.SITE_SETTINGS_EDIT,
    );
    if (operation === "approve") {
      await approveSiteSettings(userId);
      redirect(`${path(locale)}?status=approved`);
    }
    if (operation === "return") {
      await returnSiteSettings(userId, field(formData, "comment"));
      redirect(`${path(locale)}?status=returned`);
    }
    if (operation === "publish") {
      await publishSiteSettings(userId);
      redirect(`${path(locale)}?status=published`);
    }
    if (operation === "unpublish") {
      await unpublishSiteSettings(userId, field(formData, "reason"));
      redirect(`${path(locale)}?status=unpublished`);
    }
    if (operation === "edit") {
      await startEditingSiteSettings(userId);
      redirect(`${path(locale)}?status=editing`);
    }
    const revisionId = field(formData, "revisionId");
    if (operation === "restore") {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
          revisionId,
        )
      ) {
        throw new SiteSettingsError("REVISION_NOT_FOUND");
      }
      await restoreSiteSettingsRevision(userId, revisionId);
      redirect(`${path(locale)}?status=restored`);
    }
    throw new SiteSettingsError("INVALID_WORKFLOW_STATE");
  } catch (error) {
    redirect(`${path(locale)}?error=${encodeURIComponent(errorCode(error))}`);
  }
}
