import type { ReactNode } from "react";

import { DgaRegistrar } from "./dga/registrar.client";
import type { LocaleSwitch } from "./public-shell";

export interface AdminNavItem {
  href: string;
  label: string;
}

/**
 * IMP-08 admin shell for fully authenticated + authorized backoffice
 * pages. Navigation visibility is usability only — every target stays
 * server-authorized by the RBAC gate. `actions` carries module-owned
 * controls (logout) from the delivery layer so shared/ui stays free of
 * business-module imports.
 */
export function AdminShell({
  locale,
  title,
  email,
  navItems,
  navLabel,
  switchTo,
  skipLabel,
  actions,
  children,
}: {
  locale: string;
  title: string;
  email: string;
  navItems: readonly AdminNavItem[];
  navLabel: string;
  switchTo: LocaleSwitch;
  skipLabel: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <a className="shell-skip" href="#main-content">
        {skipLabel}
      </a>
      <header className="shell-header">
        <div className="shell-header-inner">
          <a className="shell-identity" href={`/${locale}/admin`}>
            {title}
          </a>
          <nav className="shell-header-nav" aria-label={navLabel}>
            <ul className="shell-nav-list">
              {navItems.map((item) => (
                <li key={item.href}>
                  <a className="shell-nav-link" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="shell-account">
            <a
              className="shell-lang"
              href={switchTo.href}
              hrefLang={switchTo.lang}
              lang={switchTo.lang}
            >
              {switchTo.label}
            </a>
            <span className="shell-email">{email}</span>
            {actions}
          </div>
        </div>
      </header>
      <main id="main-content" className="shell-main">
        {children}
      </main>
      <DgaRegistrar />
    </>
  );
}
