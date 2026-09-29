/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  COMMITTEE_LOGO_HORIZONTAL,
  PublicShell,
} from "@/shared/ui/public-shell";

const navigation = {
  label: "Main",
  openMenuLabel: "Menu",
  closeMenuLabel: "Close",
  items: [{ href: "/ar/news", label: "الأخبار", current: true }],
};

const footer = {
  identity: "اللجنة الوزارية للسلامة المرورية",
  groups: [
    {
      heading: "روابط مهمة",
      links: [{ href: "/ar/news", label: "الأخبار" }],
    },
    { heading: "سياسات", links: [] },
  ],
  copyright: "© 2026",
};

describe("public shell visual baseline", () => {
  it("renders the approved horizontal logo and only real navigation", () => {
    render(
      <PublicShell
        locale="ar"
        identity="اللجنة الوزارية للسلامة المرورية"
        switchTo={{
          href: "/en/pages/about",
          lang: "en",
          label: "English",
          ariaLabel: "Language",
        }}
        skipLabel="التخطي إلى المحتوى الرئيسي"
        navigation={navigation}
        footer={footer}
      >
        <h1>عن اللجنة</h1>
      </PublicShell>,
    );

    const logo = screen.getByRole("link", {
      name: "اللجنة الوزارية للسلامة المرورية",
    });
    expect(logo).toHaveAttribute("href", "/ar");
    expect(logo.querySelector("img")).toHaveAttribute(
      "src",
      COMMITTEE_LOGO_HORIZONTAL,
    );
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
      "href",
      "/en/pages/about",
    );
    const newsLinks = screen.getAllByRole("link", { name: "الأخبار" });
    expect(
      newsLinks.some((link) => link.getAttribute("aria-current") === "page"),
    ).toBe(true);
    expect(screen.queryByRole("link", { name: /search|بحث/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /contact|تواصل/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /search|بحث/i })).toBeNull();
    expect(screen.queryByText("سياسات")).toBeNull();
    expect(screen.queryByRole("img", { name: /stacked|reverse/i })).toBeNull();
  });
});
