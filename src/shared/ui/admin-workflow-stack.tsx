import { Children, type ReactNode } from "react";

/** Renders the workflow stack only when at least one child is present. */
export function AdminWorkflowStack({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter((child) => child != null);
  if (items.length === 0) return null;
  return <div className="admin-workflow-stack">{items}</div>;
}
