"use client";

import { useTranslations } from "next-intl";

import type { AccessFormAction, RoleView } from "./roles-admin";

export interface UserAccessView {
  readonly id: string;
  readonly email: string;
  readonly roles: readonly RoleView[];
}

/**
 * User ↔ Role assignment (IMP-06). Only active roles are offered for
 * new assignment; Administrator membership removal is guarded
 * server-side (last-admin protection), never by hidden UI.
 */
export function UsersAdmin({
  users,
  assignableRoles,
  canManage,
  errorKey,
  returnPath,
  actions,
}: {
  users: readonly UserAccessView[];
  assignableRoles: readonly RoleView[];
  canManage: boolean;
  errorKey?: string;
  returnPath: string;
  actions: {
    assign: AccessFormAction;
    remove: AccessFormAction;
  };
}) {
  const t = useTranslations("access");

  return (
    <div className="admin-access-page">
      {errorKey ? (
        <p role="alert" className="ui-alert ui-alert-error">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      <div className="admin-users-data" role="table">
        <div className="admin-users-head" role="row">
          <span role="columnheader">{t("users.email")}</span>
          <span role="columnheader">{t("users.roles")}</span>
          <span role="columnheader">{t("users.actions")}</span>
        </div>
        {users.map((user) => {
          const available = assignableRoles.filter(
            (role) => !user.roles.some((assigned) => assigned.id === role.id),
          );
          return (
            <div className="admin-users-row" role="row" key={user.id}>
              <div className="admin-users-email" role="cell">
                {user.email}
              </div>
              <div className="admin-users-roles" role="cell">
                {user.roles.length === 0 ? (
                  <p className="admin-users-empty-hint">{t("users.noRoles")}</p>
                ) : (
                  user.roles.map((role) => (
                    <span
                      key={role.id}
                      className="admin-users-role-chip ui-action-group"
                    >
                      <span className="ui-badge ui-badge-neutral">
                        {role.name}
                        {role.systemKey ? ` (${t("roles.system")})` : ""}
                        {role.isActive ? "" : ` (${t("roles.inactive")})`}
                      </span>
                      {canManage ? (
                        <form action={actions.remove}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="roleId" value={role.id} />
                          <input
                            type="hidden"
                            name="returnPath"
                            value={returnPath}
                          />
                          <button
                            type="submit"
                            className="ui-button ui-button-secondary ui-button-compact"
                          >
                            {t("users.remove")}
                          </button>
                        </form>
                      ) : null}
                    </span>
                  ))
                )}
              </div>
              <div className="admin-users-assign" role="cell">
                {canManage && available.length > 0 ? (
                  <form
                    action={actions.assign}
                    className="ui-action-group admin-users-assign-form"
                  >
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <div className="ui-field">
                      <label className="sr-only" htmlFor={`assign-${user.id}`}>
                        {t("users.assignRole")}
                      </label>
                      <select
                        id={`assign-${user.id}`}
                        className="ui-input"
                        name="roleId"
                        aria-label={t("users.assignRole")}
                      >
                        {available.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="ui-button ui-button-primary ui-button-compact"
                    >
                      {t("users.assign")}
                    </button>
                  </form>
                ) : (
                  <span className="admin-users-empty-hint">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
