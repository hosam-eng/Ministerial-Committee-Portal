import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { AdminPlaceholder, getAdminAuthState } from "@/modules/identity";

export const dynamic = "force-dynamic";

/**
 * Authenticated admin proof page. The gate is fully server-side: no
 * session → login; session without enrolled MFA → mandatory setup;
 * pending MFA challenge → challenge page.
 */
export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const state = await getAdminAuthState();
  if (state.status === "unauthenticated") {
    redirect(`/${locale}/admin/login`);
  }
  if (state.status === "mfa-challenge-pending") {
    redirect(`/${locale}/admin/mfa`);
  }
  if (state.status === "mfa-enrollment-required") {
    redirect(`/${locale}/admin/mfa/setup`);
  }

  return (
    <AdminPlaceholder email={state.user.email} locale={locale as Locale} />
  );
}
