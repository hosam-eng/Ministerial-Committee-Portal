/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicMainNavList } from "@/shared/ui/public-shell-interactions";

describe("PublicMainNavList", () => {
  it("renders hierarchical main navigation links", () => {
    render(
      <PublicMainNavList
        items={[
          {
            kind: "group",
            label: "Section",
            children: [{ kind: "link", href: "/en/news", label: "News" }],
          },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Section" })).toBeInTheDocument();
  });
});
