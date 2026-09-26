import { setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { AccessDenied, AdminHome, requireBackoffice } from "@/modules/identity";

export const dynamic = "force-dynamic";

/**
 * Backoffice landing — IMP-05 authentication state machine first
 * (login / MFA setup / MFA challenge redirects inside the gate), then
 * RBAC: fully authenticated users without `backoffice.access` get the
 * localized access-denied experience.
 */
export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const gate = await requireBackoffice(locale);
  if (gate.status === "denied") {
    return <AccessDenied locale={locale as Locale} />;
  }

  return (
    <AdminHome
      email={gate.user.email}
      locale={locale as Locale}
      permissions={gate.permissions}
    />
  );
}
