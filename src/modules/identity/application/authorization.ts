import {
  ROLE_DESCRIPTION_MAX,
  ROLE_NAME_MAX,
  type PermissionKey,
} from "../domain/permissions";

/**
 * Authorization use-case guards (IMP-06). Pure functions and error
 * types — the infrastructure layer supplies the data and enforces
 * these at the PostgreSQL boundary; nothing here reads client state,
 * cookies, or session claims.
 */

/** Caller lacks the required permission — maps to access denied. */
export class AccessDeniedError extends Error {
  constructor(readonly permission: PermissionKey) {
    super(`Access denied: missing permission ${permission}`);
    this.name = "AccessDeniedError";
  }
}

/** Mutation attempted on a protected system role. */
export class SystemRoleError extends Error {
  constructor() {
    super("The Administrator system role cannot be modified.");
    this.name = "SystemRoleError";
  }
}

/** Removal would leave zero Administrator memberships. */
export class LastAdministratorError extends Error {
  constructor() {
    super("The final Administrator membership cannot be removed.");
    this.name = "LastAdministratorError";
  }
}

/** First-admin bootstrap attempted while an Administrator exists. */
export class BootstrapClosedError extends Error {
  constructor() {
    super("An Administrator membership already exists.");
    this.name = "BootstrapClosedError";
  }
}

/** Invalid role input (name/description/shape). */
export class RoleValidationError extends Error {
  constructor(
    message: string,
    readonly code: "invalid" | "nameTaken" = "invalid",
  ) {
    super(message);
    this.name = "RoleValidationError";
  }
}

export function requirePermission(
  available: ReadonlySet<string>,
  permission: PermissionKey,
): void {
  if (!available.has(permission)) throw new AccessDeniedError(permission);
}

export interface RoleShape {
  readonly systemKey: string | null;
}

/** Custom roles only — system roles reject every mutation. */
export function requireCustomRole(role: RoleShape | null): void {
  if (!role) throw new RoleValidationError("Role not found.");
  if (role.systemKey !== null) throw new SystemRoleError();
}

export function normalizeRoleName(name: unknown): string {
  const normalized = typeof name === "string" ? name.trim() : "";
  if (normalized.length === 0 || normalized.length > ROLE_NAME_MAX) {
    throw new RoleValidationError(
      `Role name must be 1-${ROLE_NAME_MAX} characters.`,
    );
  }
  return normalized;
}

export function normalizeRoleDescription(description: unknown): string | null {
  if (description == null || description === "") return null;
  if (typeof description !== "string") {
    throw new RoleValidationError("Invalid role description.");
  }
  const normalized = description.trim();
  if (normalized.length > ROLE_DESCRIPTION_MAX) {
    throw new RoleValidationError(
      `Role description must be at most ${ROLE_DESCRIPTION_MAX} characters.`,
    );
  }
  return normalized.length === 0 ? null : normalized;
}
