import type { ReactNode } from "react";

export function PreviewFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="preview-frame">
      <p className="preview-banner" role="status">
        {label}
      </p>
      {children}
    </div>
  );
}
