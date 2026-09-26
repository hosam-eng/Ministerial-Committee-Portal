import { getServerConfig } from "../config";
import {
  createDatabase,
  databaseConfigFromServerConfig,
  type Database,
} from "../database";
import { AppError } from "../errors";

let database: Database | undefined;

/**
 * Process-wide runtime database handle — always the runtime identity
 * (DATABASE_URL / mcp_runtime). Migration credentials never flow here.
 */
export function getRuntimeDatabase(): Database {
  const config = getServerConfig();
  if (!config.databaseUrl) {
    throw new AppError("DEPENDENCY_UNAVAILABLE", {
      message: "DATABASE_URL is not configured",
    });
  }
  database ??= createDatabase(databaseConfigFromServerConfig(config));
  return database;
}

/** Idempotent close; invoked by the lifecycle layer on shutdown. */
export async function closeRuntimeDatabase(): Promise<void> {
  const current = database;
  database = undefined;
  await current?.close();
}
