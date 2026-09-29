import type { ReactNode } from "react";

import {
  PublicFooterGroups,
  PublicShellMenu,
} from "./public-shell-interactions";

export const COMMITTEE_LOGO_HORIZONTAL = "/brand/committee-logo-horizontal.svg";

export interface LocaleSwitch {
  /** Fully-resolved href for the other locale (e.g. "/en"). */
  href: string;
  /** BCP-47-ish value used for lang/hrefLang ("ar" | "en"). */
  lang: string;
  /** Visible label (target-language autonym, e.g. "English"). */
  label: string;
  /** Accessible name for the language-switch navigation landmark. */
  ariaLabel: string;
}

export interface PublicNavItem {
  href: string;
  label: string;
  current?: boolean;
}

export interface PublicNavRegion {
  label: string;
  openMenuLabel: string;
  closeMenuLabel: string;
  items: readonly PublicNavItem[];
}

export interface PublicLinkGroup {
  heading: string;
  links: readonly PublicNavItem[];
}

export interface PublicFooter {
  identity: string;
  groups: readonly PublicLinkGroup[];
  copyright: string;
}

/**
 * Production public shell (UX-1). Presentational only: every visible
 * string and every link is supplied by the caller. Search and contact
 * render only when a real target is passed.
 */
export function PublicShell({
  locale,
  identity,
  switchTo,
  skipLabel,
  navigation,
  search,
  contact,
  footer,
  children,
}: {
  locale: string;
  identity: string;
  switchTo?: LocaleSwitch | null;
  skipLabel: string;
  navigation?: PublicNavRegion | null;
  search?: PublicNavItem | null;
  contact?: PublicNavItem | null;
  footer: PublicFooter;
  children: ReactNode;
}) {
  const items = navigation?.items ?? [];
  const groups = footer.groups.filter((group) => group.links.length > 0);
  return (
    <div className="public-shell">
      <a className="shell-skip" href="#main-content">
        {skipLabel}
      </a>
      <header className="shell-header">
        <div className="shell-header-inner">
          <a className="shell-logo" href={`/${locale}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- approved SVG must stay an exact file */}
            <img
              src={COMMITTEE_LOGO_HORIZONTAL}
              alt={identity}
              width={226}
              height={56}
            />
          </a>
          {items.length > 0 && navigation ? (
            <nav className="shell-main-nav" aria-label={navigation.label}>
              <ul className="shell-nav-list">
                {items.map((item) => (
                  <li key={item.href}>
                    <a
                      className="shell-nav-link"
                      href={item.href}
                      aria-current={item.current ? "page" : undefined}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <div className="shell-utilities">
            {search ? (
              <a className="shell-search" href={search.href}>
                {search.label}
              </a>
            ) : null}
            {contact ? (
              <a className="shell-contact" href={contact.href}>
                {contact.label}
              </a>
            ) : null}
            {switchTo ? (
              <nav className="shell-lang-nav" aria-label={switchTo.ariaLabel}>
                <a
                  className="shell-lang"
                  href={switchTo.href}
                  hrefLang={switchTo.lang}
                  lang={switchTo.lang}
                >
                  {switchTo.label}
                </a>
              </nav>
            ) : null}
            {navigation && items.length > 0 ? (
              <PublicShellMenu
                label={navigation.label}
                openLabel={navigation.openMenuLabel}
                closeLabel={navigation.closeMenuLabel}
                items={items}
              />
            ) : null}
          </div>
        </div>
      </header>
      <main id="main-content" className="shell-main">
        {children}
      </main>
      <footer className="shell-footer">
        <div className="shell-footer-inner">
          <p className="shell-footer-identity">{footer.identity}</p>
          {groups.length > 0 ? <PublicFooterGroups groups={groups} /> : null}
          <p className="shell-footer-text">{footer.copyright}</p>
        </div>
      </footer>
    </div>
  );
}
