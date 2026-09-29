"use client";

import { useTranslations } from "next-intl";

export interface AdminHomeDestination {
  heading: string;
  links: readonly { href: string; label: string }[];
}

/**
 * Operational backoffice landing — real authorized destinations only.
 */
export function AdminHome({
  email,
  destinations,
}: {
  email: string;
  destinations: readonly AdminHomeDestination[];
}) {
  const t = useTranslations();
  return (
    <div className="admin-home">
      <header className="admin-page-header">
        <div className="admin-page-header-text">
          <p className="admin-page-eyebrow">{t("shell.adminTitle")}</p>
          <h1>{t("adminHome.title")}</h1>
          <p className="admin-page-lead">
            {t("adminHome.signedInAs", { email })}
          </p>
        </div>
      </header>
      <div className="admin-home-grid">
        {destinations.map((group) => (
          <section key={group.heading} className="ui-surface admin-home-card">
            <h2>{group.heading}</h2>
            <ul className="admin-home-links">
              {group.links.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
