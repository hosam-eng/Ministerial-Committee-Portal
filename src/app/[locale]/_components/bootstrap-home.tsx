import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Minimal localized bootstrap content. Single semantic structure shared by
 * both locales — direction comes from <html dir>, not duplicated trees.
 */
export default function BootstrapHome() {
  const t = useTranslations("home");
  const locale = useLocale();
  const otherLocale = routing.locales.find(
    (candidate) => candidate !== locale,
  ) as Locale;

  return (
    <main className="bootstrap-page">
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <p>
        <Link href="/" locale={otherLocale} lang={otherLocale}>
          {t("switchToLanguage")}
        </Link>
      </p>
    </main>
  );
}
