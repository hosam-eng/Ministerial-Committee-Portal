/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { NavigationItemCount } from "@/app/[locale]/admin/navigation/navigation-item-count";

import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

function renderCount(locale: "ar" | "en", count: number) {
  const messages = locale === "ar" ? ar : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <NavigationItemCount count={count} />
    </NextIntlClientProvider>,
  );
}

describe("NavigationItemCount", () => {
  it("formats English zero, one, and many", () => {
    renderCount("en", 0);
    expect(screen.getByText("No items")).toBeInTheDocument();

    renderCount("en", 1);
    expect(screen.getByText("1 item")).toBeInTheDocument();

    renderCount("en", 3);
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });

  it("formats Arabic zero, one, and many", () => {
    renderCount("ar", 0);
    expect(screen.getByText("لا توجد عناصر")).toBeInTheDocument();

    renderCount("ar", 1);
    expect(screen.getByText("عنصر واحد")).toBeInTheDocument();

    renderCount("ar", 2);
    expect(screen.getByText("2 عناصر")).toBeInTheDocument();
  });
});
