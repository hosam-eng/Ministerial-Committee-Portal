"use client";

import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";

import { DgaRegistrar } from "./dga/registrar.client";
import type { LocaleSwitch } from "./public-shell";

export interface AdminNavItem {
  href: string;
  label: string;
}

function AdminShellMenu({
  label,
  openLabel,
  closeLabel,
  items,
  activeHref,
}: {
  label: string;
  openLabel: string;
  closeLabel: string;
  items: readonly AdminNavItem[];
  activeHref?: string;
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
    <div className="admin-shell-menu">
      <button
        type="button"
        className="admin-shell-menu-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? closeLabel : openLabel}
      </button>
      {open ? (
        <nav id={panelId} className="admin-shell-drawer" aria-label={label}>
          <ul className="admin-shell-nav-list">
            {items.map((item) => (
              <li key={item.href}>
                <a
                  className="admin-shell-nav-link"
                  href={item.href}
                  aria-current={activeHref === item.href ? "page" : undefined}
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

/**
 * Production admin application shell. Authorization stays on the server;
 * navigation visibility is usability only.
 */
export function AdminShell({
  locale,
  title,
  email,
  navItems,
  navLabel,
  activeHref,
  switchTo,
  skipLabel,
  openMenuLabel,
  closeMenuLabel,
  actions,
  children,
}: {
  locale: string;
  title: string;
  email: string;
  navItems: readonly AdminNavItem[];
  navLabel: string;
  activeHref?: string;
  switchTo: LocaleSwitch;
  skipLabel: string;
  openMenuLabel: string;
  closeMenuLabel: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="admin-shell">
      <a className="shell-skip" href="#main-content">
        {skipLabel}
      </a>
      <header className="admin-shell-top" role="banner">
        <div className="admin-shell-top-inner">
          <a className="admin-shell-product" href={`/${locale}/admin`}>
            {title}
          </a>
          <div className="admin-shell-account">
            <a
              className="admin-shell-lang"
              href={switchTo.href}
              hrefLang={switchTo.lang}
              lang={switchTo.lang}
            >
              {switchTo.label}
            </a>
            <span className="admin-shell-email">{email}</span>
            {actions}
          </div>
        </div>
      </header>
      <div className="admin-shell-body">
        {navItems.length > 0 ? (
          <nav className="admin-shell-sidebar" aria-label={navLabel}>
            <ul className="admin-shell-nav-list">
              {navItems.map((item) => (
                <li key={item.href}>
                  <a
                    className="admin-shell-nav-link"
                    href={item.href}
                    aria-current={activeHref === item.href ? "page" : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div className="admin-shell-workspace">
          {navItems.length > 0 ? (
            <AdminShellMenu
              label={navLabel}
              openLabel={openMenuLabel}
              closeLabel={closeMenuLabel}
              items={navItems}
              activeHref={activeHref}
            />
          ) : null}
          <main id="main-content" className="admin-shell-main">
            {children}
          </main>
        </div>
      </div>
      <DgaRegistrar />
    </div>
  );
}
