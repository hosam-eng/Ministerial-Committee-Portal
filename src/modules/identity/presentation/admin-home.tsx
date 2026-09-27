import { useTranslations } from "next-intl";

/**
 * Minimal backoffice landing content (IMP-06; IMP-08 moved navigation
 * and logout into AdminShell). Permission-based link visibility is
 * usability only — every target route is still server-authorized.
 */
export function AdminHome({ email }: { email: string }) {
  const t = useTranslations();
  return (
    <>
      <h1>{t("auth.admin.title")}</h1>
      <p>{t("auth.admin.signedInAs", { email })}</p>
    </>
  );
}
