import { describe, expect, it } from "vitest";

import { createAuth } from "@/modules/identity/infrastructure/auth/auth";
import { validateServerConfig } from "@/platform/config";
import type { Database } from "@/platform/database";

const SECRET = "a-valid-test-secret-with-32-plus-chars";
const URL_HTTP = "http://127.0.0.1:3000";
const URL_HTTPS = "https://portal.example.sa";

function envFor(appEnv: "development" | "test" | "production") {
  const env: Record<string, string> = {
    NODE_ENV: appEnv === "production" ? "production" : appEnv,
    APP_ENV: appEnv,
    BETTER_AUTH_SECRET: SECRET,
    BETTER_AUTH_URL: appEnv === "production" ? URL_HTTPS : URL_HTTP,
  };
  if (appEnv === "production") {
    env.DATABASE_URL = "postgresql://mcp_runtime:x@127.0.0.1:5432/mcp_prod";
  }
  return env;
}

describe("auth server configuration (IMP-05)", () => {
  it("maps BETTER_AUTH_SECRET / BETTER_AUTH_URL into typed config", () => {
    const config = validateServerConfig(envFor("test"));
    expect(config.auth.secret).toBe(SECRET);
    expect(config.auth.baseUrl).toBe(URL_HTTP);
  });

  it.each(["development", "test", "production"] as const)(
    "requires BETTER_AUTH_SECRET when APP_ENV=%s",
    (appEnv) => {
      const env = envFor(appEnv);
      delete env.BETTER_AUTH_SECRET;
      expect(() => validateServerConfig(env)).toThrow(/BETTER_AUTH_SECRET/);
    },
  );

  it("rejects secrets shorter than 32 characters", () => {
    expect(() =>
      validateServerConfig({ ...envFor("test"), BETTER_AUTH_SECRET: "short" }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("never leaks the secret value into configuration errors", () => {
    const sentinel = "super-secret-sentinel-value-123456";
    let message = "";
    try {
      validateServerConfig({
        ...envFor("test"),
        BETTER_AUTH_SECRET: sentinel,
        BETTER_AUTH_URL: "broken url with spaces",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("BETTER_AUTH_URL");
    expect(message).not.toContain(sentinel);
  });

  it.each(["development", "test", "production"] as const)(
    "requires BETTER_AUTH_URL when APP_ENV=%s",
    (appEnv) => {
      const env = envFor(appEnv);
      delete env.BETTER_AUTH_URL;
      expect(() => validateServerConfig(env)).toThrow(/BETTER_AUTH_URL/);
    },
  );

  it("rejects malformed / non-absolute BETTER_AUTH_URL values", () => {
    for (const bad of ["not-a-url", "relative/path", "://missing", ""]) {
      expect(() =>
        validateServerConfig({ ...envFor("test"), BETTER_AUTH_URL: bad }),
      ).toThrow(/BETTER_AUTH_URL/);
    }
  });

  it.each(["development", "test"] as const)(
    "allows http BETTER_AUTH_URL when APP_ENV=%s",
    (appEnv) => {
      expect(() =>
        validateServerConfig({ ...envFor(appEnv), BETTER_AUTH_URL: URL_HTTP }),
      ).not.toThrow();
    },
  );

  it("rejects http BETTER_AUTH_URL in production, accepts https", () => {
    expect(() =>
      validateServerConfig({
        ...envFor("production"),
        BETTER_AUTH_URL: URL_HTTP,
      }),
    ).toThrow(/BETTER_AUTH_URL/);
    expect(() => validateServerConfig(envFor("production"))).not.toThrow();
  });
});

describe("backoffice session policy (IMP-05)", () => {
  // prismaAdapter is lazy — a stub proves the configured options surface
  // without opening a database connection.
  const auth = createAuth({ prisma: {} } as unknown as Database);

  it("is a fixed 8-hour session with refresh disabled", () => {
    const session = auth.options.session;
    expect(session?.expiresIn).toBe(8 * 60 * 60);
    expect(session?.disableSessionRefresh).toBe(true);
    // No sliding-expiry window is configured — active use cannot extend it.
    expect(
      session && "updateAge" in session ? session.updateAge : undefined,
    ).toBeUndefined();
  });
});
