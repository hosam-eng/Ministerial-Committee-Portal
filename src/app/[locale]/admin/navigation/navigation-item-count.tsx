"use client";

import { useTranslations } from "next-intl";

/** Formats the current location item count (ICU plural) for the navigation editor. */
export function NavigationItemCount({ count }: { count: number }) {
  const t = useTranslations("navigation.ui");
  return <p className="navigation-context-meta">{t("itemCount", { count })}</p>;
}
