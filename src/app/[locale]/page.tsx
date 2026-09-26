import { setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";

import BootstrapHome from "./_components/bootstrap-home";

/**
 * Localized bootstrap home page for IMP-04 — a technical placeholder
 * proving /ar + /en, RTL/LTR, and the language switch. Not the final
 * homepage (real content, header, footer, and design system come later).
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // `locale` was validated by the layout (`hasLocale` → notFound) before
  // this page renders.
  return <BootstrapHome locale={locale as Locale} />;
}
