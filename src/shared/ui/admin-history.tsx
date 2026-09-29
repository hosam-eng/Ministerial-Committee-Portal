import type { ReactNode } from "react";

export function AdminHistory({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-history" aria-labelledby="admin-history-title">
      <h2 id="admin-history-title">{title}</h2>
      {children}
    </section>
  );
}

export function AdminHistorySubsection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-history-subsection">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function AdminRevisionList({ children }: { children: ReactNode }) {
  return (
    <ul className="admin-revision-list" role="list">
      {children}
    </ul>
  );
}

export function AdminRevisionItem({
  revisionLabel,
  statusBadge,
  liveBadge,
  dateTime,
  dateLabel,
  actions,
}: {
  revisionLabel: string;
  statusBadge: ReactNode;
  liveBadge?: ReactNode;
  dateTime: string;
  dateLabel: string;
  actions?: ReactNode;
}) {
  return (
    <li className="admin-revision-item">
      <div className="admin-revision-item-main">
        <span className="admin-revision-number">{revisionLabel}</span>
        <span className="admin-revision-badges">
          {statusBadge}
          {liveBadge}
        </span>
      </div>
      <time className="admin-revision-date" dateTime={dateTime}>
        {dateLabel}
      </time>
      {actions ? (
        <div className="admin-revision-actions ui-action-group">{actions}</div>
      ) : null}
    </li>
  );
}

export function AdminEventList({ children }: { children: ReactNode }) {
  return (
    <ul className="admin-event-list" role="list">
      {children}
    </ul>
  );
}

export function AdminEventItem({
  title,
  dateTime,
  dateLabel,
  detail,
}: {
  title: string;
  dateTime: string;
  dateLabel: string;
  detail?: ReactNode;
}) {
  return (
    <li className="admin-event-item">
      <div className="admin-event-item-head">
        <span className="admin-event-title">{title}</span>
        <time className="admin-event-date" dateTime={dateTime}>
          {dateLabel}
        </time>
      </div>
      {detail ? <div className="admin-event-detail">{detail}</div> : null}
    </li>
  );
}
