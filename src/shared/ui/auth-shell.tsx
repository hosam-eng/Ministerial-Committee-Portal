import type { ReactNode } from "react";

import type { LocaleSwitch } from "./public-shell";

/**
 * Focused authentication frame (login in Phase A). Presentational only.
 */
export function AuthShell({
  locale,
  productTitle,
  switchTo,
  children,
}: {
  locale: string;
  productTitle: string;
  switchTo?: LocaleSwitch | null;
  children: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <header className="auth-shell-header">
        <div className="auth-shell-header-inner">
          <a className="auth-shell-brand" href={`/${locale}`}>
            {productTitle}
          </a>
          {switchTo ? (
            <nav className="auth-shell-lang" aria-label={switchTo.ariaLabel}>
              <a
                className="auth-shell-lang-link"
                href={switchTo.href}
                hrefLang={switchTo.lang}
                lang={switchTo.lang}
              >
                {switchTo.label}
              </a>
            </nav>
          ) : null}
        </div>
      </header>
      <main className="auth-shell-main">{children}</main>
    </div>
  );
}
