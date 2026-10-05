"use server";

import { redirect } from "next/navigation";

import {
  AccessDeniedError,
  PERMISSIONS,
  requireBackoffice,
  type PermissionKey,
} from "@/modules/identity";
import {
  NewsError,
  newsBodyFromText,
  createNewsDraft,
  saveNewsDraft,
  submitNews,
  returnNews,
  restoreApprovedNews,
  restoreNewsRevision,
  approveNews,
  publishNews,
  republishNews,
  unpublishNews,
  startEditingNews,
  abandonNewsDraft,
  type NewsDraftInput,
  type NewsLocale,
} from "@/modules/publishing";

export type SaveState = {
  error: string | null;
  saved: boolean;
  editVersion: number;
};

export type SubmitState = { error: string | null; attemptedVersion: number };

function details(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  const id = String(formData.get("newsId") ?? "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new NewsError("NEWS_NOT_FOUND");
  return { locale, id, path: `/${locale}/admin/content/news/${id}` };
}

async function actor(locale: string, permission: PermissionKey) {
  const gate = await requireBackoffice(locale, permission);
  if (gate.status === "denied") throw new AccessDeniedError(permission);
  return gate.user.id;
}

function expected(formData: FormData) {
  const version = Number(formData.get("editVersion"));
  if (!Number.isSafeInteger(version) || version < 0)
    throw new NewsError("CONCURRENT_MODIFICATION");
  return version;
}

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function draft(formData: FormData): NewsDraftInput {
  const translations: NewsDraftInput["translations"] = {};
  for (const locale of ["ar", "en"] as NewsLocale[]) {
    const body = newsBodyFromText(field(formData, `body_${locale}`));
    const title = field(formData, `title_${locale}`);
    const slug = field(formData, `slug_${locale}`);
    const summary = field(formData, `summary_${locale}`);
    const seoTitle = field(formData, `seoTitle_${locale}`);
    const seoDescription = field(formData, `seoDescription_${locale}`);
    if (title || slug || summary || body || seoTitle || seoDescription) {
      translations[locale] = {
        title,
        slug,
        summary,
        body,
        seoTitle,
        seoDescription,
      };
    }
  }
  const displayDate = field(formData, "displayDate");
  return {
    translations,
    categoryIds: formData.getAll("categoryId").map(String),
    displayDate: displayDate || null,
  };
}

function errorCode(error: unknown) {
  if (error instanceof AccessDeniedError) return "denied";
  if (error instanceof NewsError) return error.code;
  throw error;
}

export async function createNewsAction(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "ar";
  let newsId: string;
  try {
    const userId = await actor(locale, PERMISSIONS.NEWS_CREATE);
    ({ newsId } = await createNewsDraft(userId));
  } catch (error) {
    redirect(
      `/${locale}/admin/content/news/new?error=${encodeURIComponent(errorCode(error))}`,
    );
  }
  redirect(`/${locale}/admin/content/news/${newsId}`);
}

export async function saveNewsAction(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const { locale, id } = details(formData);
  try {
    const userId = await actor(locale, PERMISSIONS.NEWS_EDIT);
    const result = await saveNewsDraft(
      userId,
      id,
      expected(formData),
      draft(formData),
    );
    return { error: null, saved: true, editVersion: result.editVersion };
  } catch (error) {
    return {
      error: errorCode(error),
      saved: false,
      editVersion: _previous.editVersion,
    };
  }
}

export async function submitNewsAction(
  _previous: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const { locale, id, path } = details(formData);
  const attemptedVersion = expected(formData);
  try {
    const userId = await actor(locale, PERMISSIONS.NEWS_EDIT);
    await submitNews(userId, id, attemptedVersion);
  } catch (error) {
    return { error: errorCode(error), attemptedVersion };
  }
  redirect(`${path}?status=submit`);
}

export async function newsWorkflowAction(formData: FormData) {
  const { locale, id, path } = details(formData);
  const operation = field(formData, "operation");
  const permission: PermissionKey =
    operation === "return" || operation === "approve"
      ? PERMISSIONS.NEWS_REVIEW
      : operation === "publish" ||
          operation === "unpublish" ||
          operation === "republish"
        ? PERMISSIONS.NEWS_PUBLISH
        : PERMISSIONS.NEWS_EDIT;
  try {
    const userId = await actor(locale, permission);
    switch (operation) {
      case "return":
        await returnNews(userId, id, field(formData, "comment"));
        break;
      case "approve":
        await approveNews(userId, id);
        break;
      case "publish":
        await publishNews(userId, id);
        break;
      case "unpublish":
        await unpublishNews(userId, id, field(formData, "reason"));
        break;
      case "edit":
        await startEditingNews(userId, id);
        break;
      case "restore": {
        const revisionId = field(formData, "revisionId");
        if (revisionId) {
          await restoreNewsRevision(userId, id, revisionId);
        } else {
          await restoreApprovedNews(userId, id);
        }
        break;
      }
      case "republish":
        await republishNews(userId, id);
        break;
      case "abandon":
        await abandonNewsDraft(userId, id);
        break;
      default:
        throw new NewsError("INVALID_WORKFLOW_STATE");
    }
  } catch (error) {
    redirect(`${path}?error=${encodeURIComponent(errorCode(error))}`);
  }
  redirect(`${path}?status=${encodeURIComponent(operation)}`);
}
