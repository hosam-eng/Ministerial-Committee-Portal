import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import {
  generateRequestId,
  isValidInboundRequestId,
  REQUEST_ID_HEADER,
} from "@/platform/context";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Node.js request proxy (Next 16 convention). Two responsibilities, kept
 * deliberately flat:
 *
 * - "/api/*" → x-request-id propagation (reuse a well-formed inbound ID or
 *   generate a fresh UUID, forward it to route handlers, echo it back).
 *   API paths are never localized.
 * - everything else → next-intl routing: explicit "/{locale}" prefix,
 *   "/" redirects to "/ar", unsupported locales get safe not-found.
 */
export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api")) {
    const inbound = request.headers.get(REQUEST_ID_HEADER);
    const requestId =
      inbound && isValidInboundRequestId(inbound)
        ? inbound
        : generateRequestId();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(REQUEST_ID_HEADER, requestId);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/api/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
