import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Deterministic server-config inputs for suites that import
// @/platform/config (validated at module load). Test-only values —
// never real secrets.
const env = process.env as Record<string, string | undefined>;
env.APP_ENV ??= "test";
env.NODE_ENV ??= "test";
env.BETTER_AUTH_SECRET ??= "test-only-better-auth-secret-32chars-min";

afterEach(() => {
  cleanup();
});
