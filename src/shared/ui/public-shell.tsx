import type { ReactNode } from "react";

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

/**
 * IMP-08 public shell — semantic landmarks shared by public pages.
 * Presentational only: every visible string is supplied by the caller
 * (shared/ui stays free of the localization framework).
 */
export function PublicShell({
  locale,
  identity,
  switchTo,
  skipLabel,
  footerText,
  children,
}: {
  locale: string;
  identity: string;
  switchTo: LocaleSwitch;
  skipLabel: string;
  footerText: string;
  children: ReactNode;
}) {
  return (
    <>
      <a className="shell-skip" href="#main-content">
        {skipLabel}
      </a>
      <header className="shell-header">
        <div className="shell-header-inner">
          <a className="shell-identity" href={`/${locale}`}>
            {identity}
          </a>
          <nav className="shell-header-nav" aria-label={switchTo.ariaLabel}>
            <a
              className="shell-lang"
              href={switchTo.href}
              hrefLang={switchTo.lang}
              lang={switchTo.lang}
            >
              {switchTo.label}
            </a>
          </nav>
        </div>
      </header>
      <main id="main-content" className="shell-main">
        {children}
      </main>
      <footer className="shell-footer">
        <div className="shell-footer-inner">
          <p className="shell-footer-text">{footerText}</p>
        </div>
      </footer>
    </>
  );
}
