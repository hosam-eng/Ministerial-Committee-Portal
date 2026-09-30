"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useSyncExternalStore } from "react";

import { replaceAdminLocalePrefix } from "@/i18n/admin-locale-switch";
import type { Locale } from "@/i18n/routing";

import type { LocaleSwitch } from "./public-shell";

function subscribeHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getHashSnapshot() {
  return window.location.hash;
}

function getHashServerSnapshot() {
  return "";
}

function LocalePreservingSwitchLinkInner({
  switchTo,
  className,
}: {
  switchTo: LocaleSwitch;
  className: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hash = useSyncExternalStore(
    subscribeHash,
    getHashSnapshot,
    getHashServerSnapshot,
  );
  const href = replaceAdminLocalePrefix(pathname, switchTo.lang as Locale, {
    search: searchParams.toString(),
    hash,
  });

  return (
    <a
      className={className}
      href={href}
      hrefLang={switchTo.lang}
      lang={switchTo.lang}
    >
      {switchTo.label}
    </a>
  );
}

/** Preserves admin pathname, query, and hash when switching locale. */
export function LocalePreservingSwitchLink({
  switchTo,
  className,
}: {
  switchTo: LocaleSwitch;
  className: string;
}) {
  return (
    <Suspense
      fallback={
        <a
          className={className}
          href={switchTo.href}
          hrefLang={switchTo.lang}
          lang={switchTo.lang}
        >
          {switchTo.label}
        </a>
      }
    >
      <LocalePreservingSwitchLinkInner
        switchTo={switchTo}
        className={className}
      />
    </Suspense>
  );
}
