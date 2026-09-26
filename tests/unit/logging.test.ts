import { Writable } from "node:stream";

import { context, trace, type SpanContext } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";

import { runWithRequestContext } from "@/platform/context";
import { createLogger, REDACT_CENSOR } from "@/platform/logging";
import { initTelemetry, shutdownTelemetry } from "@/platform/telemetry";

function capturedLogger(level = "info") {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  const logger = createLogger({
    level,
    serviceName: "mcp-test",
    appEnv: "test",
    destination,
  });
  const flush = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    return lines;
  };
  return { logger, flush };
}

describe("structured logging", () => {
  it("emits JSON lines with consistent fields", async () => {
    const { logger, flush } = capturedLogger();
    logger.info("hello");
    const [line] = await flush();
    expect(line.msg).toBe("hello");
    expect(line.level).toBe(30);
    expect(line.service).toBe("mcp-test");
    expect(line.env).toBe("test");
    expect(typeof line.time).toBe("string");
  });

  it("honors the configured level", async () => {
    const { logger, flush } = capturedLogger("warn");
    logger.info("dropped");
    logger.error("kept");
    const lines = await flush();
    expect(lines).toHaveLength(1);
    expect(lines[0].msg).toBe("kept");
  });

  it("serializes errors without exposing causes verbatim at top level", async () => {
    const { logger, flush } = capturedLogger();
    logger.error({ err: new Error("db exploded") }, "failed");
    const [line] = await flush();
    const err = line.err as { type: string; message: string };
    expect(err.type).toBe("Error");
    expect(err.message).toBe("db exploded");
  });
});

describe("redaction", () => {
  it("redacts headers, passwords, tokens, and connection strings at depth", async () => {
    const { logger, flush } = capturedLogger();
    logger.info(
      {
        req: {
          headers: {
            authorization: "Bearer tok-123",
            cookie: "session=abc",
            "x-api-key": "key-9",
          },
        },
        user: { name: "a", password: "hunter2" },
        nested: { deep: { token: "t-1", connectionString: "pg://x" } },
      },
      "secrets",
    );
    const [line] = await flush();
    const text = JSON.stringify(line);
    expect(text).not.toContain("tok-123");
    expect(text).not.toContain("session=abc");
    expect(text).not.toContain("key-9");
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("pg://x");
    expect(text).toContain(REDACT_CENSOR);
  });
});

describe("log correlation", () => {
  it("attaches requestId from the async request context", async () => {
    const { logger, flush } = capturedLogger();
    await runWithRequestContext({ requestId: "req-correlation-1" }, () =>
      logger.info("inside"),
    );
    const [line] = await flush();
    expect(line.requestId).toBe("req-correlation-1");
  });

  it("omits correlation fields outside request context", async () => {
    const { logger, flush } = capturedLogger();
    logger.info("outside");
    const [line] = await flush();
    expect(line.requestId).toBeUndefined();
  });

  it("attaches traceId/spanId when a span context is active", async () => {
    // An active span requires the SDK's context manager.
    initTelemetry({ serviceName: "mcp-test" });
    try {
      const { logger, flush } = capturedLogger();
      const spanContext: SpanContext = {
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        traceFlags: 1,
        isRemote: true,
      };
      const active = trace.setSpanContext(context.active(), spanContext);
      await context.with(active, () => logger.info("traced"));
      const [line] = await flush();
      expect(line.traceId).toBe(spanContext.traceId);
      expect(line.spanId).toBe(spanContext.spanId);
    } finally {
      await shutdownTelemetry();
    }
  });
});
