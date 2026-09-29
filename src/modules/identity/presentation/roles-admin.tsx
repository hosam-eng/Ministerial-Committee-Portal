"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { AdminPageHeader } from "@/shared/ui/admin-page-header";

/** Server action signature passed in from the route layer. */
export type AccessFormAction = (formData: FormData) => Promise<void>;

export interface RoleView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly systemKey: string | null;
  readonly isActive: boolean;
  readonly permissionKeys: readonly string[];
}

export interface CatalogPermissionView {
  readonly id: string;
  readonly key: string;
}

function groupPermissions(catalog: readonly CatalogPermissionView[]) {
  const groups = new Map<string, CatalogPermissionView[]>();
  for (const permission of catalog) {
    const prefix = permission.key.split(".")[0] ?? permission.key;
    const bucket = groups.get(prefix) ?? [];
    bucket.push(permission);
    groups.set(prefix, bucket);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Roles management (IMP-06). System roles render read-only; custom
 * roles get edit/permission/activation controls only when the actor
 * holds identity.roles.manage — and every mutation re-checks the
 * permission server-side regardless of what the UI renders.
 */
export function RolesAdmin({
  title,
  description,
  roles,
  catalog,
  canManage,
  errorKey,
  returnPath,
  actions,
}: {
  title: string;
  description?: string;
  roles: readonly RoleView[];
  catalog: readonly CatalogPermissionView[];
  canManage: boolean;
  errorKey?: string;
  returnPath: string;
  actions: {
    create: AccessFormAction;
    update: AccessFormAction;
    setActive: AccessFormAction;
  };
}) {
  const t = useTranslations("access");
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? "");
  const [createMode, setCreateMode] = useState(false);
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0];
  const permissionGroups = useMemo(() => groupPermissions(catalog), [catalog]);

  const labels = t.raw("permissions") as Record<string, unknown>;
  const groupLabels = t.raw("permissionGroups") as Record<string, string>;

  const labelFor = (key: string) => {
    const node = key
      .split(".")
      .reduce<unknown>(
        (n, segment) =>
          n !== null && typeof n === "object" && !Array.isArray(n)
            ? (n as Record<string, unknown>)[segment]
            : undefined,
        labels,
      );
    return typeof node === "string" ? node : key;
  };

  const groupLabelFor = (prefix: string) =>
    groupLabels[prefix] ?? labelFor(prefix);

  const systemDescriptions = t.raw("roles.systemDescriptions") as Record<
    string,
    string
  >;
  const systemDescription = (systemKey: string) =>
    systemDescriptions[systemKey];

  const renderPermissionGroupsReadOnly = (role: RoleView) => (
    <div className="admin-permission-groups">
      {permissionGroups.map(([prefix, permissions]) => {
        const granted = permissions.filter((permission) =>
          role.permissionKeys.includes(permission.key),
        );
        if (!granted.length) return null;
        return (
          <div key={prefix} className="admin-permission-group">
            <h4>{groupLabelFor(prefix)}</h4>
            <ul className="admin-permission-readonly-list">
              {granted.map((permission) => (
                <li key={permission.id} className="admin-permission-readonly">
                  <span className="admin-permission-readonly-mark" aria-hidden>
                    ✓
                  </span>
                  {labelFor(permission.key)}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );

  const renderPermissionFields = (role: RoleView | null) => (
    <div className="admin-permission-groups">
      {permissionGroups.map(([prefix, permissions]) => (
        <div key={prefix} className="admin-permission-group">
          <h4>{groupLabelFor(prefix)}</h4>
          <div className="admin-permission-grid">
            {permissions.map((permission) => (
              <label key={permission.id}>
                <input
                  type="checkbox"
                  name="permissions"
                  value={permission.id}
                  defaultChecked={
                    role ? role.permissionKeys.includes(permission.key) : false
                  }
                />
                {labelFor(permission.key)}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const updateFormId = selected ? `role-update-${selected.id}` : "";

  return (
    <div className="admin-access-page">
      <AdminPageHeader
        title={title}
        description={description}
        action={
          canManage ? (
            <button
              type="button"
              className="ui-button ui-button-primary"
              onClick={() => setCreateMode(true)}
            >
              {t("roles.create")}
            </button>
          ) : undefined
        }
      />
      {errorKey ? (
        <p role="alert" className="ui-alert ui-alert-error">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      <div className="admin-roles-workspace">
        <ul className="admin-roles-list" aria-label={t("roles.title")}>
          {roles.map((role) => (
            <li key={role.id}>
              <button
                type="button"
                className={`admin-roles-list-item${!createMode && selected?.id === role.id ? " is-active" : ""}`}
                aria-current={
                  !createMode && selected?.id === role.id ? "true" : undefined
                }
                onClick={() => {
                  setCreateMode(false);
                  setSelectedId(role.id);
                }}
              >
                <span className="admin-roles-list-item-name">{role.name}</span>
                <span className="admin-roles-list-item-meta">
                  <span className="ui-badge ui-badge-neutral">
                    {role.systemKey !== null
                      ? t("roles.system")
                      : t("roles.custom")}
                  </span>
                  <span className="ui-badge ui-badge-brand">
                    {role.isActive ? t("roles.active") : t("roles.inactive")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="admin-roles-detail">
          {createMode && canManage ? (
            <>
              <h2>{t("roles.createTitle")}</h2>
              <form action={actions.create}>
                <input type="hidden" name="returnPath" value={returnPath} />
                <div className="ui-field">
                  <label htmlFor="new-name">{t("roles.name")}</label>
                  <input
                    id="new-name"
                    className="ui-input"
                    name="name"
                    maxLength={80}
                    required
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="new-desc">{t("roles.description")}</label>
                  <input
                    id="new-desc"
                    className="ui-input"
                    name="description"
                    maxLength={280}
                  />
                </div>
                <section className="admin-roles-detail-section">
                  <h3>{t("roles.permissions")}</h3>
                  {renderPermissionFields(null)}
                </section>
                <div className="ui-action-group admin-roles-detail-actions">
                  <button type="submit" className="ui-button ui-button-primary">
                    {t("roles.create")}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button-secondary"
                    onClick={() => setCreateMode(false)}
                  >
                    {t("roles.cancel")}
                  </button>
                </div>
              </form>
            </>
          ) : selected ? (
            <>
              <h2>
                {selected.name}
                <span className="ui-badge ui-badge-neutral">
                  {selected.systemKey !== null
                    ? t("roles.system")
                    : t("roles.custom")}
                </span>
              </h2>
              {selected.systemKey !== null ? (
                <>
                  <p className="admin-roles-detail-lead">
                    {t("roles.readOnlyNotice")}
                  </p>
                  <p className="admin-roles-detail-desc">
                    {systemDescription(selected.systemKey) ??
                      selected.description ??
                      t("roles.noDescription")}
                  </p>
                  <section className="admin-roles-detail-section">
                    <h3>{t("roles.permissions")}</h3>
                    {renderPermissionGroupsReadOnly(selected)}
                  </section>
                </>
              ) : canManage ? (
                <>
                  <form id={updateFormId} action={actions.update}>
                    <input type="hidden" name="roleId" value={selected.id} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <div className="ui-field">
                      <label htmlFor={`name-${selected.id}`}>
                        {t("roles.name")}
                      </label>
                      <input
                        id={`name-${selected.id}`}
                        className="ui-input"
                        name="name"
                        defaultValue={selected.name}
                        maxLength={80}
                        required
                      />
                    </div>
                    <div className="ui-field">
                      <label htmlFor={`desc-${selected.id}`}>
                        {t("roles.description")}
                      </label>
                      <input
                        id={`desc-${selected.id}`}
                        className="ui-input"
                        name="description"
                        defaultValue={selected.description ?? ""}
                        maxLength={280}
                      />
                    </div>
                    <section className="admin-roles-detail-section">
                      <h3>{t("roles.permissions")}</h3>
                      {renderPermissionFields(selected)}
                    </section>
                  </form>
                  <div className="ui-action-group admin-roles-detail-actions">
                    <button
                      type="submit"
                      className="ui-button ui-button-primary"
                      form={updateFormId}
                    >
                      {t("roles.save")}
                    </button>
                    <form
                      action={actions.setActive}
                      className="admin-roles-inline-form"
                    >
                      <input type="hidden" name="roleId" value={selected.id} />
                      <input
                        type="hidden"
                        name="returnPath"
                        value={returnPath}
                      />
                      <input
                        type="hidden"
                        name="active"
                        value={selected.isActive ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className={`ui-button ${selected.isActive ? "ui-button-danger" : "ui-button-secondary"}`}
                      >
                        {selected.isActive
                          ? t("roles.deactivate")
                          : t("roles.activate")}
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <>
                  <p className="admin-roles-detail-desc">
                    {selected.description ?? t("roles.noDescription")}
                  </p>
                  <section className="admin-roles-detail-section">
                    <h3>{t("roles.permissions")}</h3>
                    {renderPermissionGroupsReadOnly(selected)}
                  </section>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
