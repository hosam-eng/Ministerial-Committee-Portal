import { describe, expect, it } from "vitest";

import { validateServerConfig } from "@/platform/config";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_ENV: "test",
  DATABASE_URL: "postgresql://mcp_runtime:x@127.0.0.1:5432/mcp_test",
} as const;

const SECRET = "a-valid-test-secret-with-32-plus-chars";

describe("auth server configuration (IMP-05)", () => {
  it("accepts optional auth settings outside production", () => {
    const config = validateServerConfig(BASE_ENV);
    expect(config.auth.secret).toBeUndefined();
    expect(config.auth.baseUrl).toBeUndefined();
  });

  it("maps BETTER_AUTH_SECRET / BETTER_AUTH_URL into typed config", () => {
    const config = validateServerConfig({
      ...BASE_ENV,
      BETTER_AUTH_SECRET: SECRET,
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
    });
    expect(config.auth.secret).toBe(SECRET);
    expect(config.auth.baseUrl).toBe("http://127.0.0.1:3000");
  });

  it("requires BETTER_AUTH_SECRET (min 32 chars) in production", () => {
    const prod = {
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: BASE_ENV.DATABASE_URL,
    };
    expect(() => validateServerConfig(prod)).toThrow(/BETTER_AUTH_SECRET/);
    expect(() =>
      validateServerConfig({ ...prod, BETTER_AUTH_SECRET: "short" }),
    ).toThrow(/BETTER_AUTH_SECRET/);
    expect(() =>
      validateServerConfig({ ...prod, BETTER_AUTH_SECRET: SECRET }),
    ).not.toThrow();
  });

  it("requires https BETTER_AUTH_URL in production when set", () => {
    const prod = {
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: BASE_ENV.DATABASE_URL,
      BETTER_AUTH_SECRET: SECRET,
    };
    expect(() =>
      validateServerConfig({
        ...prod,
        BETTER_AUTH_URL: "http://portal.example.sa",
      }),
    ).toThrow(/BETTER_AUTH_URL/);
    expect(() =>
      validateServerConfig({
        ...prod,
        BETTER_AUTH_URL: "https://portal.example.sa",
      }),
    ).not.toThrow();
  });

  it("rejects non-absolute BETTER_AUTH_URL values", () => {
    expect(() =>
      validateServerConfig({ ...BASE_ENV, BETTER_AUTH_URL: "not-a-url" }),
    ).toThrow(/BETTER_AUTH_URL/);
  });

  it("never leaks the secret value into configuration errors", () => {
    let message = "";
    try {
      validateServerConfig({
        ...BASE_ENV,
        BETTER_AUTH_SECRET: "super-secret-sentinel-value-123456",
        BETTER_AUTH_URL: "broken url with spaces",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain("super-secret-sentinel-value-123456");
  });
});
