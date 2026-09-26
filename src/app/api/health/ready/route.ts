import { REQUEST_ID_HEADER, withRequestContext } from "@/platform/context";
import { AppError, problemResponse } from "@/platform/errors";
import { getLogger } from "@/platform/logging";
import { checkDatabaseReadiness, getRuntimeDatabase } from "@/platform/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Readiness: runtime PostgreSQL reachable via the mcp_runtime identity.
 * 200 when healthy, 503 problem-details otherwise — internals (SQL,
 * credentials, stack traces) never leave this boundary.
 */
export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async ({ requestId }) => {
    let ok = false;
    try {
      ok = await checkDatabaseReadiness(getRuntimeDatabase());
    } catch {
      ok = false;
    }

    if (ok) {
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

    getLogger().warn({ requestId }, "readiness check failed");
    return problemResponse(
      new AppError("DEPENDENCY_UNAVAILABLE", {
        publicMessage: "A required dependency is currently unavailable.",
      }),
      { requestId, instance: "/api/health/ready" },
    );
  });
}
