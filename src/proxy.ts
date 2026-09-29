import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import {
  generateRequestId,
  isValidInboundRequestId,
  REQUEST_ID_HEADER,
} from "@/platform/context";
import { routing } from "@/i18n/routing";
import {
  isPreviewPath,
  PREVIEW_CACHE_CONTROL,
  PREVIEW_ROBOTS_TAG,
} from "@/shared/preview/safety";

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

  const response = intlMiddleware(request);
  if (isPreviewPath(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", PREVIEW_CACHE_CONTROL);
    response.headers.set("X-Robots-Tag", PREVIEW_ROBOTS_TAG);
  }
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
