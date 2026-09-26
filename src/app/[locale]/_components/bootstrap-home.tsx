import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Minimal localized bootstrap content. Single semantic structure shared by
 * both locales — direction comes from <html dir>, not duplicated trees.
 * `locale` is the public route locale ("ar"/"en"), passed down from the
 * page params — the source of truth for routing.
 */
export default function BootstrapHome({ locale }: { locale: Locale }) {
  const t = useTranslations("home");
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
