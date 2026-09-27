/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicShell } from "@/shared/ui/public-shell";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const switchTo = {
  en: { href: "/ar", lang: "ar", label: "العربية", ariaLabel: "Language" },
  ar: { href: "/en", lang: "en", label: "English", ariaLabel: "اللغة" },
} as const;

describe("public shell (IMP-08)", () => {
  it("renders English landmarks, identity, and a link to /ar", () => {
    render(
      <PublicShell
        locale="en"
        identity={en.app.name}
        switchTo={switchTo.en}
        skipLabel={en.shell.skipToContent}
        footerText={en.app.name}
      >
        <h1>{en.home.title}</h1>
      </PublicShell>,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.home.title,
    );
    expect(screen.getByRole("link", { name: en.app.name })).toHaveAttribute(
      "href",
      "/en",
    );
    const switchLink = screen.getByRole("link", { name: "العربية" });
    expect(switchLink).toHaveAttribute("href", "/ar");
    expect(switchLink).toHaveAttribute("lang", "ar");
    expect(
      screen.getByRole("link", { name: en.shell.skipToContent }),
    ).toHaveAttribute("href", "#main-content");
  });

  it("renders Arabic identity and a link to /en", () => {
    render(
      <PublicShell
        locale="ar"
        identity={ar.app.name}
        switchTo={switchTo.ar}
        skipLabel={ar.shell.skipToContent}
        footerText={ar.app.name}
      >
        <h1>{ar.home.title}</h1>
      </PublicShell>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      ar.home.title,
    );
    const switchLink = screen.getByRole("link", { name: "English" });
    expect(switchLink).toHaveAttribute("href", "/en");
    expect(switchLink).toHaveAttribute("lang", "en");
  });
});
