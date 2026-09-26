import type { NextRequest } from "next/server";

import { getAuth } from "./auth";

/**
 * Next.js route handlers for the Better Auth catch-all. Bound lazily so
 * importing the delivery route never opens database connections — the
 * auth instance resolves on first request. Kept inside identity
 * infrastructure so the delivery layer never depends on the auth
 * framework directly.
 */
async function handler(request: NextRequest): Promise<Response> {
  return getAuth().handler(request);
}

export const authRouteHandlers = { POST: handler, GET: handler } as const;
