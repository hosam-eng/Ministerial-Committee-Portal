import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { currentTraceIds } from "../telemetry";

export const REQUEST_ID_HEADER = "x-request-id";

export interface RequestContext {
  readonly requestId: string;
  readonly traceId?: string;
  readonly spanId?: string;
}

/**
 * Per-execution async context — the supported mechanism for propagating
 * correlation data without unsafe global mutable request state.
 */
const storage = new AsyncLocalStorage<RequestContext>();

/** UUIDs and common vendor trace/request ids; bounded to 128 chars. */
const INBOUND_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidInboundRequestId(value: string): boolean {
  return INBOUND_ID_PATTERN.test(value);
}

export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Resolve the request id for an incoming request: reuse a well-formed
 * inbound id, otherwise generate a fresh UUID.
 */
export function resolveRequestId(headers: Headers): string {
  const inbound = headers.get(REQUEST_ID_HEADER);
  return inbound && isValidInboundRequestId(inbound)
    ? inbound
    : generateRequestId();
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(storage.run(context, fn));
}

/**
 * Run an HTTP handler inside a request context: resolves the request id
 * (trusted-inbound or generated) and captures the active trace ids, so
 * concurrent requests stay fully isolated.
 */
export function withRequestContext<T>(
  request: Request,
  handler: (context: RequestContext) => T | Promise<T>,
): Promise<T> {
  const { traceId, spanId } = currentTraceIds();
  const context: RequestContext = {
    requestId: resolveRequestId(request.headers),
    traceId,
    spanId,
  };
  return runWithRequestContext(context, () => handler(context));
}
