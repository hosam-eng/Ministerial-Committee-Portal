import type { Page } from "@playwright/test";

/** Matches `shell.adminNav` in messages (AdminShell sidebar landmark). */
export const ADMIN_NAV_LABEL = {
  ar: "أقسام لوحة الإدارة",
  en: "Admin console sections",
} as const;

export type AdminNavLocale = keyof typeof ADMIN_NAV_LABEL;

/**
 * Sidebar navigation landmark — use for RBAC/nav visibility assertions.
 * Dashboard and other regions may duplicate link labels legitimately.
 */
export function getAdminNavigation(page: Page, locale: AdminNavLocale = "ar") {
  return page.getByRole("navigation", {
    name: ADMIN_NAV_LABEL[locale],
  });
}
