import { context, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export interface TelemetryOptions {
  serviceName: string;
  /**
   * OTLP HTTP endpoint for trace export. When absent the SDK initializes
   * without an exporter — local dev and tests need no backend.
   */
  exporterEndpoint?: string;
}

let sdk: NodeSDK | undefined;
let exporterConfigured = false;

/**
 * Initialize OpenTelemetry once per process. No vendor/backend is chosen
 * here — an exporter is only attached when an endpoint is configured,
 * preserving the ability to add deployment-specific exporters later.
 *
 * Without an endpoint, empty `spanProcessors`/`logRecordProcessors`/
 * `metricReaders` explicitly disable every signal's auto-configured
 * exporter: NodeSDK otherwise defaults unset signals to OTLP exporters,
 * which would silently attempt outbound export. No endpoint → no
 * exporter → no external collector required.
 */
export function initTelemetry(options: TelemetryOptions): NodeSDK {
  if (sdk) {
    return sdk;
  }
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: options.serviceName,
  });
  sdk = new NodeSDK(
    options.exporterEndpoint
      ? {
          resource,
          // Metrics/log signals stay disabled; only traces export.
          logRecordProcessors: [],
          metricReaders: [],
          traceExporter: new OTLPTraceExporter({
            url: `${options.exporterEndpoint.replace(/\/$/, "")}/v1/traces`,
          }),
        }
      : {
          resource,
          spanProcessors: [],
          logRecordProcessors: [],
          metricReaders: [],
        },
  );
  sdk.start();
  exporterConfigured = options.exporterEndpoint !== undefined;
  return sdk;
}

export function isTelemetryInitialized(): boolean {
  return sdk !== undefined;
}

/** Introspection for operators/tests: whether an exporter was configured. */
export function getTelemetryState(): {
  initialized: boolean;
  traceExporterConfigured: boolean;
} {
  return {
    initialized: sdk !== undefined,
    traceExporterConfigured: exporterConfigured,
  };
}

/** Idempotent provider shutdown, invoked by the lifecycle layer. */
export async function shutdownTelemetry(): Promise<void> {
  const current = sdk;
  sdk = undefined;
  exporterConfigured = false;
  await current?.shutdown();
}

/**
 * Current trace ids for log correlation. Empty when no span is active —
 * logs still carry requestId in that case.
 */
export function currentTraceIds(): { traceId?: string; spanId?: string } {
  const spanContext = trace.getSpanContext(context.active());
  if (!spanContext || !trace.isSpanContextValid(spanContext)) {
    return {};
  }
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}
