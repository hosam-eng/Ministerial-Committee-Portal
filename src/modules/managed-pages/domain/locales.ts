export const MANAGED_PAGE_LOCALES = ["ar", "en"] as const;

export type ManagedPageLocale = (typeof MANAGED_PAGE_LOCALES)[number];

export function isManagedPageLocale(value: string): value is ManagedPageLocale {
  return value === "ar" || value === "en";
}
