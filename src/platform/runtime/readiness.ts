import type { Database } from "../database";

const DEFAULT_TIMEOUT_MS = 2_000;

/**
 * Liveness-style probe against the runtime database. Returns a boolean —
 * connection errors, timeouts, and protocol failures all map to `false`
 * so callers never surface internals in health output.
 */
export async function checkDatabaseReadiness(
  database: Database,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      database.pool.query("SELECT 1"),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("readiness probe timed out")),
          timeoutMs,
        );
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
