import { NextResponse, type NextRequest } from "next/server";

import {
  generateRequestId,
  isValidInboundRequestId,
  REQUEST_ID_HEADER,
} from "@/platform/context";

/**
 * Node.js request proxy (Next 16 convention). Reuses a well-formed
 * inbound x-request-id or generates a fresh UUID, propagates it into the
 * request headers for route handlers, and echoes it on the response.
 */
export function proxy(request: NextRequest): NextResponse {
  const inbound = request.headers.get(REQUEST_ID_HEADER);
  const requestId =
    inbound && isValidInboundRequestId(inbound) ? inbound : generateRequestId();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
