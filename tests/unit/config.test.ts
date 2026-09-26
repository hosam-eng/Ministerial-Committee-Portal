import { describe, expect, it } from "vitest";

import {
  collectPublicEnv,
  ConfigurationError,
  getPublicConfig,
  validateServerConfig,
} from "@/platform/config";

const VALID_ENV: Record<string, string> = {
  NODE_ENV: "test",
  APP_ENV: "test",
  DATABASE_URL: "postgresql://user:secret@localhost:5432/mcp_test",
};

describe("server config validation", () => {
  it("parses a valid environment into typed config", () => {
    const config = validateServerConfig(VALID_ENV);
    expect(config.nodeEnv).toBe("test");
    expect(config.appEnv).toBe("test");
    expect(config.isProduction).toBe(false);
    expect(config.logLevel).toBe("info");
    expect(config.databaseUrl).toBe(VALID_ENV.DATABASE_URL);
    expect(config.otel.serviceName).toBe("ministerial-committee-portal");
  });

  it("returns immutable config objects", () => {
    const config = validateServerConfig(VALID_ENV);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.otel)).toBe(true);
  });

  it("fails fast on invalid values", () => {
    expect(() =>
      validateServerConfig({ ...VALID_ENV, LOG_LEVEL: "verbose" }),
    ).toThrow(ConfigurationError);
    expect(() =>
      validateServerConfig({ ...VALID_ENV, NODE_ENV: "staging" }),
    ).toThrow(ConfigurationError);
    expect(() =>
      validateServerConfig({ ...VALID_ENV, DATABASE_URL: "not-a-url" }),
    ).toThrow(ConfigurationError);
    expect(() =>
      validateServerConfig({ ...VALID_ENV, DATABASE_URL: "https://x.test" }),
    ).toThrow(ConfigurationError);
  });

  it("requires DATABASE_URL when APP_ENV=production", () => {
    const env = { NODE_ENV: "production", APP_ENV: "production" };
    expect(() => validateServerConfig(env)).toThrow(ConfigurationError);
    expect(() =>
      validateServerConfig({ ...env, DATABASE_URL: VALID_ENV.DATABASE_URL }),
    ).not.toThrow();
  });

  it("allows DATABASE_URL absent outside production", () => {
    const config = validateServerConfig({ NODE_ENV: "test", APP_ENV: "test" });
    expect(config.databaseUrl).toBeUndefined();
  });

  it("never leaks secret values in validation errors", () => {
    const sentinel = "sup3r-secret-password-9f8e";
    try {
      validateServerConfig({
        NODE_ENV: "test",
        APP_ENV: "test",
        DATABASE_URL: `postgresql://u:${sentinel}@localhost:5432/db`,
        LOG_LEVEL: "bogus",
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      const text = JSON.stringify(error);
      expect(text).toContain("LOG_LEVEL");
      expect(text).not.toContain(sentinel);
      expect(text).not.toContain("bogus");
    }
  });

  it("treats empty-string optional URLs as unset", () => {
    const config = validateServerConfig({
      ...VALID_ENV,
      OTEL_EXPORTER_OTLP_ENDPOINT: "",
    });
    expect(config.otel.exporterEndpoint).toBeUndefined();
  });
});

describe("public config separation", () => {
  it("exposes only NEXT_PUBLIC_* keys", () => {
    const collected = collectPublicEnv({
      DATABASE_URL: VALID_ENV.DATABASE_URL,
      NEXT_PUBLIC_APP_NAME: "portal",
      SECRET_KEY: "hidden",
    });
    expect(collected).toEqual({ NEXT_PUBLIC_APP_NAME: "portal" });
  });

  it("public config carries no server values", () => {
    const config = getPublicConfig({
      ...VALID_ENV,
      DATABASE_URL: "postgresql://u:p@h/db",
      NEXT_PUBLIC_APP_NAME: "portal",
    });
    expect(config.appEnv).toBe("test");
    expect(Object.keys(config)).not.toContain("databaseUrl");
    expect(JSON.stringify(config)).not.toContain("postgresql://");
  });
});
