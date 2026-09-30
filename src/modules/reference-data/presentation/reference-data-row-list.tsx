"use client";

import type { ReactNode } from "react";

export type ReferenceDataRowColumns = {
  nameAr: string;
  nameEn: string;
  status: string;
  active: string;
  inactive: string;
  usage: string;
  usageNone: string;
  usageCount: string;
  actions: string;
  edit: string;
  isActive: boolean;
  referenceCount?: number;
  usageDetail?: string;
};

export function ReferenceDataRowList({
  columns,
  rows,
  selectedId,
  onSelect,
  renderRowActions,
}: {
  columns: Omit<
    ReferenceDataRowColumns,
    "isActive" | "referenceCount" | "usageDetail"
  >;
  rows: readonly {
    id: string;
    nameAr: string;
    nameEn: string;
    isActive: boolean;
    referenceCount?: number;
    usageDetail?: string;
  }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderRowActions?: (row: {
    id: string;
    nameAr: string;
    nameEn: string;
  }) => ReactNode;
}) {
  return (
    <div
      className="admin-refdata-table"
      role="region"
      aria-label={columns.actions}
    >
      <div className="admin-refdata-head" aria-hidden="true">
        <span>{columns.nameAr}</span>
        <span>{columns.nameEn}</span>
        <span>{columns.status}</span>
        <span>{columns.usage}</span>
        <span>{columns.actions}</span>
      </div>
      <ul className="admin-refdata-body" role="list">
        {rows.map((row) => {
          const selected = selectedId === row.id;
          const usageText =
            row.usageDetail ??
            ((row.referenceCount ?? 0) > 0
              ? columns.usageCount.replace(
                  "{count}",
                  String(row.referenceCount),
                )
              : columns.usageNone);
          return (
            <li key={row.id}>
              <div
                className={`admin-refdata-row${selected ? " admin-refdata-row--selected" : ""}`}
              >
                <button
                  type="button"
                  className="admin-refdata-row-select"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => onSelect(row.id)}
                >
                  <span
                    className="admin-refdata-cell admin-refdata-name-ar"
                    dir="rtl"
                    lang="ar"
                  >
                    {row.nameAr}
                  </span>
                  <span
                    className="admin-refdata-cell admin-refdata-name-en"
                    dir="ltr"
                    lang="en"
                  >
                    {row.nameEn}
                  </span>
                  <span className="admin-refdata-cell">
                    <span
                      className={
                        row.isActive
                          ? "ui-badge ui-badge-brand"
                          : "ui-badge ui-badge-neutral"
                      }
                    >
                      {row.isActive ? columns.active : columns.inactive}
                    </span>
                  </span>
                  <span className="admin-refdata-cell admin-refdata-usage">
                    {usageText}
                  </span>
                </button>
                <div className="admin-refdata-row-actions">
                  {renderRowActions ? (
                    renderRowActions(row)
                  ) : (
                    <button
                      type="button"
                      className="ui-button ui-button-secondary ui-button-compact"
                      onClick={() => onSelect(row.id)}
                    >
                      {columns.edit}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
