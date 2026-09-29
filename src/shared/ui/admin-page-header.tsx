import type { ReactNode } from "react";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-header-text">
        {eyebrow ? <p className="admin-page-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="admin-page-lead">{description}</p> : null}
      </div>
      {action ? <div className="admin-page-header-action">{action}</div> : null}
    </header>
  );
}
