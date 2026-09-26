import { expect, test } from "@playwright/test";

import { hasDatabase } from "./support/auth";

/**
 * IMP-03 runtime-platform smoke: liveness/readiness on the production
 * build. Readiness asserts on both deployment shapes: a database is
 * attached (200) or absent (safe 503 problem-details — never a crash or
 * a leak). IMP-05 CI attaches PostgreSQL for the auth journeys.
 */
test("liveness responds ok", async ({ request }) => {
  const response = await request.get("/api/health/live");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["x-request-id"]).toBeTruthy();
  expect(await response.json()).toEqual({ status: "ok" });
});

test("readiness reports dependency status", async ({ request }) => {
  const response = await request.get("/api/health/ready", {
    headers: { "x-request-id": "e2e-ready-1" },
  });
  expect(response.headers()["x-request-id"]).toBe("e2e-ready-1");
  if (hasDatabase()) {
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    return;
  }
  expect(response.status()).toBe(503);
  expect(response.headers()["content-type"]).toContain(
    "application/problem+json",
  );
  const body = await response.json();
  expect(body.code).toBe("DEPENDENCY_UNAVAILABLE");
  const text = JSON.stringify(body);
  expect(text).not.toContain("stack");
  expect(text).not.toContain("postgres");
});
