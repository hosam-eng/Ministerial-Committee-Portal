/**
 * Platform database infrastructure.
 *
 * The only sanctioned import surface for Prisma/pg-backed persistence.
 * Module infrastructure code (src/modules/<m>/infrastructure/) consumes
 * `Database`; domain, application, presentation, shared, and app layers
 * must never see Prisma or pg types.
 */
export type { Database } from "./client";
export { createDatabase } from "./client";
export type { DatabaseConfig } from "./config";
export { databaseConfigFromEnv } from "./config";
