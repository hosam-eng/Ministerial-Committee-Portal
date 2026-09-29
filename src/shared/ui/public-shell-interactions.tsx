"use client";

import { useEffect, useId, useState } from "react";

import type { PublicNavItem } from "./public-shell";

export function PublicShellMenu({
  label,
  openLabel,
  closeLabel,
  items,
}: {
  label: string;
  openLabel: string;
  closeLabel: string;
  items: readonly PublicNavItem[];
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
              <li key={item.href}>
                <a
                  className="shell-nav-link"
                  href={item.href}
                  aria-current={item.current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
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
  groups: readonly { heading: string; links: readonly PublicNavItem[] }[];
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
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
