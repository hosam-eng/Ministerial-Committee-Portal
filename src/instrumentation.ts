/**
 * Next.js instrumentation entrypoint — runs once at server startup on the
 * Node.js runtime. Validates configuration (fail-fast), bootstraps
 * OpenTelemetry without requiring a backend, and installs the graceful
 * shutdown lifecycle.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { getServerConfig } = await import("@/platform/config");
  const config = getServerConfig();

  const { initTelemetry, shutdownTelemetry } =
    await import("@/platform/telemetry");
  initTelemetry({
    serviceName: config.otel.serviceName,
    exporterEndpoint: config.otel.exporterEndpoint,
  });

  const { closeRuntimeDatabase } = await import("@/platform/runtime");
  const { installSignalHandlers, registerShutdownHandler } =
    await import("@/platform/runtime");
  registerShutdownHandler("database", () => closeRuntimeDatabase());
  registerShutdownHandler("telemetry", () => shutdownTelemetry());
  installSignalHandlers();
}
