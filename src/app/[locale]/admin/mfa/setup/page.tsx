import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { getAdminAuthState, MfaSetupForm } from "@/modules/identity";

export const dynamic = "force-dynamic";

/**
 * Mandatory first-login TOTP enrollment. Requires a live session for an
 * account that has not enrolled MFA yet — no session → login, enrolled →
 * admin.
 */
export default async function AdminMfaSetupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const state = await getAdminAuthState();
  if (state.status === "authenticated") {
    redirect(`/${locale}/admin`);
  }
  if (state.status === "unauthenticated") {
    redirect(`/${locale}/admin/login`);
  }
  if (state.status === "mfa-challenge-pending") {
    redirect(`/${locale}/admin/mfa`);
  }

  return <MfaSetupForm locale={locale as Locale} />;
}
