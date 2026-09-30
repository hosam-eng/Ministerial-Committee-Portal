"use client";

import { useEffect, useId, useState } from "react";

import type { PublicNavTreeLink, PublicNavTreeNode } from "./public-shell";

function NavLink({
  item,
  onNavigate,
}: {
  item: PublicNavTreeLink;
  onNavigate?: () => void;
}) {
  return (
    <a
      className="shell-nav-link"
      href={item.href}
      aria-current={item.current ? "page" : undefined}
      onClick={onNavigate}
      {...(item.external
        ? { rel: "noopener noreferrer", target: "_blank" }
        : {})}
    >
      {item.label}
    </a>
  );
}

function DesktopNavGroup({
  node,
}: {
  node: Extract<PublicNavTreeNode, { kind: "group" }>;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="shell-nav-disclosure">
      <button
        type="button"
        className={`shell-nav-link shell-nav-disclosure-trigger${node.current ? " shell-nav-link-current" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {node.label}
      </button>
      {open ? (
        <div id={panelId} className="shell-nav-disclosure-panel">
          <ul className="shell-nav-sublist">
            {node.children.map((child) => (
              <li key={child.kind === "link" ? child.href : child.label}>
                <DesktopNavNode node={child} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DesktopNavNode({ node }: { node: PublicNavTreeNode }) {
  if (node.kind === "link") return <NavLink item={node} />;
  return <DesktopNavGroup node={node} />;
}

function DrawerNavGroup({
  node,
  onNavigate,
}: {
  node: Extract<PublicNavTreeNode, { kind: "group" }>;
  onNavigate: () => void;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="shell-nav-disclosure shell-nav-disclosure-drawer">
      <button
        type="button"
        className="shell-nav-link shell-nav-disclosure-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {node.label}
      </button>
      {open ? (
        <ul id={panelId} className="shell-nav-sublist">
          {node.children.map((child) => (
            <li key={child.kind === "link" ? child.href : child.label}>
              <DrawerNavNode node={child} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DrawerNavNode({
  node,
  onNavigate,
}: {
  node: PublicNavTreeNode;
  onNavigate: () => void;
}) {
  if (node.kind === "link")
    return <NavLink item={node} onNavigate={onNavigate} />;
  return <DrawerNavGroup node={node} onNavigate={onNavigate} />;
}

export function PublicMainNavList({
  items,
}: {
  items: readonly PublicNavTreeNode[];
}) {
  return (
    <ul className="shell-nav-list">
      {items.map((item) => (
        <li key={item.kind === "link" ? item.href : item.label}>
          <DesktopNavNode node={item} />
        </li>
      ))}
    </ul>
  );
}

export function PublicShellMenu({
  label,
  openLabel,
  closeLabel,
  items,
}: {
  label: string;
  openLabel: string;
  closeLabel: string;
  items: readonly PublicNavTreeNode[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);
  if (items.length === 0) return null;
  return (
    <div className="shell-menu">
      <button
        type="button"
        className="shell-menu-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? closeLabel : openLabel}
      </button>
      {open ? (
        <nav id={panelId} className="shell-drawer" aria-label={label}>
          <ul className="shell-nav-list">
            {items.map((item) => (
              <li key={item.kind === "link" ? item.href : item.label}>
                <DrawerNavNode node={item} onNavigate={() => setOpen(false)} />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

export function PublicFooterGroups({
  groups,
}: {
  groups: readonly { heading: string; links: readonly PublicNavTreeLink[] }[];
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 960px)");
    const apply = () => setWide(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return (
    <>
      {groups.map((group) => {
        const expanded = wide || Boolean(open[group.heading]);
        return (
          <section key={group.heading} className="shell-footer-group">
            <h2 className="shell-footer-heading">
              <button
                type="button"
                className="shell-footer-toggle"
                aria-expanded={expanded}
                tabIndex={wide ? -1 : 0}
                onClick={() =>
                  setOpen((current) => ({
                    ...current,
                    [group.heading]: !expanded,
                  }))
                }
              >
                {group.heading}
              </button>
            </h2>
            <ul className="shell-footer-links" hidden={!expanded}>
              {group.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    {...(link.external
                      ? { rel: "noopener noreferrer", target: "_blank" }
                      : {})}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
