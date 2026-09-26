import { REQUEST_ID_HEADER, resolveRequestId } from "@/platform/context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness: process is up. Never touches the database — cheap and safe.
 */
export function GET(request: Request): Response {
  const requestId = resolveRequestId(request.headers);
  return Response.json(
    { status: "ok" },
    {
      headers: {
        "cache-control": "no-store",
        [REQUEST_ID_HEADER]: requestId,
      },
    },
  );
}
