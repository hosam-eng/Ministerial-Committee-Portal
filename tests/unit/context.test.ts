import { describe, expect, it } from "vitest";

import {
  generateRequestId,
  getRequestContext,
  isValidInboundRequestId,
  resolveRequestId,
  runWithRequestContext,
  withRequestContext,
} from "@/platform/context";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("request id", () => {
  it("generates UUID request ids", () => {
    expect(generateRequestId()).toMatch(UUID_PATTERN);
  });

  it("reuses a well-formed inbound id", () => {
    const headers = new Headers({ "x-request-id": "req-abc-123" });
    expect(resolveRequestId(headers)).toBe("req-abc-123");
  });

  it("regenerates on missing or malformed inbound ids", () => {
    expect(resolveRequestId(new Headers())).toMatch(UUID_PATTERN);
    const bad = new Headers({ "x-request-id": "a b!c" });
    expect(resolveRequestId(bad)).toMatch(UUID_PATTERN);
    const short = new Headers({ "x-request-id": "x" });
    expect(resolveRequestId(short)).toMatch(UUID_PATTERN);
  });

  it("accepts UUID-shaped inbound ids", () => {
    const id = generateRequestId();
    expect(isValidInboundRequestId(id)).toBe(true);
  });
});

describe("async context", () => {
  it("is empty outside a request scope", () => {
    expect(getRequestContext()).toBeUndefined();
  });

  it("exposes the context inside the scope only", async () => {
    await runWithRequestContext({ requestId: "req-1" }, async () => {
      expect(getRequestContext()?.requestId).toBe("req-1");
    });
    expect(getRequestContext()).toBeUndefined();
  });

  it("isolates concurrent requests", async () => {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const results = await Promise.all([
      runWithRequestContext({ requestId: "req-A" }, async () => {
        await delay(15);
        return getRequestContext()?.requestId;
      }),
      runWithRequestContext({ requestId: "req-B" }, async () => {
        await delay(5);
        return getRequestContext()?.requestId;
      }),
      runWithRequestContext({ requestId: "req-C" }, async () => {
        await delay(10);
        return getRequestContext()?.requestId;
      }),
    ]);
    expect(results).toEqual(["req-A", "req-B", "req-C"]);
  });

  it("builds context from an incoming Request", async () => {
    const request = new Request("https://portal.test/api/health/ready", {
      headers: { "x-request-id": "inbound-42" },
    });
    await withRequestContext(request, async (ctx) => {
      expect(ctx.requestId).toBe("inbound-42");
      expect(getRequestContext()?.requestId).toBe("inbound-42");
    });
  });
});
