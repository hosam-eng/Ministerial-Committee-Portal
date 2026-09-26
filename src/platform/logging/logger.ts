import {
  pino,
  stdSerializers,
  stdTimeFunctions,
  type DestinationStream,
  type Logger,
} from "pino";

import { getServerConfig } from "../config";
import { getRequestContext } from "../context";
import { currentTraceIds } from "../telemetry";

import { REDACT_OPTIONS } from "./redaction";

export interface LoggerOptions {
  level: string;
  serviceName: string;
  appEnv: string;
  /** Optional destination for tests; defaults to pino's stdout. */
  destination?: DestinationStream;
}

/**
 * Structured JSON logger factory. Consistent base fields, ISO timestamps,
 * safe error serialization, centralized redaction, and automatic
 * correlation fields (requestId / traceId / spanId) from async context.
 */
export function createLogger(options: LoggerOptions): Logger {
  return pino(
    {
      level: options.level,
      base: {
        service: options.serviceName,
        env: options.appEnv,
      },
      timestamp: stdTimeFunctions.isoTime,
      redact: REDACT_OPTIONS,
      serializers: {
        err: stdSerializers.err,
        error: stdSerializers.err,
      },
      mixin() {
        const ctx = getRequestContext();
        const trace = currentTraceIds();
        return {
          ...(ctx?.requestId ? { requestId: ctx.requestId } : {}),
          ...(trace.traceId ? { traceId: trace.traceId } : {}),
          ...(trace.spanId ? { spanId: trace.spanId } : {}),
        };
      },
    },
    options.destination,
  );
}

let cached: Logger | undefined;

/** Process-wide logger — configured from typed server config. */
export function getLogger(): Logger {
  if (!cached) {
    const config = getServerConfig();
    cached = createLogger({
      level: config.logLevel,
      serviceName: config.otel.serviceName,
      appEnv: config.appEnv,
    });
  }
  return cached;
}

/** Test hook: reset the memoized logger. */
export function resetLoggerForTest(): void {
  cached = undefined;
}
