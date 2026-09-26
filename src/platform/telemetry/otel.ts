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

/**
 * Initialize OpenTelemetry once per process. No vendor/backend is chosen
 * here — an exporter is only attached when an endpoint is configured,
 * preserving the ability to add deployment-specific exporters later.
 */
export function initTelemetry(options: TelemetryOptions): NodeSDK {
  if (sdk) {
    return sdk;
  }
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
    }),
    ...(options.exporterEndpoint
      ? {
          traceExporter: new OTLPTraceExporter({
            url: `${options.exporterEndpoint.replace(/\/$/, "")}/v1/traces`,
          }),
        }
      : {}),
  });
  sdk.start();
  return sdk;
}

export function isTelemetryInitialized(): boolean {
  return sdk !== undefined;
}

/** Idempotent provider shutdown, invoked by the lifecycle layer. */
export async function shutdownTelemetry(): Promise<void> {
  const current = sdk;
  sdk = undefined;
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
