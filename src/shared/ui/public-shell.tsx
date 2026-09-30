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

export interface PublicFooterContact {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface PublicFooterSocialLink {
  href: string;
  label: string;
}

export interface PublicFooter {
  identity: string;
  groups: readonly PublicLinkGroup[];
  copyright: string;
  contact?: PublicFooterContact | null;
  socialLinks?: readonly PublicFooterSocialLink[] | null;
}

/**
 * Production public shell (UX-1). Presentational only: every visible
 * string and every link is supplied by the caller. Search and contact
 * render only when a real target is passed.
 */
function compactTelHref(phone: string): string {
  return phone.replace(/[\s\-().]/gu, "");
}

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
          <div className="shell-header-zone shell-header-zone-identity">
            <a className="shell-logo" href={`/${locale}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- approved SVG must stay an exact file */}
              <img
                src={COMMITTEE_LOGO_HORIZONTAL}
                alt={identity}
                width={226}
                height={56}
              />
            </a>
          </div>
          {items.length > 0 && navigation ? (
            <nav
              className="shell-header-zone shell-header-zone-nav shell-main-nav"
              aria-label={navigation.label}
            >
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
          <div className="shell-header-zone shell-header-zone-utilities shell-utilities">
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
          {footer.contact?.email ||
          footer.contact?.phone ||
          footer.contact?.address ? (
            <address className="shell-footer-contact">
              {footer.contact.address ? (
                <span className="shell-footer-contact-line">
                  {footer.contact.address}
                </span>
              ) : null}
              {footer.contact.email ? (
                <a
                  className="shell-footer-contact-line"
                  href={`mailto:${footer.contact.email}`}
                >
                  <bdi dir="ltr" className="shell-contact-ltr">
                    {footer.contact.email}
                  </bdi>
                </a>
              ) : null}
              {footer.contact.phone ? (
                <a
                  className="shell-footer-contact-line"
                  href={`tel:${compactTelHref(footer.contact.phone)}`}
                >
                  <bdi dir="ltr" className="shell-contact-ltr">
                    {footer.contact.phone}
                  </bdi>
                </a>
              ) : null}
            </address>
          ) : null}
          {footer.socialLinks && footer.socialLinks.length > 0 ? (
            <ul className="shell-footer-social">
              {footer.socialLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} rel="noopener noreferrer" target="_blank">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {groups.length > 0 ? <PublicFooterGroups groups={groups} /> : null}
          <p className="shell-footer-text">{footer.copyright}</p>
        </div>
      </footer>
    </div>
  );
}
