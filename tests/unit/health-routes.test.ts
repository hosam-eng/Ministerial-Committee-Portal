import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET as liveGET } from "@/app/api/health/live/route";
import { GET as readyGET } from "@/app/api/health/ready/route";
import { resetServerConfigForTest } from "@/platform/config";
import { closeRuntimeDatabase } from "@/platform/runtime";

/**
 * Route-level health contract. The DB-up path is covered end-to-end by
 * tests/db (real PostgreSQL) and tests/e2e (live server); here we pin the
 * DB-down/503 contract and response safety without a database.
 */

const savedDatabaseUrl = process.env.DATABASE_URL;
const savedAppEnv = process.env.APP_ENV;

// APP_ENV is required config — the 503 path logs via the real logger.
beforeEach(() => {
  process.env.APP_ENV = "test";
});

afterEach(async () => {
  await closeRuntimeDatabase();
  resetServerConfigForTest();
  if (savedDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = savedDatabaseUrl;
  }
  if (savedAppEnv === undefined) {
    delete process.env.APP_ENV;
  } else {
    process.env.APP_ENV = savedAppEnv;
  }
});

describe("GET /api/health/live", () => {
  it("returns 200 ok without requiring the database", async () => {
    delete process.env.DATABASE_URL;
    const response = liveGET(new Request("http://local/api/health/live"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("echoes a well-formed inbound request id", async () => {
    const response = liveGET(
      new Request("http://local/api/health/live", {
        headers: { "x-request-id": "edge-req-77" },
      }),
    );
    expect(response.headers.get("x-request-id")).toBe("edge-req-77");
  });
});

describe("GET /api/health/ready", () => {
  it("returns a safe 503 problem-details body when the DB is unavailable", async () => {
    delete process.env.DATABASE_URL;
    const response = await readyGET(
      new Request("http://local/api/health/ready", {
        headers: { "x-request-id": "req-ready-1" },
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toBe(
      "application/problem+json",
    );
    expect(response.headers.get("x-request-id")).toBe("req-ready-1");

    const body = await response.json();
    expect(body.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(body.status).toBe(503);
    expect(body.requestId).toBe("req-ready-1");
    // Safety: no credentials, SQL, stack traces, or env internals.
    const text = JSON.stringify(body);
    expect(text).not.toContain("DATABASE_URL");
    expect(text).not.toContain("postgres");
    expect(text).not.toContain("stack");
  });
});
