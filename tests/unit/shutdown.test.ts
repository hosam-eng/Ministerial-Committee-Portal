import { afterEach, describe, expect, it, vi } from "vitest";

import {
  registerShutdownHandler,
  resetShutdownForTest,
  runShutdown,
} from "@/platform/runtime";
import {
  initTelemetry,
  isTelemetryInitialized,
  shutdownTelemetry,
} from "@/platform/telemetry";

afterEach(() => {
  resetShutdownForTest();
});

describe("graceful shutdown", () => {
  it("runs every registered closer", async () => {
    const order: string[] = [];
    registerShutdownHandler("a", () => void order.push("a"));
    registerShutdownHandler("b", async () => void order.push("b"));
    await runShutdown();
    expect(order.sort()).toEqual(["a", "b"]);
  });

  it("runs closers only once", async () => {
    const closer = vi.fn();
    registerShutdownHandler("db", closer);
    await runShutdown();
    await runShutdown();
    expect(closer).toHaveBeenCalledTimes(1);
  });

  it("a failing closer does not block the others", async () => {
    const ok = vi.fn();
    registerShutdownHandler("bad", () => {
      throw new Error("closer exploded");
    });
    registerShutdownHandler("ok", ok);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await runShutdown();
    expect(ok).toHaveBeenCalledTimes(1);
    stderr.mockRestore();
  });

  it("re-registration by name replaces the closer", async () => {
    const first = vi.fn();
    const second = vi.fn();
    registerShutdownHandler("db", first);
    registerShutdownHandler("db", second);
    await runShutdown();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("OpenTelemetry lifecycle", () => {
  it("initializes without a backend and shuts down cleanly", async () => {
    const sdk = initTelemetry({ serviceName: "mcp-test" });
    expect(isTelemetryInitialized()).toBe(true);
    expect(initTelemetry({ serviceName: "mcp-test" })).toBe(sdk); // idempotent
    await shutdownTelemetry();
    expect(isTelemetryInitialized()).toBe(false);
  });

  it("can be wired as a shutdown closer", async () => {
    initTelemetry({ serviceName: "mcp-test" });
    registerShutdownHandler("telemetry", () => shutdownTelemetry());
    await runShutdown();
    expect(isTelemetryInitialized()).toBe(false);
  });
});
