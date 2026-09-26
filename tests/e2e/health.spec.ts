import { expect, test } from "@playwright/test";

/**
 * IMP-03 runtime-platform smoke: liveness/readiness on the production
 * build. CI runs without DATABASE_URL, so readiness must degrade to a
 * safe 503 problem-details response — never a crash or a leak.
 */
test("liveness responds ok without a database", async ({ request }) => {
  const response = await request.get("/api/health/live");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["x-request-id"]).toBeTruthy();
  expect(await response.json()).toEqual({ status: "ok" });
});

test("readiness degrades to safe problem details without a database", async ({
  request,
}) => {
  const response = await request.get("/api/health/ready", {
    headers: { "x-request-id": "e2e-ready-1" },
  });
  expect(response.status()).toBe(503);
  expect(response.headers()["content-type"]).toContain(
    "application/problem+json",
  );
  expect(response.headers()["x-request-id"]).toBe("e2e-ready-1");
  const body = await response.json();
  expect(body.code).toBe("DEPENDENCY_UNAVAILABLE");
  const text = JSON.stringify(body);
  expect(text).not.toContain("stack");
  expect(text).not.toContain("postgres");
});
