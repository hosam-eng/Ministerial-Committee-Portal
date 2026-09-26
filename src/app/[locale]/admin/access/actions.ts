"use server";

import { redirect } from "next/navigation";

import {
  AccessDeniedError,
  assignRole,
  createCustomRole,
  getAdminAuthState,
  LastAdministratorError,
  RoleValidationError,
  setCustomRoleActive,
  setCustomRolePermissions,
  unassignRole,
  updateCustomRole,
} from "@/modules/identity";

/**
 * Backoffice mutation entry points (IMP-06). Every action re-resolves
 * the session and re-checks the actor's permission inside the identity
 * service — page-level authorization is never trusted for mutations.
 * Failures redirect back with a safe localized error key.
 */

function errorKey(error: unknown): string {
  if (error instanceof AccessDeniedError) return "denied";
  if (error instanceof LastAdministratorError) return "lastAdmin";
  if (error instanceof RoleValidationError) return error.code;
  throw error;
}

async function actorOrRedirect(returnPath: string) {
  const state = await getAdminAuthState();
  if (state.status !== "authenticated") redirect(returnPath);
  return state.user.id;
}

function returnPath(formData: FormData, fallback: string): string {
  const value = formData.get("returnPath");
  // Only same-origin localized admin paths are accepted.
  if (typeof value === "string" && /^\/(ar|en)\/admin/.test(value)) {
    return value;
  }
  return fallback;
}

export async function createRoleAction(formData: FormData) {
  const back = returnPath(formData, "/ar/admin/access/roles");
  const actorId = await actorOrRedirect(back);
  try {
    await createCustomRole(actorId, {
      name: String(formData.get("name") ?? ""),
      description: (formData.get("description") as string | null) ?? null,
      permissionIds: formData.getAll("permissions").map(String),
    });
  } catch (error) {
    redirect(`${back}?error=${errorKey(error)}`);
  }
  redirect(back);
}

export async function updateRoleAction(formData: FormData) {
  const back = returnPath(formData, "/ar/admin/access/roles");
  const actorId = await actorOrRedirect(back);
  try {
    await updateCustomRole(actorId, String(formData.get("roleId")), {
      name: String(formData.get("name") ?? ""),
      description: (formData.get("description") as string | null) ?? null,
    });
    await setCustomRolePermissions(
      actorId,
      String(formData.get("roleId")),
      formData.getAll("permissions").map(String),
    );
  } catch (error) {
    redirect(`${back}?error=${errorKey(error)}`);
  }
  redirect(back);
}

export async function setRoleActiveAction(formData: FormData) {
  const back = returnPath(formData, "/ar/admin/access/roles");
  const actorId = await actorOrRedirect(back);
  try {
    await setCustomRoleActive(
      actorId,
      String(formData.get("roleId")),
      formData.get("active") === "true",
    );
  } catch (error) {
    redirect(`${back}?error=${errorKey(error)}`);
  }
  redirect(back);
}

export async function assignRoleAction(formData: FormData) {
  const back = returnPath(formData, "/ar/admin/access/users");
  const actorId = await actorOrRedirect(back);
  try {
    await assignRole(
      actorId,
      String(formData.get("userId")),
      String(formData.get("roleId")),
    );
  } catch (error) {
    redirect(`${back}?error=${errorKey(error)}`);
  }
  redirect(back);
}

export async function removeUserRoleAction(formData: FormData) {
  const back = returnPath(formData, "/ar/admin/access/users");
  const actorId = await actorOrRedirect(back);
  try {
    await unassignRole(
      actorId,
      String(formData.get("userId")),
      String(formData.get("roleId")),
    );
  } catch (error) {
    redirect(`${back}?error=${errorKey(error)}`);
  }
  redirect(back);
}
