import { authRouteHandlers } from "@/modules/identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Better Auth catch-all — the only authentication API surface.
 * Intentionally outside the [locale] segment: /api/auth/* stays
 * unlocalized; /ar/api/auth/* is not an auth endpoint (proxy + routing
 * keep API traffic out of locale handling).
 */
export const { POST, GET } = authRouteHandlers;
