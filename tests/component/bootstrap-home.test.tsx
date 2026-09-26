/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

// Localized Link resolves the "/{locale}" prefix via next-intl navigation,
// which imports next/navigation — unavailable outside the Next runtime.
// The locale-prefix behavior itself is verified end-to-end in
// tests/e2e/localization.spec.ts.
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    locale,
    ...rest
  }: {
    href: string;
    locale?: string;
    children?: React.ReactNode;
  }) => <a href={`/${locale}${href === "/" ? "" : href}`} {...rest} />,
}));

import BootstrapHome from "@/app/[locale]/_components/bootstrap-home";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

describe("localized bootstrap home", () => {
  it("renders English content with a link to /ar", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <BootstrapHome />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.home.title,
    );
    const switchLink = screen.getByRole("link", { name: "العربية" });
    expect(switchLink).toHaveAttribute("href", "/ar");
    expect(switchLink).toHaveAttribute("lang", "ar");
  });

  it("renders Arabic content with a link to /en", () => {
    render(
      <NextIntlClientProvider locale="ar" messages={ar}>
        <BootstrapHome />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      ar.home.title,
    );
    const switchLink = screen.getByRole("link", { name: "English" });
    expect(switchLink).toHaveAttribute("href", "/en");
    expect(switchLink).toHaveAttribute("lang", "en");
  });
});
