import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);
const getAdminAuthState = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect,
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("@/modules/identity/infrastructure/auth/session", () => ({
  getAdminAuthState,
}));

import { requireBackoffice } from "@/modules/identity/infrastructure/rbac/gate";
import { PERMISSIONS } from "@/modules/identity/domain/permissions";

describe("managed page preview access", () => {
  it("sends an anonymous preview request to login", async () => {
    getAdminAuthState.mockResolvedValue({ status: "unauthenticated" });
    await expect(
      requireBackoffice("ar", PERMISSIONS.MANAGED_PAGES_READ),
    ).rejects.toThrow("REDIRECT:/ar/admin/login");
  });
});
