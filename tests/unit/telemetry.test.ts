import { trace } from "@opentelemetry/api";
import { afterEach, describe, expect, it } from "vitest";

import {
  getTelemetryState,
  initTelemetry,
  isTelemetryInitialized,
  shutdownTelemetry,
} from "@/platform/telemetry";

afterEach(async () => {
  await shutdownTelemetry();
});

describe("OpenTelemetry no-export guarantee", () => {
  it("initializes with no trace exporter when no endpoint is set", () => {
    initTelemetry({ serviceName: "mcp-test" });
    expect(getTelemetryState()).toEqual({
      initialized: true,
      traceExporterConfigured: false,
    });
    // No TracerProvider was registered: spans are non-recording, so no
    // OTLP outbound export attempt can ever occur.
    const span = trace.getTracer("probe").startSpan("no-export");
    expect(trace.isSpanContextValid(span.spanContext())).toBe(false);
    span.end();
  });

  it("uses the configured OTLP HTTP exporter when an endpoint is set", () => {
    initTelemetry({
      serviceName: "mcp-test",
      exporterEndpoint: "http://localhost:4318",
    });
    expect(getTelemetryState()).toEqual({
      initialized: true,
      traceExporterConfigured: true,
    });
    // A real TracerProvider is registered — spans record a valid context.
    // The span is intentionally never ended so nothing is queued for export.
    const span = trace.getTracer("probe").startSpan("export");
    expect(trace.isSpanContextValid(span.spanContext())).toBe(true);
  });

  it("shutdown is idempotent", async () => {
    initTelemetry({ serviceName: "mcp-test" });
    await shutdownTelemetry();
    await shutdownTelemetry();
    expect(isTelemetryInitialized()).toBe(false);
    expect(getTelemetryState().traceExporterConfigured).toBe(false);
  });
});
